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
 * Available model tiers
 */
export const MODEL_TIERS: Record<string, ModelTier> = {
  // Fast & Cheap
  haiku: {
    name: "Claude 4.5 Haiku",
    modelId: "us.anthropic.claude-haiku-4-5-20250514-v1:0",
    costPer1KInput: 0.001,
    costPer1KOutput: 0.005,
    maxTokens: 8000,
    speedRating: 1,
    capabilityRating: 1,
  },

  // Balanced
  sonnet: {
    name: "Claude 3.5 Sonnet",
    modelId: "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
    costPer1KInput: 0.003,
    costPer1KOutput: 0.015,
    maxTokens: 8000,
    speedRating: 2,
    capabilityRating: 2,
  },

  // Slow & Powerful
  opus: {
    name: "Claude 3 Opus",
    modelId: "anthropic.claude-3-opus-20240229-v1:0",
    costPer1KInput: 0.015,
    costPer1KOutput: 0.075,
    maxTokens: 4096,
    speedRating: 3,
    capabilityRating: 3,
  },

  // Ollama models (free, but require local hosting)
  ollamaLlama: {
    name: "Llama 3.2",
    modelId: "llama3.2:latest",
    costPer1KInput: 0, // Free
    costPer1KOutput: 0,
    maxTokens: 8000,
    speedRating: 2,
    capabilityRating: 1,
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
  const hasCodeBlocks = message.includes("```") || message.includes("`");
  const hasMultipleQuestions = (message.match(/\?/g) || []).length > 1;
  const hasMath = /\d+[\+\-\*\/]\d+|equation|formula|calculate/.test(lowerMessage);
  const hasLogicalReasoning = /because|therefore|if.*then|prove|explain why|analyze|compare/.test(lowerMessage);

  // Conversation characteristics
  const conversationLength = conversationHistory.length;
  const toolCallsInHistory = conversationHistory.filter((msg) =>
    msg.role === "assistant" && msg.content.includes("tool_use")
  ).length;
  const failedAttempts = conversationHistory.filter((msg) =>
    msg.role === "assistant" && (msg.content.includes("error") || msg.content.includes("failed"))
  ).length;

  // Explicit indicators
  const userRequestedThinking = /think step by step|reason through|explain your thinking|show your work/.test(
    lowerMessage
  );
  const userRequestedStepByStep = /step by step|break it down|detailed explanation/.test(lowerMessage);
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
export function calculateComplexityScore(signals: ComplexitySignals): number {
  let score = 0;

  // Message length (0-20 points)
  if (signals.messageLength > 1000) score += 20;
  else if (signals.messageLength > 500) score += 15;
  else if (signals.messageLength > 200) score += 10;
  else score += 5;

  // Code blocks (10 points)
  if (signals.hasCodeBlocks) score += 10;

  // Multiple questions (10 points)
  if (signals.hasMultipleQuestions) score += 10;

  // Math (5 points)
  if (signals.hasMath) score += 5;

  // Logical reasoning (15 points)
  if (signals.hasLogicalReasoning) score += 15;

  // Conversation length (0-15 points)
  if (signals.conversationLength > 10) score += 15;
  else if (signals.conversationLength > 5) score += 10;
  else if (signals.conversationLength > 2) score += 5;

  // Tool calls (10 points)
  if (signals.toolCallsInHistory > 2) score += 10;
  else if (signals.toolCallsInHistory > 0) score += 5;

  // Failed attempts (15 points - escalate to better model)
  if (signals.failedAttempts > 1) score += 15;
  else if (signals.failedAttempts > 0) score += 10;

  // Explicit indicators (20 points each)
  if (signals.userRequestedThinking) score += 20;
  if (signals.userRequestedStepByStep) score += 20;
  if (signals.previousModelFailed) score += 20;

  return Math.min(score, 100);
}

/**
 * Select optimal model based on complexity
 */
export function selectModel(
  complexityScore: number,
  agent: AgentDoc,
  options: {
    preferCost?: boolean; // Prefer cheaper models
    preferSpeed?: boolean; // Prefer faster models
    preferCapability?: boolean; // Prefer more capable models
    userTier?: "freemium" | "personal" | "enterprise";
  } = {}
): ModelTier {
  const { preferCost = false, preferSpeed = false, preferCapability = false, userTier = "freemium" } = options;

  // Get available models based on agent configuration
  const isOllamaAgent = agent.model.includes(":") && !agent.model.includes(".");
  const availableModels = isOllamaAgent
    ? [MODEL_TIERS.ollamaLlama]
    : [MODEL_TIERS.haiku, MODEL_TIERS.sonnet, MODEL_TIERS.opus];

  // Freemium users: only local models allowed (no Bedrock access)
  if (userTier === "freemium") {
    // If the agent uses Ollama, return Ollama model; otherwise return cheapest available
    // Bedrock gating is enforced at the execution layer, but we also constrain selection here
    return isOllamaAgent ? availableModels[0] : MODEL_TIERS.ollamaLlama;
  }

  // Complexity-based routing
  if (complexityScore < 30) {
    // Simple query → Haiku
    return availableModels[0];
  } else if (complexityScore < 60) {
    // Moderate complexity → Sonnet
    return availableModels[Math.min(1, availableModels.length - 1)];
  } else {
    // High complexity → Opus (if available)
    return availableModels[Math.min(2, availableModels.length - 1)];
  }
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
  const signals = analyzeComplexity(message, conversationHistory);
  const complexityScore = calculateComplexityScore(signals);

  // Select model
  const selectedModel = selectModel(complexityScore, agent, options);

  // Calculate estimated cost (assuming ~500 tokens input, ~500 tokens output)
  const estimatedCost =
    (500 / 1000) * selectedModel.costPer1KInput + (500 / 1000) * selectedModel.costPer1KOutput;

  // Generate reasoning
  let reasoning = `Complexity score: ${complexityScore}/100. `;

  if (complexityScore < 30) {
    reasoning += "Simple query detected. Using fast, cost-effective model.";
  } else if (complexityScore < 60) {
    reasoning += "Moderate complexity detected. Using balanced model.";
  } else {
    reasoning += "High complexity detected. Using most capable model.";
  }

  if (signals.userRequestedThinking) {
    reasoning += " User requested step-by-step thinking.";
  }

  if (signals.previousModelFailed) {
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
  originalModelCall: (modelId: string, ...args: any[]) => Promise<any>
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
    const decision = decideModelSwitch(message, conversationHistory, agent, options);

    console.log(`[ModelSwitcher] ${decision.reasoning}`);
    console.log(`[ModelSwitcher] Selected: ${decision.selectedModel.name}`);
    console.log(`[ModelSwitcher] Estimated cost: $${decision.estimatedCost.toFixed(4)}`);

    // Call original model with selected model
    const response = await originalModelCall(decision.selectedModel.modelId, ...extraArgs);

    return {
      response,
      decision,
    };
  };
}
