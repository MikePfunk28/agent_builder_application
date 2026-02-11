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
    description: "Latest Claude model with interleaved reasoning, best for complex tasks",
  },

  "anthropic.claude-haiku-4-5-20250514-v1:0": {
    id: "anthropic.claude-haiku-4-5-20250514-v1:0",
    name: "Claude 4.5 Haiku",
    provider: "bedrock",
    providerDisplay: "Anthropic (Bedrock)",
    capabilities: ["text", "vision", "reasoning"],
    contextWindow: 200000,
    maxOutput: 8192,
    recommended: true,
    category: "fast",
    costPer1MTokens: { input: 1.0, output: 5.0 },
    description: "Latest fast Claude model with reasoning, perfect for thinking agents and tool creation",
  },

  // ============================================================================
  // CLAUDE 4.1 SERIES
  // ============================================================================
  "anthropic.claude-opus-4-1-20250805-v1:0": {
    id: "anthropic.claude-opus-4-1-20250805-v1:0",
    name: "Claude 4.5 Opus",
    provider: "bedrock",
    providerDisplay: "Anthropic (Bedrock)",
    capabilities: ["text", "vision", "reasoning"],
    contextWindow: 200000,
    maxOutput: 16384,
    category: "premium",
    costPer1MTokens: { input: 15.0, output: 75.0 },
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
    description: "Balanced Claude model for general use",
  },

  // ============================================================================
  // CLAUDE 3.7 SERIES
  // ============================================================================
  "anthropic.claude-3-7-sonnet-20250219-v1:0": {
    id: "anthropic.claude-3-7-sonnet-20250219-v1:0",
    name: "Claude 3.7 Sonnet",
    provider: "bedrock",
    providerDisplay: "Anthropic (Bedrock)",
    capabilities: ["text", "vision"],
    contextWindow: 200000,
    maxOutput: 8192,
    category: "balanced",
    costPer1MTokens: { input: 3.0, output: 15.0 },
    description: "Previous generation Claude Sonnet",
  },

  // ============================================================================
  // CLAUDE 3.5 SERIES
  // ============================================================================
  "anthropic.claude-3-5-haiku-20241022-v1:0": {
    id: "anthropic.claude-3-5-haiku-20241022-v1:0",
    name: "Claude 3.5 Haiku",
    provider: "bedrock",
    providerDisplay: "Anthropic (Bedrock)",
    capabilities: ["text", "vision"],
    contextWindow: 200000,
    maxOutput: 8192,
    recommended: true,
    category: "fast",
    costPer1MTokens: { input: 1.0, output: 5.0 },
    description: "Fast and cost-effective Claude model",
  },

  "anthropic.claude-3-5-sonnet-20240620-v1:0": {
    id: "anthropic.claude-3-5-sonnet-20240620-v1:0",
    name: "Claude 3.5 Sonnet",
    provider: "bedrock",
    providerDisplay: "Anthropic (Bedrock)",
    capabilities: ["text", "vision"],
    contextWindow: 200000,
    maxOutput: 8192,
    category: "balanced",
    costPer1MTokens: { input: 3.0, output: 15.0 },
    description: "Previous Claude 3.5 generation",
  },

  // ============================================================================
  // CLAUDE 3 SERIES
  // ============================================================================
  "anthropic.claude-3-haiku-20240307-v1:0": {
    id: "anthropic.claude-3-haiku-20240307-v1:0",
    name: "Claude 3 Haiku",
    provider: "bedrock",
    providerDisplay: "Anthropic (Bedrock)",
    capabilities: ["text"],
    contextWindow: 200000,
    maxOutput: 4096,
    category: "fast",
    costPer1MTokens: { input: 0.25, output: 1.25 },
    description: "Fastest Claude 3 model",
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
    description: "Ultra-compact Llama 3.2 on Bedrock",
  },

  "meta.llama3-1-405b-instruct-v1:0": {
    id: "meta.llama3-1-405b-instruct-v1:0",
    name: "Llama 3.1 405B Instruct",
    provider: "bedrock",
    providerDisplay: "Meta (Bedrock)",
    capabilities: ["text"],
    contextWindow: 128000,
    maxOutput: 4096,
    category: "flagship",
    costPer1MTokens: { input: 5.32, output: 16.0 },
    description: "Largest Llama 3.1 model on Bedrock",
  },

  "meta.llama3-1-70b-instruct-v1:0": {
    id: "meta.llama3-1-70b-instruct-v1:0",
    name: "Llama 3.1 70B Instruct",
    provider: "bedrock",
    providerDisplay: "Meta (Bedrock)",
    capabilities: ["text"],
    contextWindow: 128000,
    maxOutput: 2048,
    category: "balanced",
    costPer1MTokens: { input: 0.99, output: 0.99 },
    description: "Balanced Llama 3.1 on Bedrock",
  },

  "meta.llama3-1-8b-instruct-v1:0": {
    id: "meta.llama3-1-8b-instruct-v1:0",
    name: "Llama 3.1 8B Instruct",
    provider: "bedrock",
    providerDisplay: "Meta (Bedrock)",
    capabilities: ["text"],
    contextWindow: 128000,
    maxOutput: 2048,
    category: "lightweight",
    costPer1MTokens: { input: 0.22, output: 0.22 },
    description: "Compact Llama 3.1 on Bedrock",
  },

  "meta.llama3-70b-instruct-v1:0": {
    id: "meta.llama3-70b-instruct-v1:0",
    name: "Llama 3 70B Instruct",
    provider: "bedrock",
    providerDisplay: "Meta (Bedrock)",
    capabilities: ["text"],
    contextWindow: 8192,
    maxOutput: 2048,
    category: "balanced",
    costPer1MTokens: { input: 0.99, output: 0.99 },
    description: "Llama 3 70B on Bedrock",
  },

  "meta.llama3-8b-instruct-v1:0": {
    id: "meta.llama3-8b-instruct-v1:0",
    name: "Llama 3 8B Instruct",
    provider: "bedrock",
    providerDisplay: "Meta (Bedrock)",
    capabilities: ["text"],
    contextWindow: 8192,
    maxOutput: 2048,
    category: "lightweight",
    costPer1MTokens: { input: 0.22, output: 0.22 },
    description: "Llama 3 8B on Bedrock",
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
