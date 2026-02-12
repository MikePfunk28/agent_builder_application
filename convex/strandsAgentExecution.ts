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

      // Model gating: Check if user's tier allows the agent's model provider
      const { isProviderAllowedForTier, isBedrockModelAllowedForTier, getTierConfig } = await import( "./lib/tierConfig" );
      const agentOwner = await ctx.runQuery( internal.users.getInternal, { id: agent.createdBy } );
      const userTier = agentOwner?.tier || "freemium";

      // Burst rate limit: enforce tier-aware per-minute ceiling
      const { checkRateLimit, buildTierRateLimitConfig } = await import( "./rateLimiter" );
      const tierCfg = getTierConfig( userTier );
      const rlCfg = buildTierRateLimitConfig( tierCfg.maxConcurrentTests, "agentExecution" );
      const rlResult = await checkRateLimit( ctx, String( agent.createdBy ), "agentExecution", rlCfg );
      if ( !rlResult.allowed ) {
        return {
          success: false,
          error: rlResult.reason || "Rate limit exceeded. Please wait before running more executions.",
        };
      }
      // Detect Bedrock: honor explicit deploymentType first, then fall back to
      // model-ID pattern matching (Bedrock IDs use prefixes like "anthropic.",
      // "anthropic.", "amazon.", "meta.", "mistral.", "cohere.", "ai21.").
      const isBedrock = agent.deploymentType === "bedrock"
        || ( !agent.deploymentType && /^(us\.|eu\.|apac\.|global\.)?(anthropic|amazon|meta|mistral|cohere|ai21)\./.test( agent.model ) );
      if ( isBedrock && !isProviderAllowedForTier( userTier, "bedrock" ) ) {
        return {
          success: false,
          error: "Bedrock models require a Personal subscription ($5/month). " +
            "Use local Ollama models for free, or upgrade in Settings → Billing.",
        };
      }
      if ( isBedrock && !isBedrockModelAllowedForTier( userTier, agent.model ) ) {
        return {
          success: false,
          error: `Model ${agent.model} is not available on the ${userTier} tier. ` +
            "Upgrade your subscription for access to this model.",
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

      // ─── Token-based metering ───────────────────────────────────────────
      if ( result.tokenUsage ) {
        await ctx.runMutation( internal.stripeMutations.incrementUsageAndReportOverage, {
          userId: agent.createdBy,
          modelId: agent.model,
          inputTokens: result.tokenUsage.inputTokens,
          outputTokens: result.tokenUsage.outputTokens,
        } );
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
  return await executeDirectBedrock( ctx, agent, message, history );
}

async function executeDirectBedrock(
  ctx: ActionCtx,
  agent: AgentDoc,
  message: string,
  history: ConversationMessage[]
): Promise<AgentExecutionResult> {
  const { BedrockRuntimeClient, InvokeModelCommand } =
    await import( "@aws-sdk/client-bedrock-runtime" );

  const client = new BedrockRuntimeClient( {
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  } );

  const messages: Array<{ role: string; content: Array<{ text: string }> }> = [];

  for ( const msg of history ) {
    messages.push( {
      role: msg.role,
      content: [{ text: msg.content }],
    } );
  }

  messages.push( {
    role: "user",
    content: [{ text: message }],
  } );

  const modelId = resolveBedrockModelId( agent.model );

  // Branch payload format by provider: Anthropic Messages API vs generic Bedrock
  const isAnthropicModel = modelId.includes( "anthropic" ) || modelId.includes( "claude" );
  let payload: Record<string, unknown>;

  if ( isAnthropicModel ) {
    payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 4096,
      system: agent.systemPrompt,
      messages: messages,
      temperature: 1,
      thinking: {
        type: "enabled",
        budget_tokens: 3000,
      },
    };
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

  let content = "";
  let reasoning = "";
  const toolCalls: ToolCall[] = [];

  if ( responseBody.content && Array.isArray( responseBody.content ) ) {
    // Anthropic models: content is an array of typed blocks
    for ( const block of responseBody.content ) {
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
    // Meta/Llama models: single generation string
    content = responseBody.generation;
  } else if ( responseBody.outputs && Array.isArray( responseBody.outputs ) ) {
    // Mistral models: outputs array with text fields
    content = responseBody.outputs.map( ( o ) => o.text || "" ).join( "" );
  } else if ( responseBody.generations && Array.isArray( responseBody.generations ) ) {
    // Cohere models: generations array
    content = responseBody.generations.map( ( g ) => g.text || "" ).join( "" );
  } else if ( responseBody.completions && Array.isArray( responseBody.completions ) ) {
    // AI21 models: completions array
    content = responseBody.completions.map( ( c ) => c.data?.text || "" ).join( "" );
  } else if ( responseBody.results && Array.isArray( responseBody.results ) ) {
    // Amazon Titan models: results array
    content = responseBody.results.map( ( r ) => r.outputText || "" ).join( "" );
  } else {
    // Fallback: try to extract text from any field in the response
    // Use the already-parsed `responseBody` and avoid logging raw/sensitive content.
    console.warn( `Unrecognized Bedrock response format for model ${modelId}. Response did not match expected fields.` );
    try {
      if ( typeof responseBody === "string" ) {
        const parsed = JSON.parse( responseBody );
        content = typeof parsed === "string" ? parsed : JSON.stringify( parsed );
      } else if ( responseBody && typeof responseBody === "object" ) {
        // Preserve a JSON representation of the object as the fallback content
        content = JSON.stringify( responseBody );
      } else {
        content = String( responseBody );
      }
    } catch {
      // If JSON.parse fails for some reason, fall back to a best-effort string
      try {
        content = JSON.stringify( responseBody );
      } catch {
        content = String( responseBody );
      }
    }
  }

  // ─── Token extraction for billing ───────────────────────────────────────
  const { extractTokenUsage, estimateTokenUsage } = await import( "./lib/tokenBilling" );
  let tokenUsage = extractTokenUsage( responseBody, modelId );

  // Fallback: estimate from text when provider doesn't return counts
  if ( tokenUsage.totalTokens === 0 ) {
    const inputText = JSON.stringify( payload );
    tokenUsage = estimateTokenUsage( inputText, content );
  }

  return {
    success: true,
    content: content.trim(),
    reasoning: reasoning.trim() || undefined,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    tokenUsage,
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
