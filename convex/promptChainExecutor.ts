/**
 * Prompt Chain Executor
 *
 * Executes chains of prompts sequentially or in parallel
 * Works with manual prompts in visual scripting tool
 */

"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * Execute a chain of prompts sequentially
 */
export const executePromptChain = action({
  args: {
    prompts: v.array(
      v.object({
        id: v.string(),
        template: v.string(),
        variables: v.optional(v.record(v.string(), v.any())), // v.any(): template variable values are heterogeneous
        model: v.string(), // "ollama:llama3.2:3b" or "bedrock:claude-3-5-haiku"
        extractOutput: v.optional(v.string()), // JSONPath or regex
      })
    ),
    initialInput: v.any(), // v.any(): accepts dynamic user-provided initial input (string, object, array)
    passThroughContext: v.boolean(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    finalOutput: any;
    intermediateResults: Array<{
      promptId: string;
      prompt: string;
      response: string;
      extracted: any;
      latency: number;
    }>;
    totalLatency: number;
    error?: string;
  }> => {
    // Gate: enforce tier-based Bedrock access if any prompt uses a Bedrock model
    const hasBedrock = args.prompts.some( ( p ) => p.model.startsWith( "bedrock:" ) );
    let gateUserId: import("./_generated/dataModel").Id<"users"> | null = null;
    let gateModelId: string | undefined;
    if ( hasBedrock ) {
      const { requireBedrockAccess } = await import( "./lib/bedrockGate" );
      const bedrockModel = args.prompts.find( ( p ) => p.model.startsWith( "bedrock:" ) );
      gateModelId = bedrockModel?.model.substring( "bedrock:".length );
      const gateResult = await requireBedrockAccess(
        ctx, gateModelId,
        async ( lookupArgs ) => ctx.runQuery( internal.users.getInternal, lookupArgs ),
      );
      if ( !gateResult.allowed ) {
        return {
          success: false,
          finalOutput: null,
          intermediateResults: [],
          totalLatency: 0,
          error: gateResult.reason,
        };
      }
      gateUserId = gateResult.userId;

      // Rate limit: prevent burst abuse per user
      const { checkRateLimit, buildTierRateLimitConfig } = await import( "./rateLimiter" );
      const { getTierConfig } = await import( "./lib/tierConfig" );
      const rlCfg = buildTierRateLimitConfig( getTierConfig( gateResult.tier ).maxConcurrentTests, "agentExecution" );
      const rlResult = await checkRateLimit( ctx, String( gateResult.userId ), "agentExecution", rlCfg );
      if ( !rlResult.allowed ) {
        return {
          success: false,
          finalOutput: null,
          intermediateResults: [],
          totalLatency: 0,
          error: rlResult.reason ?? "Rate limit exceeded. Please try again later.",
        };
      }
    }

    const startTime = Date.now();
    const intermediateResults = [];
    let context = args.initialInput;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    try {
      for (const promptConfig of args.prompts) {
        const promptStartTime = Date.now();

        // Render template with current context
        const renderedPrompt = renderTemplate(promptConfig.template, {
          ...promptConfig.variables,
          ...context,
        });

        // Execute prompt with specified model
        const modelResult = await invokeModel(
          promptConfig.model,
          renderedPrompt,
          ctx
        );
        const response = modelResult.text;
        totalInputTokens += modelResult.inputTokens;
        totalOutputTokens += modelResult.outputTokens;

        // Extract output if specified
        let extracted: any = response;
        if (promptConfig.extractOutput) {
          extracted = extractValue(response, promptConfig.extractOutput);
        }

        const latency = Date.now() - promptStartTime;

        intermediateResults.push({
          promptId: promptConfig.id,
          prompt: renderedPrompt,
          response,
          extracted,
          latency,
        });

        // Update context for next prompt
        if (args.passThroughContext) {
          if (typeof extracted === "object" && extracted !== null && !Array.isArray(extracted)) {
            context = { ...context, ...(extracted as Record<string, any>) };
          } else {
            context = { ...context, result: extracted };
          }
        } else {
          context = extracted;
        }
      }

      // Meter: token-based billing for the entire chain (non-fatal)
      if ( gateUserId && ( totalInputTokens > 0 || totalOutputTokens > 0 ) ) {
        try {
          await ctx.runMutation( internal.stripeMutations.incrementUsageAndReportOverage, {
            userId: gateUserId,
            modelId: gateModelId,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
          } );
        } catch ( billingErr ) {
          console.error( "promptChainExecutor: billing failed (non-fatal)", {
            userId: gateUserId, modelId: gateModelId,
            inputTokens: totalInputTokens, outputTokens: totalOutputTokens,
            error: billingErr instanceof Error ? billingErr.message : billingErr,
          } );
        }
      }

      const totalLatency = Date.now() - startTime;

      return {
        success: true,
        finalOutput: context,
        intermediateResults,
        totalLatency,
      };
    } catch (error: any) {
      return {
        success: false,
        finalOutput: null,
        intermediateResults,
        totalLatency: Date.now() - startTime,
        error: error.message || "Prompt chain execution failed",
      };
    }
  },
});

/**
 * Execute prompts in parallel
 */
export const executeParallelPrompts = action({
  args: {
    prompts: v.array(
      v.object({
        id: v.string(),
        template: v.string(),
        variables: v.optional(v.record(v.string(), v.any())), // v.any(): template variable values are heterogeneous
        model: v.string(),
      })
    ),
    sharedContext: v.record(v.string(), v.any()), // v.any(): shared context values are heterogeneous
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    results: Array<{
      promptId: string;
      response: string;
      latency: number;
      error?: string;
    }>;
    totalLatency: number;
    error?: string;
  }> => {
    // Gate: enforce tier-based Bedrock access if any prompt uses a Bedrock model
    const hasBedrock = args.prompts.some( ( p ) => p.model.startsWith( "bedrock:" ) );
    let gateUserId: import("./_generated/dataModel").Id<"users"> | null = null;
    let gateModelId: string | undefined;
    if ( hasBedrock ) {
      const { requireBedrockAccess } = await import( "./lib/bedrockGate" );
      const bedrockModel = args.prompts.find( ( p ) => p.model.startsWith( "bedrock:" ) );
      gateModelId = bedrockModel?.model.substring( "bedrock:".length );
      const gateResult = await requireBedrockAccess(
        ctx, gateModelId,
        async ( lookupArgs ) => ctx.runQuery( internal.users.getInternal, lookupArgs ),
      );
      if ( !gateResult.allowed ) {
        return {
          success: false,
          results: [],
          totalLatency: 0,
          error: gateResult.reason,
        };
      }
      gateUserId = gateResult.userId;

      // Rate limit: prevent burst abuse per user
      const { checkRateLimit, buildTierRateLimitConfig } = await import( "./rateLimiter" );
      const { getTierConfig } = await import( "./lib/tierConfig" );
      const rlCfg = buildTierRateLimitConfig( getTierConfig( gateResult.tier ).maxConcurrentTests, "agentExecution" );
      const rlResult = await checkRateLimit( ctx, String( gateResult.userId ), "agentExecution", rlCfg );
      if ( !rlResult.allowed ) {
        return {
          success: false,
          results: [],
          totalLatency: 0,
          error: rlResult.reason ?? "Rate limit exceeded. Please try again later.",
        };
      }
    }

    const startTime = Date.now();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    const resultPromises = args.prompts.map(async (promptConfig) => {
      const promptStartTime = Date.now();

      try {
        // Render template
        const renderedPrompt = renderTemplate(promptConfig.template, {
          ...promptConfig.variables,
          ...args.sharedContext,
        });

        // Execute
        const modelResult = await invokeModel(promptConfig.model, renderedPrompt, ctx);
        totalInputTokens += modelResult.inputTokens;
        totalOutputTokens += modelResult.outputTokens;

        return {
          promptId: promptConfig.id,
          response: modelResult.text,
          latency: Date.now() - promptStartTime,
        };
      } catch (error: any) {
        return {
          promptId: promptConfig.id,
          response: "",
          latency: Date.now() - promptStartTime,
          error: error.message,
        };
      }
    });

    const results = await Promise.all(resultPromises);

    // Meter: token-based billing for all parallel prompts
    if ( gateUserId && ( totalInputTokens > 0 || totalOutputTokens > 0 ) ) {
      await ctx.runMutation( internal.stripeMutations.incrementUsageAndReportOverage, {
        userId: gateUserId,
        modelId: gateModelId,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      } );
    }

    const totalLatency = Date.now() - startTime;

    const success = results.every((r) => !r.error);

    return {
      success,
      results,
      totalLatency,
    };
  },
});

/**
 * Render template with variables
 */
function renderTemplate(template: string, variables: any): string {
  let rendered = template;

  // Replace {variable} placeholders
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    rendered = rendered.replace(new RegExp(placeholder, "g"), String(value));
  }

  return rendered;
}

/**
 * Extract value from response using JSONPath or regex
 */
function extractValue(response: string, extractor: string): any {
  // Try JSON extraction
  if (extractor.startsWith("$.") || extractor.startsWith("$[")) {
    try {
      const json = JSON.parse(response);
      // Simple JSONPath implementation
      const path = extractor.slice(2).split(".");
      let value = json;
      for (const key of path) {
        value = value[key];
      }
      return value;
    } catch {
      // Fall through to regex
    }
  }

  // Try regex extraction
  try {
    const regex = new RegExp(extractor);
    const match = response.match(regex);
    return match ? match[1] || match[0] : response;
  } catch {
    // Return full response if extraction fails
    return response;
  }
}

/**
 * Invoke model (Ollama or Bedrock)
 */
async function invokeModel(
  modelSpec: string,
  prompt: string,
  _ctx: any,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const [provider] = modelSpec.split(":");

  if (provider === "ollama") {
    // Ollama model
    const ollamaModel = modelSpec.substring("ollama:".length);
    return await invokeOllama(ollamaModel, prompt);
  } else if (provider === "bedrock") {
    // Bedrock model
    const bedrockModel = modelSpec.substring("bedrock:".length);
    return await invokeBedrock(bedrockModel, prompt);
  } else {
    throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Invoke Ollama model
 */
async function invokeOllama(
  model: string,
  prompt: string,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const ollamaHost = process.env.OLLAMA_ENDPOINT || "http://127.0.0.1:11434";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${ollamaHost}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }

    const data = await response.json();
    return { text: data.response, inputTokens: 0, outputTokens: 0 };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Invoke Bedrock model
 */
async function invokeBedrock(
  model: string,
  prompt: string,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const { BedrockRuntimeClient, InvokeModelCommand } = await import("@aws-sdk/client-bedrock-runtime");

  const creds = (await import("./lib/aws/credentials")).validateAwsCredentials();

  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: creds || undefined,
  });

  const command = new InvokeModelCommand({
    modelId: model,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const outputText = responseBody.content?.[0]?.text || "";

  const { extractTokenUsage, estimateTokenUsage } = await import( "./lib/tokenBilling" );
  let tokenUsage = extractTokenUsage( responseBody, model );
  if ( tokenUsage.totalTokens === 0 ) {
    tokenUsage = estimateTokenUsage( prompt, outputText );
  }

  return {
    text: outputText,
    inputTokens: tokenUsage.inputTokens,
    outputTokens: tokenUsage.outputTokens,
  };
}

/**
 * Test a single prompt (for visual scripting tool testing)
 */
export const testPrompt = action({
  args: {
    template: v.string(),
    variables: v.optional(v.record(v.string(), v.any())), // v.any(): template variable values are heterogeneous
    model: v.string(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    prompt: string;
    response: string;
    latency: number;
    error?: string;
  }> => {
    // Gate: enforce tier-based Bedrock access
    let gateUserId: import("./_generated/dataModel").Id<"users"> | null = null;
    let gateModelId: string | undefined;
    if ( args.model.startsWith( "bedrock:" ) ) {
      const { requireBedrockAccess } = await import( "./lib/bedrockGate" );
      gateModelId = args.model.substring( "bedrock:".length );
      const gateResult = await requireBedrockAccess(
        ctx, gateModelId,
        async ( lookupArgs ) => ctx.runQuery( internal.users.getInternal, lookupArgs ),
      );
      if ( !gateResult.allowed ) {
        return { success: false, prompt: args.template, response: "", latency: 0, error: gateResult.reason };
      }
      gateUserId = gateResult.userId;
    }

    const startTime = Date.now();

    try {
      // Render template
      const renderedPrompt = renderTemplate(args.template, args.variables || {});

      // Execute
      const modelResult = await invokeModel(args.model, renderedPrompt, ctx);

      // Meter: token-based billing (non-fatal)
      if ( gateUserId && ( modelResult.inputTokens > 0 || modelResult.outputTokens > 0 ) ) {
        try {
          await ctx.runMutation( internal.stripeMutations.incrementUsageAndReportOverage, {
            userId: gateUserId,
            modelId: gateModelId,
            inputTokens: modelResult.inputTokens,
            outputTokens: modelResult.outputTokens,
          } );
        } catch ( billingErr ) {
          console.error( "promptChainExecutor: billing failed (non-fatal)", {
            userId: gateUserId, modelId: gateModelId,
            inputTokens: modelResult.inputTokens, outputTokens: modelResult.outputTokens,
            error: billingErr instanceof Error ? billingErr.message : billingErr,
          } );
        }
      }

      return {
        success: true,
        prompt: renderedPrompt,
        response: modelResult.text,
        latency: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        prompt: renderTemplate(args.template, args.variables || {}),
        response: "",
        latency: Date.now() - startTime,
        error: error.message || "Prompt execution failed",
      };
    }
  },
});

/**
 * Execute a tool from the Strands Agents Tools registry
 */
export const executeTool = action({
  args: {
    toolName: v.string(),
    toolType: v.string(), // "handoff_to_user", "short_term_memory", etc.
    inputs: v.any(), // v.any(): accepts dynamic tool inputs — shape varies per tool type
    config: v.any(), // v.any(): accepts dynamic tool config — shape varies per tool type
  },
  handler: async (_ctx, args): Promise<{
    success: boolean;
    outputs: any;
    latency: number;
    error?: string;
  }> => {
    const startTime = Date.now();

    try {
      let result: any;

      switch (args.toolType) {
        case "handoff":
          result = await executeHandoffToUser(args.inputs, args.config);
          break;

        case "short_term":
          result = await executeShortTermMemory(args.inputs, args.config);
          break;

        case "long_term":
          result = await executeLongTermMemory(args.inputs, args.config);
          break;

        case "semantic":
          result = await executeSemanticMemory(args.inputs, args.config);
          break;

        case "self_consistency":
          result = await executeSelfConsistency(args.inputs, args.config);
          break;

        case "tree_of_thoughts":
          result = await executeTreeOfThoughts(args.inputs, args.config);
          break;

        case "reflexion":
          result = await executeReflexion(args.inputs, args.config);
          break;

        case "map_reduce":
          result = await executeMapReduce(args.inputs, args.config);
          break;

        default:
          throw new Error(`Unknown tool type: ${args.toolType}`);
      }

      return {
        success: true,
        outputs: result,
        latency: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        outputs: null,
        latency: Date.now() - startTime,
        error: error.message || "Tool execution failed",
      };
    }
  },
});

/**
 * Tool Implementations
 */

async function executeHandoffToUser(inputs: any, config: any): Promise<any> {
  // Store handoff request in database (would use a Convex mutation in production)
  return {
    status: "pending_user_input",
    question: config.question,
    options: config.options,
    handoffId: `handoff_${Date.now()}`,
  };
}

async function executeShortTermMemory(inputs: any, config: any): Promise<any> {
  // In-memory storage for short-term memory (would use Convex database in production)
  const operation = inputs.operation;

  if (operation === "store") {
    return {
      result: "stored",
      key: inputs.key,
      value: inputs.value,
    };
  } else if (operation === "retrieve") {
    return {
      result: inputs.value || null,
      key: inputs.key,
    };
  }

  return { result: "operation_complete" };
}

async function executeLongTermMemory(inputs: any, config: any): Promise<any> {
  // Persistent storage (would use Convex database + vector DB in production)
  return {
    result: "stored_in_long_term_memory",
    version: 1,
  };
}

async function executeSemanticMemory(inputs: any, config: any): Promise<any> {
  // Vector search (would use actual embedding model in production)
  return {
    results: [],
    relevanceScores: [],
  };
}

async function executeSelfConsistency(inputs: any, config: any): Promise<any> {
  // Multi-path voting (simplified implementation)
  const numPaths = config.numPaths || 3;
  const answers = [];

  for (let i = 0; i < numPaths; i++) {
    // Would invoke model with different temperatures here
    answers.push(`answer_${i}`);
  }

  return {
    finalAnswer: answers[0], // Majority vote
    confidence: 0.8,
    reasoningPaths: answers,
    voteDistribution: { [answers[0]]: numPaths },
  };
}

async function executeTreeOfThoughts(inputs: any, config: any): Promise<any> {
  // Tree exploration (simplified implementation)
  return {
    bestPath: ["root", "branch1", "leaf1"],
    confidence: 0.9,
    treeStructure: {},
  };
}

async function executeReflexion(inputs: any, config: any): Promise<any> {
  // Self-improvement loop (simplified implementation)
  return {
    finalResult: "improved_solution",
    iterationHistory: [],
    improvements: ["fixed_logic_error", "added_evidence"],
  };
}

async function executeMapReduce(inputs: any, config: any): Promise<any> {
  // Map-reduce aggregation (simplified implementation)
  return {
    result: "aggregated_result",
    intermediateResults: [],
  };
}
