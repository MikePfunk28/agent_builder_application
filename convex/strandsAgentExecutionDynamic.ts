/**
 * Strands Agents Execution with Dynamic Model Switching
 * Automatically selects the best model based on conversation complexity
 */

import { action, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  analyzeComplexity,
  calculateComplexityScore,
  selectModel,
  decideModelSwitch,
  type ModelSwitchDecision,
} from "./lib/dynamicModelSwitching";
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
  modelSwitchDecision?: ModelSwitchDecision;
  originalModel?: string;
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

/**
 * Execute agent with dynamic model switching
 */
export const executeAgentWithDynamicModel = action( {
  args: {
    agentId: v.id( "agents" ),
    conversationId: v.optional( v.id( "interleavedConversations" ) ),
    message: v.string(),
    enableModelSwitching: v.optional( v.boolean() ),
    preferCost: v.optional( v.boolean() ),
    preferSpeed: v.optional( v.boolean() ),
    preferCapability: v.optional( v.boolean() ),
  },
  handler: async ( ctx, args ): Promise<AgentExecutionResult> => {
    try {
      const agent = ( await ctx.runQuery( internal.strandsAgentExecution.getAgentInternal, {
        agentId: args.agentId,
      } ) );

      if ( !agent ) {
        throw new Error( "Agent not found" );
      }

      // Get conversation history
      let history: ConversationMessage[] = [];
      if ( args.conversationId ) {
        history = ( await ctx.runQuery( internal.interleavedReasoning.getConversationHistory, {
          conversationId: args.conversationId,
          windowSize: 10,
        } ) ) as ConversationMessage[];
      }

      // Get user tier for model switching decisions
      const user = await ctx.runQuery( internal.users.getInternal, { id: agent.createdBy } );
      const userTier = ( user?.tier as "freemium" | "personal" | "enterprise" ) || "freemium";

      // Burst rate limit: enforce tier-aware per-minute ceiling
      const { checkRateLimit, buildTierRateLimitConfig } = await import( "./rateLimiter" );
      const { isProviderAllowedForTier, getTierConfig: getTierCfg } = await import( "./lib/tierConfig" );
      const tierCfg = getTierCfg( userTier );
      const rlCfg = buildTierRateLimitConfig( tierCfg.maxConcurrentTests, "agentExecution" );
      const rlResult = await checkRateLimit( ctx, String( agent.createdBy ), "agentExecution", rlCfg );
      if ( !rlResult.allowed ) {
        return {
          success: false,
          error: rlResult.reason || "Rate limit exceeded. Please wait before running more executions.",
        };
      }

      // Model gating: Block freemium users from Bedrock models.
      // Positively detect Ollama models so Bedrock IDs with colons (e.g.
      // "anthropic.claude-haiku-4-5-20251001-v1:0") are not misclassified.
      const isOllamaModel = agent.deploymentType === "ollama"
        || agent.model.toLowerCase().includes( "ollama" )
        || ( !agent.deploymentType && !agent.model.includes( "." ) && agent.model.includes( ":" ) );
      const isBedrock = !isOllamaModel;
      if ( isBedrock && !isProviderAllowedForTier( userTier, "bedrock" ) ) {
        return {
          success: false,
          error: "Bedrock models require a Personal subscription ($5/month). " +
            "Use local Ollama models for free, or upgrade in Settings → Billing.",
        };
      }

      // Execute with or without dynamic model switching
      let result: AgentExecutionResult;
      if ( args.enableModelSwitching === false ) {
        result = await executeDirectBedrock( ctx, agent, args.message, history );
      } else {
        result = await executeWithModelSwitching( ctx, agent, args.message, history, {
          preferCost: args.preferCost,
          preferSpeed: args.preferSpeed,
          preferCapability: args.preferCapability,
          userTier,
        } );
      }

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

/**
 * Execute with dynamic model switching
 */
async function executeWithModelSwitching(
  ctx: ActionCtx,
  agent: AgentDoc,
  message: string,
  history: ConversationMessage[],
  options: {
    preferCost?: boolean;
    preferSpeed?: boolean;
    preferCapability?: boolean;
    userTier: "freemium" | "personal" | "enterprise";
  }
): Promise<AgentExecutionResult> {
  // Convert conversation history to simple format for analysis
  const historyForAnalysis = history.map( ( msg ) => ( {
    role: msg.role,
    content: msg.content,
  } ) );

  // Make model switching decision
  const decision = decideModelSwitch( message, historyForAnalysis, agent, options );

  console.log( `[ModelSwitcher] Complexity: ${decision.complexityScore}/100` );
  console.log( `[ModelSwitcher] Selected: ${decision.selectedModel.name}` );
  console.log( `[ModelSwitcher] Reasoning: ${decision.reasoning}` );
  console.log( `[ModelSwitcher] Estimated cost: $${decision.estimatedCost.toFixed( 4 )}` );

  // Execute with selected model
  const result = await executeDirectBedrock(
    ctx,
    agent,
    message,
    history,
    decision.selectedModel.modelId
  );

  // Add decision metadata to result
  if ( result.success && result.metadata ) {
    result.metadata.modelSwitchDecision = decision;
    result.metadata.originalModel = agent.model;
  }

  return result;
}

/**
 * Execute via direct Bedrock API
 */
async function executeDirectBedrock(
  ctx: ActionCtx,
  agent: AgentDoc,
  message: string,
  history: ConversationMessage[],
  overrideModelId?: string
): Promise<AgentExecutionResult> {
  const { BedrockRuntimeClient, InvokeModelCommand } = await import(
    "@aws-sdk/client-bedrock-runtime"
  );

  const client = new BedrockRuntimeClient( {
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  } );

  const messages: Array<{ role: string; content: Array<{ text: string }> }> = [];

  for ( const msg of history ) {
    // Only include user and assistant roles in messages array;
    // system messages go to top-level system field, tool messages are skipped
    if ( msg.role === "user" || msg.role === "assistant" ) {
      messages.push( {
        role: msg.role,
        content: [{ text: msg.content }],
      } );
    }
  }

  messages.push( {
    role: "user",
    content: [{ text: message }],
  } );

  // Use override model if provided, otherwise use agent's model
  const modelId = resolveBedrockModelId( overrideModelId || agent.model );

  // Only include Claude/Anthropic-specific fields when using an Anthropic model
  const isAnthropicModel = modelId.includes( "anthropic" ) || modelId.includes( "claude" );

  // Branch payload format by provider: Anthropic Messages API vs generic Bedrock
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
      // Meta Llama format
      payload = {
        prompt: `${systemPrefix}${promptText}\nassistant:`,
        max_gen_len: 4096,
        temperature: 0.7,
      };
    } else if ( modelId.includes( "mistral" ) ) {
      // Mistral format
      payload = {
        prompt: `<s>[INST] ${systemPrefix}${promptText} [/INST]`,
        max_tokens: 4096,
        temperature: 0.7,
      };
    } else {
      // Generic Bedrock model fallback (Cohere, AI21, etc.)
      payload = {
        prompt: `${systemPrefix}${promptText}\nassistant:`,
        max_tokens: 4096,
        temperature: 0.7,
      };
    }
  }

  const command = new InvokeModelCommand( {
    modelId: modelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify( payload ),
  } );

  const response = await client.send( command );
  const responseBody = JSON.parse( new TextDecoder().decode( response.body ) ) as BedrockInvokeResponse;

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
    content = responseBody.outputs.map( ( o: any ) => o.text || "" ).join( "" );
  } else if ( responseBody.generations && Array.isArray( responseBody.generations ) ) {
    // Cohere models: generations array
    content = responseBody.generations.map( ( g: any ) => g.text || "" ).join( "" );
  } else if ( responseBody.completions && Array.isArray( responseBody.completions ) ) {
    // AI21 models: completions array
    content = responseBody.completions.map( ( c: any ) => c.data?.text || "" ).join( "" );
  } else if ( responseBody.results && Array.isArray( responseBody.results ) ) {
    // Amazon Titan models: results array
    content = responseBody.results.map( ( r: any ) => r.outputText || "" ).join( "" );
  } else {
    // Fallback: try to extract text from any string field in the response
    const raw = new TextDecoder().decode( response.body );
    console.warn( `Unrecognized Bedrock response format for model ${modelId}. Raw preview: ${raw.slice( 0, 200 )}` );
    // Attempt to use the raw body as text if it looks like a plain string
    try {
      const parsed = JSON.parse( raw );
      content = typeof parsed === "string" ? parsed : JSON.stringify( parsed );
    } catch {
      content = raw;
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
