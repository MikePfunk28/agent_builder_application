"use node";

/**
 * AgentCore Test Execution - Cost Optimized
 *
 * Executes agent tests using the cheapest possible method:
 * 1. Direct Bedrock API (cheapest)
 * 2. Lambda with @app.entrypoint (backup)
 * 3. No MCP server complexity
 */

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Execute agent test with cost-optimized approach
 * Primary: Direct Bedrock API (cheapest)
 * Backup: Lambda with @app.entrypoint (reliable)
 * No MCP server complexity
 */
export const executeAgentCoreTest = internalAction({
  args: {
    testId: v.id("testExecutions"),
    agentId: v.id("agents"),
    input: v.string(),
    conversationHistory: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    try {
      // Get agent
      const agent = await ctx.runQuery(internal.agents.getInternal, { id: args.agentId });

      // Update status to running
      await ctx.runMutation(internal.testExecution.updateStatus, {
        testId: args.testId,
        status: "RUNNING",
      });

      // CHECK LIMITS: Only when actually executing
      if (!agent) {
        throw new Error("Agent not found");
      }

      const user = await ctx.runQuery(internal.users.getInternal, { id: agent.createdBy });
      const testsThisMonth = user?.testsThisMonth || 0;
      const tier = user?.tier || "freemium";

      const limits = { freemium: 10, personal: 100, enterprise: -1 };
      const limit = limits[tier as keyof typeof limits] || 10;

      if (limit !== -1 && testsThisMonth >= limit) {
        await ctx.runMutation(internal.testExecution.updateStatus, {
          testId: args.testId,
          status: "FAILED",
          success: false,
          error: `Monthly test limit reached (${testsThisMonth}/${limit}). Upgrade for more tests.`,
        });
        return { success: false, error: "Usage limit exceeded" };
      }

      // Route based on model provider
      let result;
      let executionMethod = "bedrock";

      // Check if agent uses Ollama
      if (agent.modelProvider === "ollama") {
        result = await executeViaOllama({
          input: args.input,
          modelId: agent.model,
          systemPrompt: agent.systemPrompt,
          ollamaEndpoint: agent.ollamaEndpoint || "http://localhost:11434",
          conversationHistory: args.conversationHistory,
        });
        executionMethod = "ollama";
      } else {
        // PRIMARY: Direct Bedrock API (cheapest)
        result = await executeViaDirectBedrock({
          input: args.input,
          modelId: agent.model,
          systemPrompt: agent.systemPrompt,
          conversationHistory: args.conversationHistory,
        });

        // BACKUP: Lambda with @app.entrypoint if Bedrock fails
        if (!result.success) {
          console.log(`Bedrock failed, trying Lambda backup for test ${args.testId}`);

          result = await executeViaLambda({
            agentCode: agent.generatedCode,
            input: args.input,
            modelId: agent.model,
            tools: agent.tools || [],
          });

          executionMethod = result.success ? "lambda" : "failed";
        }
      }

      const executionTime = Date.now() - startTime;

      if (result.success) {
        // TRACK USAGE: Only on successful completion
        await ctx.runMutation(internal.testExecution.incrementUserUsage, {
          userId: agent.createdBy,
          testId: args.testId,
          usage: result.result?.usage,
          executionTime,
          executionMethod,
        });

        // Update test with success
        await ctx.runMutation(internal.testExecution.updateStatus, {
          testId: args.testId,
          status: "COMPLETED",
          success: true,
          response: result.result?.response,
        });

        return {
          success: true,
          response: result.result?.response,
          executionTime,
          executionMethod,
        };
      } else {
        // Update test with failure (no usage tracking for failures)
        await ctx.runMutation(internal.testExecution.updateStatus, {
          testId: args.testId,
          status: "FAILED",
          success: false,
          error: result.error,
        });

        return {
          success: false,
          error: result.error,
          executionTime,
        };
      }
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      await ctx.runMutation(internal.testExecution.updateStatus, {
        testId: args.testId,
        status: "FAILED",
        success: false,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
        executionTime,
      };
    }
  },
});

/**
 * Execute via direct Bedrock API (cheapest option)
 * SUPPORTS ALL BEDROCK MODELS: Claude, Nova, Titan, Llama, Mistral, etc.
 */
async function executeViaDirectBedrock(params: {
  input: string;
  modelId: string;
  systemPrompt: string;
  conversationHistory?: any[];
}): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const { BedrockRuntimeClient, ConverseCommand } = await import("@aws-sdk/client-bedrock-runtime");

    const client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    // Import comprehensive model catalog
    const { ALL_MODELS } = await import("./lib/comprehensiveModelCatalog.js");

    // Normalize model ID - try to find in catalog first
    let modelId = params.modelId;

    // Check if it's a catalog key (e.g., "bedrock-claude-3.5-sonnet-v2")
    const catalogModel = ALL_MODELS[params.modelId];
    if (catalogModel && catalogModel.provider === "aws-bedrock") {
      modelId = catalogModel.modelId;
    } else if (!modelId.includes(":") && !modelId.startsWith("us.") && !modelId.startsWith("anthropic.") && !modelId.startsWith("amazon.") && !modelId.startsWith("meta.") && !modelId.startsWith("mistral.") && !modelId.startsWith("ai21.") && !modelId.startsWith("cohere.") && !modelId.startsWith("stability.")) {
      // Fallback mapping for common short names
      const modelMap: Record<string, string> = {
        // Claude 4.5 models (Latest - Oct 2025)
        "claude-sonnet-4.5": "anthropic.claude-sonnet-4-5-20251015-v1:0",
        "claude-4.5-sonnet": "anthropic.claude-sonnet-4-5-20251015-v1:0",
        "claude-haiku-4.5": "anthropic.claude-haiku-4-5-20251015-v1:0",
        "claude-4.5-haiku": "anthropic.claude-haiku-4-5-20251015-v1:0",

        // Claude 4.1 models (Aug 2025)
        "claude-opus-4.1": "anthropic.claude-opus-4-1-20250815-v1:0",
        "claude-4.1-opus": "anthropic.claude-opus-4-1-20250815-v1:0",

        // Claude 4 models (May 2025)
        "claude-opus-4": "anthropic.claude-opus-4-20250501-v1:0",
        "claude-4-opus": "anthropic.claude-opus-4-20250501-v1:0",
        "claude-sonnet-4": "anthropic.claude-sonnet-4-20250501-v1:0",
        "claude-4-sonnet": "anthropic.claude-sonnet-4-20250501-v1:0",

        // Claude 3.7 models (Feb 2025)
        "claude-sonnet-3.7": "anthropic.claude-sonnet-3-7-20250215-v1:0",
        "claude-3.7-sonnet": "anthropic.claude-sonnet-3-7-20250215-v1:0",

        // Claude 3.5 models
        "claude-3-5-sonnet-v2": "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
        "claude-3-5-sonnet": "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
        "claude-3-5-haiku": "us.anthropic.claude-3-5-haiku-20241022-v1:0",

        // Claude 3 models
        "claude-3-opus": "anthropic.claude-3-opus-20240229-v1:0",
        "claude-3-sonnet": "anthropic.claude-3-sonnet-20240229-v1:0",
        "claude-3-haiku": "anthropic.claude-3-haiku-20240307-v1:0",

        // Amazon Nova models
        "nova-pro": "us.amazon.nova-pro-v1:0",
        "nova-lite": "us.amazon.nova-lite-v1:0",
        "nova-micro": "us.amazon.nova-micro-v1:0",

        // Amazon Titan models
        "titan-text-premier": "amazon.titan-text-premier-v1:0",
        "titan-text-express": "amazon.titan-text-express-v1",
        "titan-text-lite": "amazon.titan-text-lite-v1",

        // Meta Llama 3.3
        "llama-3.3-70b": "us.meta.llama3-3-70b-instruct-v1:0",

        // Meta Llama 3.2
        "llama-3.2-90b": "us.meta.llama3-2-90b-instruct-v1:0",
        "llama-3.2-11b": "us.meta.llama3-2-11b-instruct-v1:0",
        "llama-3.2-3b": "us.meta.llama3-2-3b-instruct-v1:0",
        "llama-3.2-1b": "us.meta.llama3-2-1b-instruct-v1:0",

        // Meta Llama 3.1
        "llama-3.1-405b": "meta.llama3-1-405b-instruct-v1:0",
        "llama-3.1-70b": "meta.llama3-1-70b-instruct-v1:0",
        "llama-3.1-8b": "meta.llama3-1-8b-instruct-v1:0",

        // Mistral models
        "mistral-large-2": "mistral.mistral-large-2407-v1:0",
        "mistral-small": "mistral.mistral-small-2402-v1:0",
        "mixtral-8x7b": "mistral.mixtral-8x7b-instruct-v0:1",

        // AI21 Jamba
        "jamba-1.5-large": "ai21.jamba-1-5-large-v1:0",
        "jamba-1.5-mini": "ai21.jamba-1-5-mini-v1:0",

        // Cohere Command
        "command-r-plus": "cohere.command-r-plus-v1:0",
        "command-r": "cohere.command-r-v1:0",
      };
      modelId = modelMap[params.modelId] || "us.anthropic.claude-3-5-haiku-20241022-v1:0";
    }

    // Build conversation using Converse API (works with ALL Bedrock models)
    const messages: any[] = [];

    // Add conversation history if provided (last 5 messages for context)
    if (params.conversationHistory) {
      for (const msg of params.conversationHistory.slice(-5)) {
        messages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: [{ text: msg.content }],
        });
      }
    }

    // Add current input
    messages.push({
      role: "user",
      content: [{ text: params.input }],
    });

    // Use Converse API - works with ALL Bedrock models
    const command = new ConverseCommand({
      modelId: modelId,
      messages: messages,
      system: [{ text: params.systemPrompt }],
      inferenceConfig: {
        maxTokens: 4096,
        temperature: 0.7,
      },
    });

    // Execute with timeout
    const response = await Promise.race([
      client.send(command),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Bedrock timeout")), 60000)
      ),
    ]);

    // Extract response (Converse API format)
    const responseText = response.output?.message?.content?.[0]?.text || JSON.stringify(response.output);

    return {
      success: true,
      result: {
        response: responseText,
        usage: response.usage || {},
        modelId: modelId,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Bedrock API failed: ${error.message}`,
    };
  }
}

/**
 * Execute via Ollama (local model)
 * Uses OpenAI-compatible API
 */
async function executeViaOllama(params: {
  input: string;
  modelId: string;
  systemPrompt: string;
  ollamaEndpoint: string;
  conversationHistory?: any[];
}): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    // Build messages array
    const messages: any[] = [];

    // Add conversation history if provided (last 5 messages for context)
    if (params.conversationHistory) {
      for (const msg of params.conversationHistory.slice(-5)) {
        messages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
        });
      }
    }

    // Add system message and current input
    messages.unshift({
      role: "system",
      content: params.systemPrompt,
    });

    messages.push({
      role: "user",
      content: params.input,
    });

    // Call Ollama's OpenAI-compatible endpoint
    const response = await fetch(`${params.ollamaEndpoint}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.modelId,
        messages: messages,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    const responseText = data.choices?.[0]?.message?.content || "";

    return {
      success: true,
      result: {
        response: responseText,
        usage: data.usage || {},
        modelId: params.modelId,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Ollama execution failed: ${error.message}`,
    };
  }
}

/**
 * Execute via Lambda with @app.entrypoint (backup option)
 */
async function executeViaLambda(params: {
  agentCode: string;
  input: string;
  modelId: string;
  tools: any[];
}): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const { LambdaClient, InvokeCommand } = await import("@aws-sdk/client-lambda");

    const client = new LambdaClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const command = new InvokeCommand({
      FunctionName: process.env.AGENT_TEST_LAMBDA_FUNCTION || "agent-builder-test-runner",
      InvocationType: "RequestResponse",
      Payload: JSON.stringify({
        agentCode: params.agentCode, // Contains @app.entrypoint
        input: params.input,
        modelId: params.modelId,
        tools: params.tools,
      }),
    });

    // Execute with timeout
    const response = await Promise.race([
      client.send(command),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Lambda timeout")), 30000)
      )
    ]);

    if (response.FunctionError) {
      const errorPayload = JSON.parse(new TextDecoder().decode(response.Payload));
      return {
        success: false,
        error: `Agent execution failed: ${errorPayload.errorMessage || "unknown error"}`,
      };
    }

    const result = JSON.parse(new TextDecoder().decode(response.Payload));
    return {
      success: true,
      result: { response: result.response || result.body },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}
