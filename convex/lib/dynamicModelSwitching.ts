/**
 * Dynamic Model Switching for StrandsAgents
 *
 * Automatically switches between models based on conversation complexity:
 * - Simple queries → Haiku (fast, cheap)
 * - Complex reasoning → Sonnet (slower, more capable)
 * - Multi-step tasks → Opus (slowest, most capable)
 *
 * This wraps the model call in the agent decorator to enable intelligent routing.
 */

import type { Doc } from "../_generated/dataModel";
import { BEDROCK_MODELS } from "../modelRegistry";

type AgentDoc = Doc<"agents">;

/**
 * Model tier configuration
 */
export interface ModelTier {
  name: string;
  modelId: string;
  costPer1KInput: number; // USD
  costPer1KOutput: number; // USD
  maxTokens: number;
  speedRating: 1 | 2 | 3; // 1 = fast, 3 = slow
  capabilityRating: 1 | 2 | 3; // 1 = basic, 3 = advanced
}

/**
 * Helper: derive cost-per-1K-tokens from the authoritative registry (costPer1MTokens).
 */
function costPer1K(modelId: string): { input: number; output: number } {
  const meta = BEDROCK_MODELS[modelId];
  if (meta?.costPer1MTokens) {
    return {
      input: meta.costPer1MTokens.input / 1000,
      output: meta.costPer1MTokens.output / 1000,
    };
  }
  // Fallback — should not happen for models listed below
  return { input: 0, output: 0 };
}

// Registry model IDs — single source of truth
const HAIKU_ID = "anthropic.claude-haiku-4-5-20251001-v1:0";
const SONNET_ID = "anthropic.claude-sonnet-4-5-20250929-v1:0";

/**
 * Available model tiers.
 *
 * Model IDs and cost are derived from modelRegistry.ts (BEDROCK_MODELS).
 * Claude 3.5 Sonnet was removed from the registry; the "sonnet" balanced
 * tier now references Sonnet 4.5 with a capped capabilityRating of 2 to
 * preserve the 3-tier routing logic (haiku=1, sonnet=2, sonnet45=3).
 */
export const MODEL_TIERS: Record<string, ModelTier> = {
  // Fast & Cheap
  haiku: {
    name: BEDROCK_MODELS[HAIKU_ID]?.name ?? "Claude 4.5 Haiku",
    modelId: HAIKU_ID,
    costPer1KInput: costPer1K(HAIKU_ID).input,
    costPer1KOutput: costPer1K(HAIKU_ID).output,
    maxTokens: BEDROCK_MODELS[HAIKU_ID]?.maxOutput ?? 8192,
    speedRating: 1,
    capabilityRating: 1,
  },

  // Balanced (Sonnet 4.5 at capability-2 for tier routing)
  sonnet: {
    name: BEDROCK_MODELS[SONNET_ID]?.name ?? "Claude 4.5 Sonnet",
    modelId: SONNET_ID,
    costPer1KInput: costPer1K(SONNET_ID).input,
    costPer1KOutput: costPer1K(SONNET_ID).output,
    maxTokens: BEDROCK_MODELS[SONNET_ID]?.maxOutput ?? 8192,
    speedRating: 2,
    capabilityRating: 2,
  },

  // Capable (highest auto-selectable tier — Opus is too expensive for auto-selection)
  sonnet45: {
    name: BEDROCK_MODELS[SONNET_ID]?.name ?? "Claude 4.5 Sonnet",
    modelId: SONNET_ID,
    costPer1KInput: costPer1K(SONNET_ID).input,
    costPer1KOutput: costPer1K(SONNET_ID).output,
    maxTokens: BEDROCK_MODELS[SONNET_ID]?.maxOutput ?? 8192,
    speedRating: 2,
    capabilityRating: 3,
  },
};

/**
 * Complexity signals detected in messages
 */
export interface ComplexitySignals {
  // Message characteristics
  messageLength: number;
  hasCodeBlocks: boolean;
  hasMultipleQuestions: boolean;
  hasMath: boolean;
  hasLogicalReasoning: boolean;

  // Conversation characteristics
  conversationLength: number;
  toolCallsInHistory: number;
  failedAttempts: number;

  // Explicit indicators
  userRequestedThinking: boolean;
  userRequestedStepByStep: boolean;
  previousModelFailed: boolean;
}

/**
 * Analyze conversation complexity
 */
export function analyzeComplexity(
  message: string,
  conversationHistory: Array<{ role: string; content: string }> = []
): ComplexitySignals {
  const lowerMessage = message.toLowerCase();

  // Message characteristics
  const messageLength = message.length;
  const hasCodeBlocks = message.includes( "```" ) || message.includes( "`" );
  const hasMultipleQuestions = ( message.match( /\?/g ) || [] ).length > 1;
  const hasMath = /\d+[\+\-\*\/]\d+|equation|formula|calculate/.test( lowerMessage );
  const hasLogicalReasoning = /because|therefore|if.*then|prove|explain why|analyze|compare/.test( lowerMessage );

  // Conversation characteristics
  const conversationLength = conversationHistory.length;
  const toolCallsInHistory = conversationHistory.filter( ( msg ) =>
    msg.role === "assistant" && msg.content.includes( "tool_use" )
  ).length;
  const failedAttempts = conversationHistory.filter( ( msg ) =>
    msg.role === "assistant" && ( msg.content.includes( "error" ) || msg.content.includes( "failed" ) )
  ).length;

  // Explicit indicators
  const userRequestedThinking = /think step by step|reason through|explain your thinking|show your work/.test(
    lowerMessage
  );
  const userRequestedStepByStep = /step by step|break it down|detailed explanation/.test( lowerMessage );
  const previousModelFailed = failedAttempts > 0;

  return {
    messageLength,
    hasCodeBlocks,
    hasMultipleQuestions,
    hasMath,
    hasLogicalReasoning,
    conversationLength,
    toolCallsInHistory,
    failedAttempts,
    userRequestedThinking,
    userRequestedStepByStep,
    previousModelFailed,
  };
}

/**
 * Calculate complexity score (0-100)
 */
export function calculateComplexityScore( signals: ComplexitySignals ): number {
  let score = 0;

  // Message length (0-20 points)
  if ( signals.messageLength > 1000 ) score += 20;
  else if ( signals.messageLength > 500 ) score += 15;
  else if ( signals.messageLength > 200 ) score += 10;
  else score += 5;

  // Code blocks (10 points)
  if ( signals.hasCodeBlocks ) score += 10;

  // Multiple questions (10 points)
  if ( signals.hasMultipleQuestions ) score += 10;

  // Math (5 points)
  if ( signals.hasMath ) score += 5;

  // Logical reasoning (15 points)
  if ( signals.hasLogicalReasoning ) score += 15;

  // Conversation length (0-15 points)
  if ( signals.conversationLength > 10 ) score += 15;
  else if ( signals.conversationLength > 5 ) score += 10;
  else if ( signals.conversationLength > 2 ) score += 5;

  // Tool calls (10 points)
  if ( signals.toolCallsInHistory > 2 ) score += 10;
  else if ( signals.toolCallsInHistory > 0 ) score += 5;

  // Failed attempts (15 points - escalate to better model)
  if ( signals.failedAttempts > 1 ) score += 15;
  else if ( signals.failedAttempts > 0 ) score += 10;

  // Explicit indicators (20 points each)
  if ( signals.userRequestedThinking ) score += 20;
  if ( signals.userRequestedStepByStep ) score += 20;
  if ( signals.previousModelFailed ) score += 20;

  return Math.min( score, 100 );
}

/**
 * Select optimal model based on complexity
 */
export function selectModel(
  complexityScore: number,
  _agent: AgentDoc,
  options: {
    preferCost?: boolean; // Prefer cheaper models
    preferSpeed?: boolean; // Prefer faster models
    preferCapability?: boolean; // Prefer more capable models
    userTier?: "freemium" | "personal" | "enterprise";
  } = {}
): ModelTier {
  const { preferCost = false, preferSpeed = false, preferCapability = false, userTier = "freemium" } = options;

  // All tiers are Bedrock models — Ollama agents use their own execution path
  // and should not go through dynamic model switching.
  const availableModels = [MODEL_TIERS.haiku, MODEL_TIERS.sonnet, MODEL_TIERS.sonnet45];

  // Freemium users are limited to free models. For now we return the fast
  // Haiku tier (`MODEL_TIERS.haiku`) as the informational selection. Note
  // that actual Bedrock execution for freemium users is gated elsewhere via
  // tier checks (see `isProviderAllowedForTier`).
  if ( userTier === "freemium" ) {
    return MODEL_TIERS.haiku;
  }

  // Complexity-based routing with preference adjustments
  let candidateIndex: number;
  if ( complexityScore < 30 ) {
    candidateIndex = 0; // Simple → Haiku
  } else if ( complexityScore < 60 ) {
    candidateIndex = 1; // Moderate → Sonnet
  } else {
    candidateIndex = 2; // High → Opus-tier
  }

  // Apply preference bias (at most ±1 adjustment to avoid overshooting)
  const costOrSpeedBias = ( preferCost || preferSpeed ) ? -1 : 0;
  const capabilityBias = preferCapability ? 1 : 0;
  candidateIndex = Math.max( 0, Math.min( availableModels.length - 1, candidateIndex + costOrSpeedBias + capabilityBias ) );

  return availableModels[Math.min( candidateIndex, availableModels.length - 1 )];
}

/**
 * Model switching decision with explanation
 */
export interface ModelSwitchDecision {
  selectedModel: ModelTier;
  complexityScore: number;
  reasoning: string;
  estimatedCost: number;
  signals: ComplexitySignals;
}

/**
 * Make model switching decision
 */
export function decideModelSwitch(
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
  agent: AgentDoc,
  options: {
    preferCost?: boolean;
    preferSpeed?: boolean;
    preferCapability?: boolean;
    userTier?: "freemium" | "personal" | "enterprise";
  } = {}
): ModelSwitchDecision {
  // Analyze complexity
  const signals = analyzeComplexity( message, conversationHistory );
  const complexityScore = calculateComplexityScore( signals );

  // Select model
  const selectedModel = selectModel( complexityScore, agent, options );

  // Calculate estimated cost (assuming ~500 tokens input, ~500 tokens output)
  const estimatedCost =
    ( 500 / 1000 ) * selectedModel.costPer1KInput + ( 500 / 1000 ) * selectedModel.costPer1KOutput;

  // Generate reasoning
  let reasoning = `Complexity score: ${complexityScore}/100. `;

  if ( complexityScore < 30 ) {
    reasoning += "Simple query detected. Using fast, cost-effective model.";
  } else if ( complexityScore < 60 ) {
    reasoning += "Moderate complexity detected. Using balanced model.";
  } else {
    reasoning += "High complexity detected. Using most capable model.";
  }

  if ( signals.userRequestedThinking ) {
    reasoning += " User requested step-by-step thinking.";
  }

  if ( signals.previousModelFailed ) {
    reasoning += " Escalating due to previous failure.";
  }

  return {
    selectedModel,
    complexityScore,
    reasoning,
    estimatedCost,
    signals,
  };
}

/**
 * Middleware wrapper for StrandsAgents model calls
 *
 * This function wraps the original model call and adds dynamic model switching.
 *
 * Usage in agent decorator:
 * ```python
 * from bedrock_agentcore_starter_toolkit import Agent, AgentOptions
 *
 * @app.entrypoint
 * def run():
 *     agent = Agent(
 *         agent_name="my_agent",
 *         model_name=select_dynamic_model(context),  # ← Dynamic switching here
 *         system_prompt="...",
 *         tools=[...],
 *     )
 * ```
 */
export function createModelSwitchingWrapper(
  originalModelCall: ( modelId: string, ...args: any[] ) => Promise<any>
) {
  return async function switchingModelCall(
    message: string,
    conversationHistory: Array<{ role: string; content: string }>,
    agent: AgentDoc,
    defaultModelId: string,
    options: {
      preferCost?: boolean;
      preferSpeed?: boolean;
      preferCapability?: boolean;
      userTier?: "freemium" | "personal" | "enterprise";
    } = {},
    ...extraArgs: any[]
  ): Promise<{ response: any; decision: ModelSwitchDecision }> {
    // Make decision
    const decision = decideModelSwitch( message, conversationHistory, agent, options );

    // Call original model with selected model
    const response = await originalModelCall( decision.selectedModel.modelId, ...extraArgs );

    return {
      response,
      decision,
    };
  };
}
