/**
 * Strands Agents Execution - Proper Integration with AgentCore Sandbox
 * Uses @app.entrypoint pattern like production deployments
 */

import { action, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { resolveBedrockModelId } from "./modelRegistry";

type AgentDoc = Doc<"agents">;

type ConversationMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: number;
  reasoning?: string;
  toolCalls?: unknown;
};

type ToolCall = {
  id?: string;
  name?: string;
  input?: unknown;
};

type AgentExecutionMetadata = {
  model: string;
  modelProvider: string;
  executionMethod: "agentcore" | "direct-bedrock-api";
};

interface AgentExecutionBase {
  success: boolean;
  metadata?: AgentExecutionMetadata;
  content?: string;
  error?: string;
  reasoning?: string;
  toolCalls?: ToolCall[];
  tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number };
}

type AgentExecutionSuccess = AgentExecutionBase & {
  success: true;
  content: string;
  reasoning?: string;
  toolCalls?: ToolCall[];
};

type AgentExecutionFailure = AgentExecutionBase & {
  success: false;
  error: string;
};

type AgentExecutionResult = AgentExecutionSuccess | AgentExecutionFailure;

type ConversationCreateResult = {
  conversationId: Id<"interleavedConversations">;
  conversationToken?: string;
};

type BedrockContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | { type: "tool_use"; id?: string; name?: string; input?: unknown }
  | { type: string;[key: string]: unknown };

type BedrockInvokeResponse = {
  content?: BedrockContentBlock[];
  // Meta/Llama
  generation?: string;
  // Mistral
  outputs?: Array<{ text?: string }>;
  // Cohere
  generations?: Array<{ text?: string }>;
  // AI21
  completions?: Array<{ data?: { text?: string } }>;
  // Amazon Titan
  results?: Array<{ outputText?: string }>;
};

export const executeAgentWithStrandsAgents = action( {
  args: {
    agentId: v.id( "agents" ),
    conversationId: v.optional( v.id( "interleavedConversations" ) ),
    message: v.string(),
  },
  handler: async ( ctx, args ): Promise<AgentExecutionResult> => {
    try {
      const agent = ( await ctx.runQuery( internal.strandsAgentExecution.getAgentInternal, {
        agentId: args.agentId,
      } ) );

      if ( !agent ) {
        throw new Error( "Agent not found" );
      }

      // Model gating: Full payment status + tier verification via bedrockGate
      const agentOwner = await ctx.runQuery( internal.users.getInternal, { id: agent.createdBy } );
      const userTier = agentOwner?.tier || "freemium";

      // Detect Bedrock: honor explicit deploymentType first, then fall back to
      // model-ID pattern matching (Bedrock IDs use prefixes like "anthropic.",
      // "amazon.", "meta.", "mistral.", "cohere.", "ai21.").
      const isBedrock = agent.deploymentType === "bedrock"
        || ( !agent.deploymentType && /^(us\.|eu\.|apac\.|global\.)?(anthropic|amazon|meta|mistral|cohere|ai21)\./.test( agent.model ) );

      // PAYMENT + TIER GATE: Full payment status verification via bedrockGate
      // (checks: anonymous, subscription status, expiration, provider, model family, limits)
      if ( isBedrock ) {
        const { requireBedrockAccessForUser } = await import( "./lib/bedrockGate" );
        const gateResult = await requireBedrockAccessForUser( agentOwner, agent.model );
        if ( !gateResult.allowed ) {
          return { success: false, error: gateResult.reason };
        }
      }

      // Burst rate limit: enforce tier-aware per-minute ceiling
      const { checkRateLimit, buildTierRateLimitConfig } = await import( "./rateLimiter" );
      const { getTierConfig } = await import( "./lib/tierConfig" );
      const tierCfg = getTierConfig( userTier );
      const rlCfg = buildTierRateLimitConfig( tierCfg.maxConcurrentTests, "agentExecution" );
      const rlResult = await checkRateLimit( ctx, String( agent.createdBy ), "agentExecution", rlCfg );
      if ( !rlResult.allowed ) {
        return {
          success: false,
          error: rlResult.reason || "Rate limit exceeded. Please wait before running more executions.",
        };
      }

      let history: ConversationMessage[] = [];
      if ( args.conversationId ) {
        history = ( await ctx.runQuery( internal.interleavedReasoning.getConversationHistory, {
          conversationId: args.conversationId,
          windowSize: 10,
        } ) ) as ConversationMessage[];
      }

      const result = await executeViaAgentCore( ctx, agent, args.message, history );

      // ─── Token-based metering (non-fatal) ────────────────────────────────
      if ( result.tokenUsage ) {
        try {
          await ctx.runMutation( internal.stripeMutations.incrementUsageAndReportOverage, {
            userId: agent.createdBy,
            modelId: agent.model,
            inputTokens: result.tokenUsage.inputTokens,
            outputTokens: result.tokenUsage.outputTokens,
          } );
        } catch ( billingErr ) {
          console.error( "strandsAgentExecution: billing failed (non-fatal)", {
            userId: agent.createdBy, modelId: agent.model,
            inputTokens: result.tokenUsage.inputTokens,
            outputTokens: result.tokenUsage.outputTokens,
            error: billingErr instanceof Error ? billingErr.message : billingErr,
          } );
        }
      }

      return result;
    } catch ( error: unknown ) {
      console.error( "Agent execution error:", error );
      const message = error instanceof Error ? error.message : "Agent execution failed";
      return {
        success: false,
        error: message,
      };
    }
  },
} );

async function executeViaAgentCore(
  ctx: ActionCtx,
  agent: AgentDoc,
  message: string,
  history: ConversationMessage[]
): Promise<AgentExecutionResult> {
  // Load agent's skills from dynamicTools table (if configured)
  const agentSkills: import( "./lib/toolDispatch" ).SkillDefinition[] = [];

  // Type-safe access to optional skills array on agent document
  const skills = ( agent as { skills?: Array<{ skillId?: string; enabled?: boolean }> } ).skills;
  if ( skills && Array.isArray( skills ) ) {
    // Load full skill definitions for enabled skills
    const enabledSkills = skills.filter(
      ( s ) => s.enabled !== false,
    );
    for ( const skillRef of enabledSkills ) {
      if ( skillRef.skillId ) {
        // Load from dynamicTools table
        const skillDoc = await ctx.runQuery( internal.metaTooling.getSkillById, {
          skillId: skillRef.skillId as import( "./_generated/dataModel" ).Id<"dynamicTools">,
        } );
        if ( skillDoc?.skillType && skillDoc?.toolDefinition ) {
          agentSkills.push( {
            skillType: skillDoc.skillType,
            name: skillDoc.name,
            skillConfig: skillDoc.skillConfig,
            toolDefinition: skillDoc.toolDefinition,
            skillInstructions: skillDoc.skillInstructions,
          } );
        }
      }
    }
  }

  const thinkingLevel = (agent as unknown as { thinkingLevel?: string }).thinkingLevel as "low" | "medium" | "high" | undefined;

  return await executeDirectBedrock( ctx, agent, message, history, agentSkills, thinkingLevel );
}

async function executeDirectBedrock(
  ctx: ActionCtx,
  agent: AgentDoc,
  message: string,
  history: ConversationMessage[],
  agentSkills: import( "./lib/toolDispatch" ).SkillDefinition[] = [],
  thinkingLevel?: "low" | "medium" | "high",
): Promise<AgentExecutionResult> {
  const { BedrockRuntimeClient, InvokeModelCommand } =
    await import( "@aws-sdk/client-bedrock-runtime" );
  const {
    dispatchToolCall, buildToolsArray, mapThinkingLevelToPayload,
    accumulateTokenUsage, MAX_TOOL_LOOP_ITERATIONS, buildToolResultMessages,
  } = await import( "./lib/toolDispatch" );

  const client = new BedrockRuntimeClient( {
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  } );

  const messages: Array<{ role: string; content: any }> = [];

  for ( const msg of history ) {
    messages.push( {
      role: msg.role,
      content: [{ type: "text", text: msg.content }],
    } );
  }

  messages.push( {
    role: "user",
    content: [{ type: "text", text: message }],
  } );

  const modelId = resolveBedrockModelId( agent.model );

  // Branch payload format by provider: Anthropic Messages API vs generic Bedrock
  const isAnthropicModel = modelId.includes( "anthropic" ) || modelId.includes( "claude" );
  let payload: Record<string, unknown>;

  if ( isAnthropicModel ) {
    // Determine thinking config via shared helper (handles undefined → empty, non-Claude → empty)
    const thinkingConfig = mapThinkingLevelToPayload( thinkingLevel || "low", modelId );

    payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 4096,
      system: agent.systemPrompt,
      messages: messages,
      temperature: 1,
      ...thinkingConfig,
    };

    // Add tools array when agent has skills configured (Anthropic tool_use protocol)
    if ( agentSkills.length > 0 ) {
      payload.tools = buildToolsArray( agentSkills );
    }
  } else {
    // Non-Anthropic Bedrock models (Llama, Mistral, etc.) use a plain
    // prompt-based payload compatible with InvokeModelCommand.
    const promptText = messages.map(
      ( m: { role: string; content: Array<{ text: string }> } ) =>
        `${m.role}: ${m.content.map( ( c ) => c.text ).join( "" )}`
    ).join( "\n" );
    const systemPrefix = agent.systemPrompt ? `system: ${agent.systemPrompt}\n` : "";

    if ( modelId.includes( "meta" ) || modelId.includes( "llama" ) ) {
      payload = {
        prompt: `${systemPrefix}${promptText}\nassistant:`,
        max_gen_len: 4096,
        temperature: 0.7,
      };
    } else if ( modelId.includes( "mistral" ) ) {
      payload = {
        prompt: `<s>[INST] ${systemPrefix}${promptText} [/INST]`,
        max_tokens: 4096,
        temperature: 0.7,
      };
    } else {
      // Generic Bedrock model fallback (Cohere, AI21, Titan, etc.)
      // Amazon Titan requires a different payload shape: use `inputText`
      // and wrap generation options in `textGenerationConfig` with
      // `maxTokenCount` (replacing `max_tokens`) and `temperature`.
      const isTitan = modelId.toLowerCase().includes( "titan" );

      if ( isTitan ) {
        // Titan-compatible payload
        payload = {
          inputText: `${systemPrefix}${promptText}`,
          textGenerationConfig: {
            maxTokenCount: 4096,
            temperature: 0.7,
          },
        };
      } else {
        // Existing prompt/max_tokens shape for other Bedrock providers
        payload = {
          prompt: `${systemPrefix}${promptText}\nassistant:`,
          max_tokens: 4096,
          temperature: 0.7,
        };
      }
    }
  }

  // ─── Agent Loop: call model → execute tools → feed results back ────────
  // When the agent has NO skills, this runs once (existing behavior).
  // When the agent HAS skills, it loops until stop_reason is "end_turn"
  // or MAX_TOOL_LOOP_ITERATIONS is reached.
  const { extractTokenUsage, estimateTokenUsage } = await import( "./lib/tokenBilling" );
  const accumulatedTokens = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let finalContent = "";
  let finalReasoning = "";
  let finalToolCalls: ToolCall[] = [];
  const hasSkills = agentSkills.length > 0 && isAnthropicModel;

  for ( let iteration = 0; iteration < MAX_TOOL_LOOP_ITERATIONS; iteration++ ) {
    const command = new InvokeModelCommand( {
      modelId: modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify( payload ),
    } );

    const response = await client.send( command );
    const responseBody = JSON.parse(
      new TextDecoder().decode( response.body )
    ) as BedrockInvokeResponse;

    // ─── Token extraction per iteration ─────────────────────────────────
    let iterationTokens = extractTokenUsage( responseBody, modelId );
    if ( iterationTokens.totalTokens === 0 ) {
      iterationTokens = estimateTokenUsage( JSON.stringify( payload ), JSON.stringify( responseBody ) );
    }
    accumulateTokenUsage( accumulatedTokens, iterationTokens );

    // ─── Parse response ─────────────────────────────────────────────────
    let content = "";
    let reasoning = "";
    const toolCalls: ToolCall[] = [];
    const assistantContentBlocks: Array<{ type: string;[key: string]: any }> = [];

    if ( responseBody.content && Array.isArray( responseBody.content ) ) {
      // Anthropic models: content is an array of typed blocks
      for ( const block of responseBody.content ) {
        assistantContentBlocks.push( block );
        if ( block.type === "text" ) {
          content += block.text;
        } else if ( block.type === "thinking" ) {
          reasoning += block.thinking;
        } else if ( block.type === "tool_use" ) {
          const id = typeof block.id === "string" ? block.id : undefined;
          const name = typeof block.name === "string" ? block.name : undefined;
          toolCalls.push( {
            id,
            name,
            input: block.input,
          } );
        }
      }
    } else if ( typeof responseBody.generation === "string" ) {
      content = responseBody.generation;
    } else if ( responseBody.outputs && Array.isArray( responseBody.outputs ) ) {
      content = responseBody.outputs.map( ( o ) => o.text || "" ).join( "" );
    } else if ( responseBody.generations && Array.isArray( responseBody.generations ) ) {
      content = responseBody.generations.map( ( g ) => g.text || "" ).join( "" );
    } else if ( responseBody.completions && Array.isArray( responseBody.completions ) ) {
      content = responseBody.completions.map( ( c ) => c.data?.text || "" ).join( "" );
    } else if ( responseBody.results && Array.isArray( responseBody.results ) ) {
      content = responseBody.results.map( ( r ) => r.outputText || "" ).join( "" );
    } else {
      console.warn( `Unrecognized Bedrock response format for model ${modelId}. Response did not match expected fields.` );
      try {
        if ( typeof responseBody === "string" ) {
          const parsed = JSON.parse( responseBody );
          content = typeof parsed === "string" ? parsed : JSON.stringify( parsed );
        } else if ( responseBody && typeof responseBody === "object" ) {
          content = JSON.stringify( responseBody );
        } else {
          content = String( responseBody );
        }
      } catch {
        try {
          content = JSON.stringify( responseBody );
        } catch {
          content = String( responseBody );
        }
      }
    }

    // Accumulate text and reasoning across iterations
    if ( content ) finalContent = content; // Last iteration's text wins
    if ( reasoning ) finalReasoning += ( finalReasoning ? "\n---\n" : "" ) + reasoning;

    // ─── Agent Loop: Execute tool calls if agent has skills ──────────────
    if ( hasSkills && toolCalls.length > 0 ) {
      // Execute each tool call via shared dispatch
      const toolResults: import( "./lib/toolDispatch" ).ToolResult[] = [];
      for ( const tc of toolCalls ) {
        if ( !tc.id || !tc.name ) continue;
        const result = await dispatchToolCall(
          ctx, tc.name, ( tc.input as Record<string, any> ) || {},
          agentSkills, agent.createdBy,
        );
        toolResults.push( {
          toolUseId: tc.id,
          output: result.success ? result.output : ( result.error || "Tool execution failed" ),
          isError: !result.success,
        } );
      }

      // Build assistant + tool_result messages and append to conversation
      const loopMessages = buildToolResultMessages( assistantContentBlocks, toolResults );
      // Update payload messages for the next iteration
      const currentMessages = ( payload.messages as any[] ) || [];
      payload.messages = [...currentMessages, ...loopMessages];

      // Continue the loop — model will see tool results and respond
      continue;
    }

    // No tool calls (or no skills) — we're done, break out of loop
    finalToolCalls = toolCalls;
    break;
  }

  // Warn if the tool loop hit the safety limit without natural completion
  if ( hasSkills && finalToolCalls.length === 0 && finalContent === "" ) {
    console.warn( `Agent ${agent._id} hit MAX_TOOL_LOOP_ITERATIONS (${MAX_TOOL_LOOP_ITERATIONS}) without natural completion` );
  }

  return {
    success: true,
    content: finalContent.trim(),
    reasoning: finalReasoning.trim() || undefined,
    toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
    tokenUsage: accumulatedTokens,
    metadata: {
      model: modelId,
      modelProvider: "bedrock",
      executionMethod: "direct-bedrock-api",
    },
  };
}

export const getAgentInternal = internalQuery( {
  args: {
    agentId: v.id( "agents" ),
  },
  handler: async ( ctx, args ): Promise<AgentDoc | null> => {
    const agent = ( await ctx.db.get( args.agentId ) );
    return agent;
  },
} );

export const testAgentExecution = action( {
  args: {
    agentId: v.id( "agents" ),
    testMessage: v.optional( v.string() ),
  },
  handler: async ( ctx, args ): Promise<
    AgentExecutionResult & {
      testMessage: string;
      conversationId: Id<"interleavedConversations">;
    }
  > => {
    const testMessage = args.testMessage || "Hello! Please introduce yourself and list your available tools.";

    const conversation = ( await ctx.runMutation( api.interleavedReasoning.createConversation, {
      title: "Agent Test",
      systemPrompt: "Test conversation",
    } ) ) as ConversationCreateResult;

    const result = ( await ctx.runAction( api.strandsAgentExecution.executeAgentWithStrandsAgents, {
      agentId: args.agentId,
      conversationId: conversation.conversationId,
      message: testMessage,
    } ) );

    return {
      ...result,
      testMessage,
      conversationId: conversation.conversationId,
    };
  },
} );

/**
 * Iterative Agent Execution — Ralphy-pattern persistent loop.
 *
 * Repeatedly invokes executeAgentWithStrandsAgents with the same task until
 * the completion criteria are met or maxIterations is reached.
 * Each iteration feeds the previous output as context to the next.
 *
 * REUSES executeAgentWithStrandsAgents — no Bedrock call duplication.
 */
export const executeIterativeAgent = action( {
  args: {
    agentId: v.id( "agents" ),
    conversationId: v.optional( v.id( "interleavedConversations" ) ),
    message: v.string(),
    maxIterations: v.optional( v.number() ),
    completionCriteria: v.optional( v.object( {
      type: v.union(
        v.literal( "tests_pass" ),
        v.literal( "no_errors" ),
        v.literal( "llm_judgment" ),
        v.literal( "max_iterations" ),
      ),
      successPattern: v.optional( v.string() ),
    } ) ),
  },
  handler: async ( ctx, args ): Promise<{
    success: boolean;
    iterations: Array<{ iteration: number; content: string; success: boolean }>;
    totalIterations: number;
    completionReason: string;
    finalContent: string;
    totalTokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number };
  }> => {
    const {
      checkCompletionCriteria,
      buildContinuationPrompt,
      DEFAULT_MAX_ITERATIONS,
      ABSOLUTE_MAX_ITERATIONS,
    } = await import( "./lib/iterativeLoop" );

    const maxIter = Math.min(
      Math.max( 1, args.maxIterations ?? DEFAULT_MAX_ITERATIONS ),
      ABSOLUTE_MAX_ITERATIONS,
    );
    const criteria = args.completionCriteria ?? { type: "no_errors" as const };

    const iterations: Array<{ iteration: number; content: string; success: boolean }> = [];
    let totalTokens = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let currentMessage = args.message;
    let completionReason = `Reached max iterations (${maxIter})`;

    // Create conversation if not provided
    let conversationId = args.conversationId;
    if ( !conversationId ) {
      const conversation = ( await ctx.runMutation( api.interleavedReasoning.createConversation, {
        title: "Iterative Agent Loop",
        systemPrompt: "Iterative execution session",
      } ) ) as ConversationCreateResult;
      conversationId = conversation.conversationId;
    }

    for ( let i = 1; i <= maxIter; i++ ) {
      // Execute one turn via the existing action
      const result = ( await ctx.runAction( api.strandsAgentExecution.executeAgentWithStrandsAgents, {
        agentId: args.agentId,
        conversationId,
        message: currentMessage,
      } ) );

      const content = result.success ? ( result.content || "" ) : ( result.error || "Execution failed" );

      iterations.push( {
        iteration: i,
        content,
        success: result.success,
      } );

      // Accumulate token usage
      if ( result.tokenUsage ) {
        totalTokens.inputTokens += result.tokenUsage.inputTokens;
        totalTokens.outputTokens += result.tokenUsage.outputTokens;
        totalTokens.totalTokens += result.tokenUsage.totalTokens;
      }

      // Check completion criteria
      const check = checkCompletionCriteria( criteria, {
        success: result.success,
        content,
      } );

      if ( check.isComplete ) {
        completionReason = check.reason || "Completion criteria met";
        break;
      }

      // For llm_judgment: check if the agent itself said "TASK COMPLETE"
      if ( criteria.type === "llm_judgment" && content.includes( "TASK COMPLETE" ) ) {
        completionReason = "Agent declared task complete";
        break;
      }

      // Build continuation prompt for next iteration
      if ( i < maxIter ) {
        currentMessage = buildContinuationPrompt(
          args.message,
          content,
          i + 1,
          maxIter,
        );
      }
    }

    const finalContent = iterations.at( -1 )?.content ?? "";

    return {
      success: iterations.at( -1 )?.success ?? false,
      iterations,
      totalIterations: iterations.length,
      completionReason,
      finalContent,
      totalTokenUsage: totalTokens,
    };
  },
} );
