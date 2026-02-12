/**
 * Model Registry - Complete Bedrock and Ollama Models
 *
 * Provides comprehensive model metadata for both AWS Bedrock and Ollama providers
 * with capability tracking, cost estimates, and recommendations.
 *
 * Sources:
 * - docs/update_features.md
 * - docs/model_capabilities.md
 */

import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Model provider types
 */
export type ModelProvider = "bedrock" | "ollama" | "openai" | "anthropic" | "azure" | "google";

/**
 * Model capabilities
 */
export type ModelCapability =
  | "text"
  | "vision"
  | "reasoning"
  | "coding"
  | "image_generation"
  | "video_generation"
  | "embeddings";

/**
 * Model metadata structure
 */
export interface ModelMetadata {
  id: string;
  name: string;
  provider: ModelProvider;
  providerDisplay: string;
  capabilities: ModelCapability[];
  contextWindow: number;
  maxOutput?: number;
  size?: string;
  recommended?: boolean;
  category?: string;
  costPer1MTokens?: {
    input: number;
    output: number;
  };
  /** Weighted billing units consumed per call. 1 unit = 1 Haiku-equivalent call ($0.05 Stripe unit). */
  unitsPerCall?: number;
  description?: string;
  type?: "text" | "image" | "video" | "embedding";
}

/**
 * AWS Bedrock Models Registry
 * Per docs/update_features.md and docs/model_capabilities.md
 */
export const BEDROCK_MODELS: Record<string, ModelMetadata> = {
  // ============================================================================
  // CLAUDE 4.5 SERIES (LATEST - RECOMMENDED)
  // ============================================================================
  "anthropic.claude-sonnet-4-5-20250929-v1:0": {
    id: "anthropic.claude-sonnet-4-5-20250929-v1:0",
    name: "Claude 4.5 Sonnet",
    provider: "bedrock",
    providerDisplay: "Anthropic (Bedrock)",
    capabilities: ["text", "vision", "reasoning"],
    contextWindow: 200000,
    maxOutput: 8192,
    recommended: true,
    category: "flagship",
    costPer1MTokens: { input: 3.0, output: 15.0 },
    unitsPerCall: 3,
    description: "Latest Claude model with interleaved reasoning, best for complex tasks",
  },

  "anthropic.claude-haiku-4-5-20251001-v1:0": {
    id: "anthropic.claude-haiku-4-5-20251001-v1:0",
    name: "Claude 4.5 Haiku",
    provider: "bedrock",
    providerDisplay: "Anthropic (Bedrock)",
    capabilities: ["text", "vision", "reasoning"],
    contextWindow: 200000,
    maxOutput: 8192,
    recommended: true,
    category: "fast",
    costPer1MTokens: { input: 1.0, output: 5.0 },
    unitsPerCall: 1,
    description: "Latest fast Claude model with reasoning, perfect for thinking agents and tool creation",
  },

  // ============================================================================
  // CLAUDE 4.6 (PREMIUM)
  // ============================================================================
  "anthropic.claude-opus-4-6-v1": {
    id: "anthropic.claude-opus-4-6-v1",
    name: "Claude 4.6 Opus",
    provider: "bedrock",
    providerDisplay: "Anthropic (Bedrock)",
    capabilities: ["text", "vision", "reasoning"],
    contextWindow: 200000,
    maxOutput: 16384,
    category: "premium",
    costPer1MTokens: { input: 5.0, output: 25.0 },
    unitsPerCall: 5,
    description: "Most capable Claude model — 5x Haiku cost per call",
  },

  // ============================================================================
  // CLAUDE 4.1 SERIES
  // ============================================================================
  "anthropic.claude-opus-4-1-20250805-v1:0": {
    id: "anthropic.claude-opus-4-1-20250805-v1:0",
    name: "Claude 4.1 Opus",
    provider: "bedrock",
    providerDisplay: "Anthropic (Bedrock)",
    capabilities: ["text", "vision", "reasoning"],
    contextWindow: 200000,
    maxOutput: 16384,
    category: "premium",
    costPer1MTokens: { input: 15.0, output: 75.0 },
    unitsPerCall: 15,
    description: "Most capable Claude model for complex reasoning tasks",
  },

  // ============================================================================
  // CLAUDE 4.0 SERIES
  // ============================================================================
  "anthropic.claude-opus-4-20250514-v1:0": {
    id: "anthropic.claude-opus-4-20250514-v1:0",
    name: "Claude 4.0 Opus",
    provider: "bedrock",
    providerDisplay: "Anthropic (Bedrock)",
    capabilities: ["text", "vision", "reasoning"],
    contextWindow: 200000,
    maxOutput: 16384,
    category: "premium",
    costPer1MTokens: { input: 15.0, output: 75.0 },
    unitsPerCall: 15,
    description: "High-performance Claude model for demanding tasks",
  },

  "anthropic.claude-sonnet-4-20250514-v1:0": {
    id: "anthropic.claude-sonnet-4-20250514-v1:0",
    name: "Claude 4.0 Sonnet",
    provider: "bedrock",
    providerDisplay: "Anthropic (Bedrock)",
    capabilities: ["text", "vision", "reasoning"],
    contextWindow: 200000,
    maxOutput: 8192,
    category: "balanced",
    costPer1MTokens: { input: 3.0, output: 15.0 },
    unitsPerCall: 3,
    description: "Balanced Claude model for general use",
  },

  // ============================================================================
  // AMAZON NOVA SERIES
  // ============================================================================
  "amazon.nova-pro-v1:0": {
    id: "amazon.nova-pro-v1:0",
    name: "Nova Pro",
    provider: "bedrock",
    providerDisplay: "Amazon (Bedrock)",
    capabilities: ["text", "vision"],
    contextWindow: 300000,
    maxOutput: 5000,
    recommended: true,
    category: "balanced",
    costPer1MTokens: { input: 0.80, output: 3.20 },
    unitsPerCall: 1,
    description: "Amazon's flagship multimodal model",
  },

  "amazon.nova-lite-v1:0": {
    id: "amazon.nova-lite-v1:0",
    name: "Nova Lite",
    provider: "bedrock",
    providerDisplay: "Amazon (Bedrock)",
    capabilities: ["text", "vision"],
    contextWindow: 300000,
    maxOutput: 5000,
    category: "fast",
    costPer1MTokens: { input: 0.06, output: 0.24 },
    unitsPerCall: 1,
    description: "Lightweight Nova model for speed",
  },

  "amazon.nova-micro-v1:0": {
    id: "amazon.nova-micro-v1:0",
    name: "Nova Micro",
    provider: "bedrock",
    providerDisplay: "Amazon (Bedrock)",
    capabilities: ["text"],
    contextWindow: 128000,
    maxOutput: 5000,
    category: "fast",
    costPer1MTokens: { input: 0.035, output: 0.14 },
    unitsPerCall: 1,
    description: "Ultra-fast text-only Nova model",
  },

  "amazon.nova-premier-v1:0": {
    id: "amazon.nova-premier-v1:0",
    name: "Nova Premier",
    provider: "bedrock",
    providerDisplay: "Amazon (Bedrock)",
    capabilities: ["text", "vision"],
    contextWindow: 300000,
    maxOutput: 5000,
    category: "premium",
    costPer1MTokens: { input: 2.50, output: 10.0 },
    unitsPerCall: 3,
    description: "Most capable Nova model",
  },

  // ============================================================================
  // AMAZON NOVA - MULTIMODAL
  // ============================================================================
  "amazon.nova-canvas-v1:0": {
    id: "amazon.nova-canvas-v1:0",
    name: "Nova Canvas",
    provider: "bedrock",
    providerDisplay: "Amazon (Bedrock)",
    capabilities: ["image_generation"],
    contextWindow: 0,
    type: "image",
    category: "multimodal",
    description: "Generate images with Nova Canvas",
  },

  "amazon.nova-reel-v1:0": {
    id: "amazon.nova-reel-v1:0",
    name: "Nova Reel",
    provider: "bedrock",
    providerDisplay: "Amazon (Bedrock)",
    capabilities: ["video_generation"],
    contextWindow: 0,
    type: "video",
    category: "multimodal",
    description: "Generate videos with Nova Reel",
  },

  // ============================================================================
  // AMAZON TITAN
  // ============================================================================
  "amazon.titan-image-generator-v2:0": {
    id: "amazon.titan-image-generator-v2:0",
    name: "Titan Image Generator V2",
    provider: "bedrock",
    providerDisplay: "Amazon (Bedrock)",
    capabilities: ["image_generation"],
    contextWindow: 0,
    type: "image",
    category: "multimodal",
    description: "Generate images with Titan V2",
  },

  "amazon.titan-text-premier-v1:0": {
    id: "amazon.titan-text-premier-v1:0",
    name: "Titan Text Premier",
    provider: "bedrock",
    providerDisplay: "Amazon (Bedrock)",
    capabilities: ["text"],
    contextWindow: 32000,
    maxOutput: 3000,
    category: "balanced",
    costPer1MTokens: { input: 0.50, output: 1.50 },
    unitsPerCall: 1,
    description: "Amazon Titan text model for general use",
  },

  "amazon.titan-embed-text-v2:0": {
    id: "amazon.titan-embed-text-v2:0",
    name: "Titan Embeddings V2",
    provider: "bedrock",
    providerDisplay: "Amazon (Bedrock)",
    capabilities: ["embeddings"],
    contextWindow: 8192,
    type: "embedding",
    category: "embeddings",
    description: "Generate text embeddings with Titan V2",
  },

  // ============================================================================
  // META LLAMA (BEDROCK)
  // ============================================================================
  "meta.llama3-3-70b-instruct-v1:0": {
    id: "meta.llama3-3-70b-instruct-v1:0",
    name: "Llama 3.3 70B Instruct",
    provider: "bedrock",
    providerDisplay: "Meta (Bedrock)",
    capabilities: ["text"],
    contextWindow: 128000,
    maxOutput: 2048,
    recommended: true,
    category: "flagship",
    costPer1MTokens: { input: 0.65, output: 0.65 },
    unitsPerCall: 1,
    description: "Latest Llama 3.3 model with extended context on Bedrock",
  },

  "meta.llama3-2-90b-instruct-v1:0": {
    id: "meta.llama3-2-90b-instruct-v1:0",
    name: "Llama 3.2 90B Instruct",
    provider: "bedrock",
    providerDisplay: "Meta (Bedrock)",
    capabilities: ["text", "vision"],
    contextWindow: 128000,
    maxOutput: 2048,
    category: "multimodal",
    costPer1MTokens: { input: 1.2, output: 1.2 },
    unitsPerCall: 1,
    description: "Llama 3.2 with vision capabilities on Bedrock",
  },

  "meta.llama3-2-11b-instruct-v1:0": {
    id: "meta.llama3-2-11b-instruct-v1:0",
    name: "Llama 3.2 11B Instruct",
    provider: "bedrock",
    providerDisplay: "Meta (Bedrock)",
    capabilities: ["text", "vision"],
    contextWindow: 128000,
    maxOutput: 2048,
    category: "multimodal",
    costPer1MTokens: { input: 0.35, output: 0.35 },
    unitsPerCall: 1,
    description: "Compact Llama 3.2 with vision on Bedrock",
  },

  "meta.llama3-2-3b-instruct-v1:0": {
    id: "meta.llama3-2-3b-instruct-v1:0",
    name: "Llama 3.2 3B Instruct",
    provider: "bedrock",
    providerDisplay: "Meta (Bedrock)",
    capabilities: ["text"],
    contextWindow: 128000,
    maxOutput: 2048,
    category: "lightweight",
    costPer1MTokens: { input: 0.15, output: 0.15 },
    unitsPerCall: 1,
    description: "Lightweight Llama 3.2 on Bedrock",
  },

  "meta.llama3-2-1b-instruct-v1:0": {
    id: "meta.llama3-2-1b-instruct-v1:0",
    name: "Llama 3.2 1B Instruct",
    provider: "bedrock",
    providerDisplay: "Meta (Bedrock)",
    capabilities: ["text"],
    contextWindow: 128000,
    maxOutput: 2048,
    category: "lightweight",
    costPer1MTokens: { input: 0.1, output: 0.1 },
    unitsPerCall: 1,
    description: "Ultra-compact Llama 3.2 on Bedrock",
  },

  // ============================================================================
  // MISTRAL AI (BEDROCK)
  // ============================================================================
  "mistral.mistral-large-2407-v1:0": {
    id: "mistral.mistral-large-2407-v1:0",
    name: "Mistral Large 2",
    provider: "bedrock",
    providerDisplay: "Mistral AI (Bedrock)",
    capabilities: ["text", "coding"],
    contextWindow: 128000,
    maxOutput: 8192,
    recommended: true,
    category: "flagship",
    costPer1MTokens: { input: 3.0, output: 9.0 },
    unitsPerCall: 2,
    description: "Mistral's most capable model on Bedrock",
  },

  "mistral.mistral-small-2402-v1:0": {
    id: "mistral.mistral-small-2402-v1:0",
    name: "Mistral Small",
    provider: "bedrock",
    providerDisplay: "Mistral AI (Bedrock)",
    capabilities: ["text"],
    contextWindow: 32000,
    maxOutput: 8192,
    category: "lightweight",
    costPer1MTokens: { input: 1.0, output: 3.0 },
    unitsPerCall: 1,
    description: "Compact Mistral model on Bedrock",
  },

  // ============================================================================
  // AI21 LABS (BEDROCK)
  // ============================================================================
  "ai21.jamba-1-5-large-v1:0": {
    id: "ai21.jamba-1-5-large-v1:0",
    name: "Jamba 1.5 Large",
    provider: "bedrock",
    providerDisplay: "AI21 Labs (Bedrock)",
    capabilities: ["text"],
    contextWindow: 256000,
    maxOutput: 4096,
    category: "flagship",
    costPer1MTokens: { input: 2.0, output: 8.0 },
    unitsPerCall: 2,
    description: "AI21's flagship model with massive context window",
  },

  "ai21.jamba-1-5-mini-v1:0": {
    id: "ai21.jamba-1-5-mini-v1:0",
    name: "Jamba 1.5 Mini",
    provider: "bedrock",
    providerDisplay: "AI21 Labs (Bedrock)",
    capabilities: ["text"],
    contextWindow: 256000,
    maxOutput: 4096,
    category: "lightweight",
    costPer1MTokens: { input: 0.2, output: 0.4 },
    unitsPerCall: 1,
    description: "Compact Jamba model with large context",
  },

  // ============================================================================
  // COHERE (BEDROCK)
  // ============================================================================
  "cohere.command-r-plus-v1:0": {
    id: "cohere.command-r-plus-v1:0",
    name: "Command R+",
    provider: "bedrock",
    providerDisplay: "Cohere (Bedrock)",
    capabilities: ["text"],
    contextWindow: 128000,
    maxOutput: 4096,
    category: "flagship",
    costPer1MTokens: { input: 3.0, output: 15.0 },
    unitsPerCall: 3,
    description: "Cohere's most capable model on Bedrock",
  },

  "cohere.command-r-v1:0": {
    id: "cohere.command-r-v1:0",
    name: "Command R",
    provider: "bedrock",
    providerDisplay: "Cohere (Bedrock)",
    capabilities: ["text"],
    contextWindow: 128000,
    maxOutput: 4096,
    category: "balanced",
    costPer1MTokens: { input: 0.5, output: 1.5 },
    unitsPerCall: 1,
    description: "Balanced Cohere model on Bedrock",
  },

  "cohere.embed-english-v3": {
    id: "cohere.embed-english-v3",
    name: "Cohere Embed English V3",
    provider: "bedrock",
    providerDisplay: "Cohere (Bedrock)",
    capabilities: ["embeddings"],
    contextWindow: 512,
    type: "embedding",
    category: "embeddings",
    description: "English text embeddings from Cohere",
  },

  "cohere.embed-multilingual-v3": {
    id: "cohere.embed-multilingual-v3",
    name: "Cohere Embed Multilingual V3",
    provider: "bedrock",
    providerDisplay: "Cohere (Bedrock)",
    capabilities: ["embeddings"],
    contextWindow: 512,
    type: "embedding",
    category: "embeddings",
    description: "Multilingual text embeddings from Cohere",
  },

  // ============================================================================
  // DEEPSEEK (BEDROCK)
  // ============================================================================
  "deepseek.r1-v1:0": {
    id: "deepseek.r1-v1:0",
    name: "DeepSeek R1",
    provider: "bedrock",
    providerDisplay: "DeepSeek (Bedrock)",
    capabilities: ["text", "reasoning"],
    contextWindow: 64000,
    maxOutput: 8192,
    recommended: true,
    category: "reasoning",
    costPer1MTokens: { input: 1.35, output: 5.40 },
    unitsPerCall: 2,
    description: "DeepSeek reasoning model with chain-of-thought on Bedrock — heavier output tokens",
  },

  "deepseek.v3-v1:0": {
    id: "deepseek.v3-v1:0",
    name: "DeepSeek V3.1",
    provider: "bedrock",
    providerDisplay: "DeepSeek (Bedrock)",
    capabilities: ["text", "reasoning", "coding"],
    contextWindow: 64000,
    maxOutput: 8192,
    recommended: true,
    category: "flagship",
    costPer1MTokens: { input: 0.58, output: 1.68 },
    unitsPerCall: 1,
    description: "DeepSeek V3.1 hybrid model — best value reasoning model on Bedrock",
  },

  // ============================================================================
  // MOONSHOT KIMI (BEDROCK)
  // ============================================================================
  "moonshot.kimi-k2-thinking": {
    id: "moonshot.kimi-k2-thinking",
    name: "Kimi K2 Thinking",
    provider: "bedrock",
    providerDisplay: "Moonshot AI (Bedrock)",
    capabilities: ["text", "reasoning"],
    contextWindow: 128000,
    maxOutput: 8192,
    category: "reasoning",
    costPer1MTokens: { input: 1.00, output: 4.00 },
    unitsPerCall: 1,
    description: "Moonshot Kimi K2 with chain-of-thought reasoning on Bedrock",
  },
};

/**
 * Ollama Models Registry
 * Per docs/comprehensive_plan.md and docs/update_features.md
 */
export const OLLAMA_MODELS: Record<string, ModelMetadata> = {
  // ============================================================================
  // QWEN3 SERIES (RECOMMENDED for coding)
  // ============================================================================
  "qwen3:4b": {
    id: "qwen3:4b",
    name: "Qwen3 4B",
    provider: "ollama",
    providerDisplay: "Qwen (Ollama)",
    capabilities: ["text"],
    contextWindow: 32000,
    size: "4B",
    recommended: true,
    category: "lightweight",
    description: "Lightweight Qwen model for fast inference",
  },

  "qwen3:8b": {
    id: "qwen3:8b",
    name: "Qwen3 8B",
    provider: "ollama",
    providerDisplay: "Qwen (Ollama)",
    capabilities: ["text"],
    contextWindow: 32000,
    size: "8B",
    recommended: true,
    category: "balanced",
    description: "Balanced Qwen model for general use",
  },

  "qwen3:14b": {
    id: "qwen3:14b",
    name: "Qwen3 14B",
    provider: "ollama",
    providerDisplay: "Qwen (Ollama)",
    capabilities: ["text"],
    contextWindow: 32000,
    size: "14B",
    category: "advanced",
    description: "Advanced Qwen model for complex tasks",
  },

  "qwen3:30b": {
    id: "qwen3:30b",
    name: "Qwen3 30B",
    provider: "ollama",
    providerDisplay: "Qwen (Ollama)",
    capabilities: ["text"],
    contextWindow: 32000,
    size: "30B",
    category: "enterprise",
    description: "Enterprise-grade Qwen model",
  },

  "qwen3-coder:30b": {
    id: "qwen3-coder:30b",
    name: "Qwen3 Coder 30B",
    provider: "ollama",
    providerDisplay: "Qwen (Ollama)",
    capabilities: ["text", "coding"],
    contextWindow: 32000,
    size: "30B",
    recommended: true,
    category: "coding",
    description: "Specialized Qwen model for coding tasks",
  },

  "qwen3-embedding:4b": {
    id: "qwen3-embedding:4b",
    name: "Qwen3 Embedding 4B",
    provider: "ollama",
    providerDisplay: "Qwen (Ollama)",
    capabilities: ["embeddings"],
    contextWindow: 8192,
    size: "4B",
    type: "embedding",
    category: "embeddings",
    description: "Generate embeddings for semantic search",
  },

  "qwen3-embedding:8b": {
    id: "qwen3-embedding:8b",
    name: "Qwen3 Embedding 8B",
    provider: "ollama",
    providerDisplay: "Qwen (Ollama)",
    capabilities: ["embeddings"],
    contextWindow: 8192,
    size: "8B",
    type: "embedding",
    category: "embeddings",
    description: "Higher quality embeddings",
  },

  // ============================================================================
  // LLAMA SERIES
  // ============================================================================
  "llama3.3": {
    id: "llama3.3",
    name: "Llama 3.3",
    provider: "ollama",
    providerDisplay: "Meta (Ollama)",
    capabilities: ["text"],
    contextWindow: 128000,
    size: "70B",
    recommended: true,
    category: "flagship",
    description: "Latest Llama model with extended context",
  },

  "llama3.2:3b": {
    id: "llama3.2:3b",
    name: "Llama 3.2 3B",
    provider: "ollama",
    providerDisplay: "Meta (Ollama)",
    capabilities: ["text"],
    contextWindow: 128000,
    size: "3B",
    category: "lightweight",
    description: "Compact Llama model",
  },

  "llama3.2:1b": {
    id: "llama3.2:1b",
    name: "Llama 3.2 1B",
    provider: "ollama",
    providerDisplay: "Meta (Ollama)",
    capabilities: ["text"],
    contextWindow: 128000,
    size: "1B",
    category: "lightweight",
    description: "Ultra-compact Llama model",
  },

  "llama3.1:8b": {
    id: "llama3.1:8b",
    name: "Llama 3.1 8B",
    provider: "ollama",
    providerDisplay: "Meta (Ollama)",
    capabilities: ["text"],
    contextWindow: 128000,
    size: "8B",
    category: "balanced",
    description: "Balanced Llama model",
  },

  "llama3.2-vision:11b": {
    id: "llama3.2-vision:11b",
    name: "Llama 3.2 Vision 11B",
    provider: "ollama",
    providerDisplay: "Meta (Ollama)",
    capabilities: ["text", "vision"],
    contextWindow: 128000,
    size: "11B",
    category: "multimodal",
    description: "Llama with vision capabilities",
  },

  // ============================================================================
  // PHI SERIES
  // ============================================================================
  "phi4:14b": {
    id: "phi4:14b",
    name: "Phi-4 14B",
    provider: "ollama",
    providerDisplay: "Microsoft (Ollama)",
    capabilities: ["text", "reasoning"],
    contextWindow: 16000,
    size: "14B",
    recommended: true,
    category: "reasoning",
    description: "Microsoft's reasoning-focused model",
  },

  "phi4-mini:3.8b": {
    id: "phi4-mini:3.8b",
    name: "Phi-4 Mini 3.8B",
    provider: "ollama",
    providerDisplay: "Microsoft (Ollama)",
    capabilities: ["text"],
    contextWindow: 16000,
    size: "3.8B",
    category: "lightweight",
    description: "Compact Phi model",
  },

  "phi4-mini-reasoning:3.8b": {
    id: "phi4-mini-reasoning:3.8b",
    name: "Phi-4 Mini Reasoning 3.8B",
    provider: "ollama",
    providerDisplay: "Microsoft (Ollama)",
    capabilities: ["text", "reasoning"],
    contextWindow: 16000,
    size: "3.8B",
    category: "reasoning",
    description: "Compact reasoning model",
  },

  // ============================================================================
  // GEMMA SERIES
  // ============================================================================
  "gemma3:4b": {
    id: "gemma3:4b",
    name: "Gemma 3 4B",
    provider: "ollama",
    providerDisplay: "Google (Ollama)",
    capabilities: ["text"],
    contextWindow: 8192,
    size: "4B",
    category: "lightweight",
    description: "Google's compact model",
  },

  "gemma3:12b": {
    id: "gemma3:12b",
    name: "Gemma 3 12B",
    provider: "ollama",
    providerDisplay: "Google (Ollama)",
    capabilities: ["text"],
    contextWindow: 8192,
    size: "12B",
    category: "balanced",
    description: "Balanced Gemma model",
  },

  "gemma3:27b": {
    id: "gemma3:27b",
    name: "Gemma 3 27B",
    provider: "ollama",
    providerDisplay: "Google (Ollama)",
    capabilities: ["text"],
    contextWindow: 8192,
    size: "27B",
    category: "advanced",
    description: "Advanced Gemma model",
  },

  "codegemma:7b": {
    id: "codegemma:7b",
    name: "CodeGemma 7B",
    provider: "ollama",
    providerDisplay: "Google (Ollama)",
    capabilities: ["text", "coding"],
    contextWindow: 8192,
    size: "7B",
    category: "coding",
    description: "Gemma specialized for coding",
  },

  // ============================================================================
  // DEEPSEEK SERIES
  // ============================================================================
  "deepseek-r1:8b": {
    id: "deepseek-r1:8b",
    name: "DeepSeek R1 8B",
    provider: "ollama",
    providerDisplay: "DeepSeek (Ollama)",
    capabilities: ["text", "reasoning"],
    contextWindow: 64000,
    size: "8B",
    recommended: true,
    category: "reasoning",
    description: "DeepSeek reasoning model",
  },

  "deepseek-coder:6.7b": {
    id: "deepseek-coder:6.7b",
    name: "DeepSeek Coder 6.7B",
    provider: "ollama",
    providerDisplay: "DeepSeek (Ollama)",
    capabilities: ["text", "coding"],
    contextWindow: 16000,
    size: "6.7B",
    recommended: true,
    category: "coding",
    description: "DeepSeek specialized for coding",
  },

  "deepseek-coder:33b": {
    id: "deepseek-coder:33b",
    name: "DeepSeek Coder 33B",
    provider: "ollama",
    providerDisplay: "DeepSeek (Ollama)",
    capabilities: ["text", "coding"],
    contextWindow: 16000,
    size: "33B",
    category: "coding",
    description: "Enterprise DeepSeek coding model",
  },

  "deepseek-v3": {
    id: "deepseek-v3",
    name: "DeepSeek V3",
    provider: "ollama",
    providerDisplay: "DeepSeek (Ollama)",
    capabilities: ["text"],
    contextWindow: 64000,
    size: "671B",
    category: "flagship",
    description: "DeepSeek's most capable model",
  },

  // ============================================================================
  // MISTRAL SERIES
  // ============================================================================
  "mistral-nemo": {
    id: "mistral-nemo",
    name: "Mistral Nemo",
    provider: "ollama",
    providerDisplay: "Mistral AI (Ollama)",
    capabilities: ["text"],
    contextWindow: 128000,
    size: "12B",
    category: "balanced",
    description: "Mistral's balanced model",
  },

  "devstral:24b": {
    id: "devstral:24b",
    name: "Devstral 24B",
    provider: "ollama",
    providerDisplay: "Mistral AI (Ollama)",
    capabilities: ["text", "coding"],
    contextWindow: 32000,
    size: "24B",
    category: "coding",
    description: "Mistral's coding specialist",
  },
};

/**
 * Combined model registry
 */
export const ALL_MODELS = {
  ...BEDROCK_MODELS,
  ...OLLAMA_MODELS,
};

/**
 * Short-name to full Bedrock model ID mapping.
 * Single source of truth — execution files should import this
 * instead of maintaining their own inline modelMap.
 */
export const SHORT_NAME_TO_BEDROCK_ID: Record<string, string> = {
  // Claude 4.6
  "claude-opus-4.6": "anthropic.claude-opus-4-6-v1",

  // Claude 4.5
  "claude-sonnet-4.5": "anthropic.claude-sonnet-4-5-20250929-v1:0",
  "claude-haiku-4.5": "anthropic.claude-haiku-4-5-20251001-v1:0",

  // Claude 4.1
  "claude-opus-4.1": "anthropic.claude-opus-4-1-20250805-v1:0",

  // Claude 4.0
  "claude-opus-4": "anthropic.claude-opus-4-20250514-v1:0",
  "claude-sonnet-4": "anthropic.claude-sonnet-4-20250514-v1:0",

  // Amazon Nova
  "nova-pro": "us.amazon.nova-pro-v1:0",
  "nova-lite": "us.amazon.nova-lite-v1:0",
  "nova-micro": "us.amazon.nova-micro-v1:0",

  // Amazon Titan
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

  // Mistral
  "mistral-large-2": "mistral.mistral-large-2407-v1:0",
  "mistral-small": "mistral.mistral-small-2402-v1:0",
  "mixtral-8x7b": "mistral.mixtral-8x7b-instruct-v0:1",

  // AI21 Jamba
  "jamba-1.5-large": "ai21.jamba-1-5-large-v1:0",
  "jamba-1.5-mini": "ai21.jamba-1-5-mini-v1:0",

  // Cohere Command
  "command-r-plus": "cohere.command-r-plus-v1:0",
  "command-r": "cohere.command-r-v1:0",

  // DeepSeek
  "deepseek-r1": "deepseek.r1-v1:0",
  "deepseek-v3": "deepseek.v3-v1:0",
  "deepseek-v3.1": "deepseek.v3-v1:0",

  // Moonshot Kimi
  "kimi-k2": "moonshot.kimi-k2-thinking",
};

/** Bedrock provider prefixes used to identify already-qualified model IDs */
const BEDROCK_PREFIXES = ["anthropic.", "amazon.", "meta.", "mistral.", "cohere.", "ai21.", "stability.", "deepseek.", "moonshot.", "qwen.", "us.", "eu.", "apac.", "global."];

/**
 * Resolve a model name (short or full) to a valid Bedrock model ID.
 * Checks the full registry, then the short-name map, then falls back to env/default.
 */
export function resolveBedrockModelId( modelName: string ): string {
  // Already a fully qualified Bedrock ID
  if ( BEDROCK_PREFIXES.some( p => modelName.startsWith( p ) ) ) {
    return modelName;
  }
  // Ollama-style ID (has ":" but no Bedrock prefix)
  if ( modelName.includes( ":" ) ) {
    return modelName;
  }
  // Check full registry by key
  if ( ALL_MODELS[modelName] ) {
    return ALL_MODELS[modelName].id;
  }
  // Check short-name map
  if ( SHORT_NAME_TO_BEDROCK_ID[modelName] ) {
    return SHORT_NAME_TO_BEDROCK_ID[modelName];
  }
  // Fall back to env var or DeepSeek V3.1 default (cheapest capable model on Bedrock)
  return process.env.AGENT_BUILDER_MODEL_ID || "deepseek.v3-v1:0";
}

/**
 * Look up the weighted billing units for a model.
 * Returns unitsPerCall from the registry, defaulting to 1 for unknown models.
 * Used by stripeMutations to report weighted usage to Stripe.
 */
export function getUnitsForModel( modelId: string ): number {
  const model = BEDROCK_MODELS[modelId] ?? ALL_MODELS[modelId];
  return model?.unitsPerCall ?? 1;
}

/**
 * Get all available models
 */
export const getAllModels = query( {
  args: {},
  handler: async () => {
    return Object.values( ALL_MODELS );
  },
} );

/**
 * Get models by provider
 */
export const getModelsByProvider = query( {
  args: { provider: v.string() },
  handler: async ( ctx, args ) => {
    return Object.values( ALL_MODELS ).filter(
      model => model.provider === args.provider
    );
  },
} );

/**
 * Get models by capability
 */
export const getModelsByCapability = query( {
  args: { capability: v.string() },
  handler: async ( ctx, args ) => {
    return Object.values( ALL_MODELS ).filter( model =>
      model.capabilities.includes( args.capability as ModelCapability )
    );
  },
} );

/**
 * Get recommended models
 */
export const getRecommendedModels = query( {
  args: {},
  handler: async () => {
    return Object.values( ALL_MODELS ).filter( model => model.recommended );
  },
} );

/**
 * Get model by ID
 */
export const getModelById = query( {
  args: { modelId: v.string() },
  handler: async ( ctx, args ) => {
    return ALL_MODELS[args.modelId] || null;
  },
} );

/**
 * Get models by category
 */
export const getModelsByCategory = query( {
  args: { category: v.string() },
  handler: async ( ctx, args ) => {
    return Object.values( ALL_MODELS ).filter(
      model => model.category === args.category
    );
  },
} );

/**
 * Search models by name or description
 */
export const searchModels = query( {
  args: { query: v.string() },
  handler: async ( ctx, args ) => {
    const query = args.query.toLowerCase();
    return Object.values( ALL_MODELS ).filter( model =>
      model.name.toLowerCase().includes( query ) ||
      model.description?.toLowerCase().includes( query ) ||
      model.id.toLowerCase().includes( query )
    );
  },
} );

/**
 * Get model provider-specific configuration
 */
export function getModelConfig( modelId: string ): {
  provider: ModelProvider;
  imports: string[];
  initCode: string;
} {
  const model = ALL_MODELS[modelId];
  if ( !model ) {
    throw new Error( `Model ${modelId} not found` );
  }

  if ( model.provider === "bedrock" ) {
    return {
      provider: "bedrock",
      imports: [
        "from strandsagents.models import BedrockModel",
        "import boto3",
        "from botocore.config import Config",
      ],
      initCode: `# Initialize Bedrock model
config = Config(
    region_name=os.getenv("AWS_REGION", "us-east-1"),
    retries={'max_attempts': 3, 'mode': 'adaptive'}
)

model = BedrockModel(
    model_id="${modelId}",
    config=config,
    temperature=0.3,
    streaming=True
)`,
    };
  }

  if ( model.provider === "ollama" ) {
    return {
      provider: "ollama",
      imports: [
        "from strandsagents.models import OllamaModel",
      ],
      initCode: `# Initialize Ollama model
model = OllamaModel(
    model_id="${modelId}",
    host=os.getenv("OLLAMA_HOST", "http://localhost:11434"),
    temperature=0.7
)`,
    };
  }

  throw new Error( `Provider ${model.provider} not supported` );
}
