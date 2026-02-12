export type ModelProvider = "bedrock" | "ollama" | "lmstudio";

// Centralized local model endpoints - configurable via environment variables
export const LOCAL_MODEL_ENDPOINTS = {
  ollama: import.meta.env.VITE_OLLAMA_ENDPOINT || "http://localhost:11434",
  lmstudio: import.meta.env.VITE_LMSTUDIO_ENDPOINT || "http://localhost:1234",
} as const;

export interface ModelMetadata {
  id: string;
  label: string;
  description: string;
  provider: ModelProvider;
  family?: string;
  contextLength?: number;
  defaultConfig: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    endpoint?: string;
    numCtx?: number;
  };
  tags?: string[];
  recommended?: boolean;
  /** Minimum tier required to use this model. undefined = available to all tiers. */
  requiredTier?: "personal" | "enterprise";
}

export const MODEL_CATALOG: ModelMetadata[] = [
  // Anthropic Claude (Bedrock)
  {
    id: "anthropic.claude-sonnet-4-5-20250929-v1:0",
    label: "Claude 4.5 Sonnet",
    description: "Latest Claude Sonnet with advanced reasoning and coding.",
    provider: "bedrock",
    family: "Anthropic Claude",
    contextLength: 200000,
    defaultConfig: {
      temperature: 0.2,
      topP: 0.9,
      maxTokens: 4096,
    },
    tags: ["reasoning", "coding", "analysis"],
    recommended: true,
    requiredTier: "personal",
  },
  {
    id: "anthropic.claude-haiku-4-5-20251001-v1:0",
    label: "Claude 4.5 Haiku",
    description: "Fast Claude model tuned for tool creation and thinking loops.",
    provider: "bedrock",
    family: "Anthropic Claude",
    contextLength: 200000,
    defaultConfig: {
      temperature: 0.25,
      topP: 0.9,
      maxTokens: 4096,
    },
    tags: ["reasoning", "fast", "tool-use"],
    recommended: true,
    requiredTier: "personal",
  },
  {
    id: "anthropic.claude-opus-4-6-v1:0",
    label: "Claude 4.6 Opus",
    description: "Most capable Claude model for premium analysis and reasoning.",
    provider: "bedrock",
    family: "Anthropic Claude",
    contextLength: 200000,
    defaultConfig: {
      temperature: 0.3,
      topP: 0.95,
      maxTokens: 4096,
    },
    tags: ["reasoning", "analysis", "premium"],
    requiredTier: "personal",
  },
  // DeepSeek (Bedrock)
  {
    id: "deepseek.v3-v1:0",
    label: "DeepSeek V3.1",
    description: "Best value reasoning model on Bedrock — cheapest capable model.",
    provider: "bedrock",
    family: "DeepSeek",
    contextLength: 64000,
    defaultConfig: {
      temperature: 0.3,
      topP: 0.9,
      maxTokens: 4096,
    },
    tags: ["reasoning", "coding", "value"],
    recommended: true,
    requiredTier: "personal",
  },
  {
    id: "deepseek.r1-v1:0",
    label: "DeepSeek R1",
    description: "Chain-of-thought reasoning model with deep thinking capabilities.",
    provider: "bedrock",
    family: "DeepSeek",
    contextLength: 64000,
    defaultConfig: {
      temperature: 0.3,
      topP: 0.9,
      maxTokens: 4096,
    },
    tags: ["reasoning"],
    requiredTier: "personal",
  },
  // Moonshot (Bedrock)
  {
    id: "moonshot.kimi-k2-thinking",
    label: "Kimi K2 Thinking",
    description: "Moonshot chain-of-thought reasoning model on Bedrock.",
    provider: "bedrock",
    family: "Moonshot",
    contextLength: 128000,
    defaultConfig: {
      temperature: 0.3,
      topP: 0.9,
      maxTokens: 4096,
    },
    tags: ["reasoning"],
    requiredTier: "personal",
  },
  // Meta Llama (Bedrock)
  {
    id: "meta.llama3-3-70b-instruct-v1:0",
    label: "Llama 3.3 70B",
    description: "Meta's latest flagship Llama model with extended context on Bedrock.",
    provider: "bedrock",
    family: "Meta Llama",
    contextLength: 128000,
    defaultConfig: {
      temperature: 0.3,
      topP: 0.9,
      maxTokens: 2048,
    },
    tags: ["general", "value"],
    recommended: true,
    requiredTier: "personal",
  },
  {
    id: "meta.llama3-2-90b-instruct-v1:0",
    label: "Llama 3.2 90B Vision",
    description: "Llama 3.2 with vision capabilities for multimodal workflows.",
    provider: "bedrock",
    family: "Meta Llama",
    contextLength: 128000,
    defaultConfig: {
      temperature: 0.3,
      topP: 0.9,
      maxTokens: 2048,
    },
    tags: ["vision", "multimodal"],
    requiredTier: "personal",
  },
  // Amazon Nova
  {
    id: "amazon.nova-premier-v1:0",
    label: "Amazon Nova Premier",
    description: "Top-tier Amazon Nova model with strong reasoning.",
    provider: "bedrock",
    family: "Amazon Nova",
    contextLength: 300000,
    defaultConfig: {
      temperature: 0.25,
      topP: 0.9,
      maxTokens: 4096,
    },
    tags: ["reasoning"],
    requiredTier: "personal",
  },
  {
    id: "amazon.nova-pro-v1:0",
    label: "Amazon Nova Pro",
    description: "Professional-grade Nova for business-focused workflows.",
    provider: "bedrock",
    family: "Amazon Nova",
    contextLength: 200000,
    defaultConfig: {
      temperature: 0.25,
      topP: 0.9,
      maxTokens: 4096,
    },
    tags: ["business"],
    requiredTier: "personal",
  },
  {
    id: "amazon.nova-lite-v1:0",
    label: "Amazon Nova Lite",
    description: "Lightweight Nova for cost-sensitive tasks.",
    provider: "bedrock",
    family: "Amazon Nova",
    contextLength: 200000,
    defaultConfig: {
      temperature: 0.3,
      topP: 0.9,
      maxTokens: 2048,
    },
    tags: ["budget"],
    requiredTier: "personal",
  },
  // Cohere Command
  {
    id: "cohere.command-r-plus-v1:0",
    label: "Cohere Command R+",
    description: "Instruction-following model optimized for retrieval-augmented agents.",
    provider: "bedrock",
    family: "Cohere Command",
    contextLength: 200000,
    defaultConfig: {
      temperature: 0.2,
      topP: 0.8,
      maxTokens: 3072,
    },
    tags: ["rag", "instruction"],
    requiredTier: "personal",
  },
  {
    id: "cohere.command-r-v1:0",
    label: "Cohere Command R",
    description: "Balanced Cohere Command for agents built on Bedrock.",
    provider: "bedrock",
    family: "Cohere Command",
    contextLength: 200000,
    defaultConfig: {
      temperature: 0.25,
      topP: 0.8,
      maxTokens: 3072,
    },
    tags: ["rag"],
    requiredTier: "personal",
  },
  // Mistral
  {
    id: "mistral.mistral-large-2407-v1:0",
    label: "Mistral Large 24.07",
    description: "Mistral's flagship model via Bedrock with strong reasoning.",
    provider: "bedrock",
    family: "Mistral",
    contextLength: 200000,
    defaultConfig: {
      temperature: 0.3,
      topP: 0.9,
      maxTokens: 3072,
    },
    tags: ["reasoning"],
    requiredTier: "personal",
  },
  // Ollama - Recommended defaults (actual models detected dynamically via useLocalModels hook)
  {
    id: "ministral:3b",
    label: "Ministral 3B",
    description: "Lightweight Mistral model for fast local inference.",
    provider: "ollama",
    family: "Mistral",
    contextLength: 8000,
    defaultConfig: {
      temperature: 0.4,
      topP: 0.9,
      numCtx: 8192,
      endpoint: LOCAL_MODEL_ENDPOINTS.ollama,
    },
    tags: ["local", "fast"],
    recommended: true,
  },
  {
    id: "qwen3:4b",
    label: "Qwen3 4B",
    description: "Compact Qwen model for local reasoning and coding.",
    provider: "ollama",
    family: "Qwen",
    contextLength: 8000,
    defaultConfig: {
      temperature: 0.4,
      topP: 0.9,
      numCtx: 8192,
      endpoint: LOCAL_MODEL_ENDPOINTS.ollama,
    },
    tags: ["local", "reasoning"],
    recommended: true,
  },
  // LMStudio - placeholder; actual loaded models detected dynamically via useLocalModels hook
  {
    id: "lmstudio-default",
    label: "LMStudio (Active Model)",
    description: "Uses whichever model is currently loaded in LMStudio. OpenAI-compatible API.",
    provider: "lmstudio",
    family: "LMStudio",
    contextLength: 8000,
    defaultConfig: {
      temperature: 0.4,
      topP: 0.9,
      maxTokens: 4096,
      endpoint: LOCAL_MODEL_ENDPOINTS.lmstudio,
    },
    tags: ["local", "general"],
    recommended: true,
  },
];

export function listModelsByProvider( provider: ModelProvider ): ModelMetadata[] {
  return MODEL_CATALOG.filter( ( model ) => model.provider === provider );
}

export function getModelMetadata( id: string ): ModelMetadata | undefined {
  return MODEL_CATALOG.find( ( model ) => model.id === id );
}

/**
 * Merge detected local models with the static catalog defaults.
 * Detected models take precedence; recommended defaults are kept
 * only if they weren't already detected (avoids duplicates).
 */
export function mergeLocalModels(
  provider: "ollama" | "lmstudio",
  detected: ModelMetadata[]
): ModelMetadata[] {
  const defaults = MODEL_CATALOG.filter( ( m ) => m.provider === provider );
  if ( detected.length === 0 ) return defaults;

  const detectedIds = new Set( detected.map( ( d ) => d.id ) );
  const kept = defaults.filter( ( d ) => !detectedIds.has( d.id ) );
  return [...detected, ...kept];
}

/**
 * Look up a model from both the static catalog and an additional
 * dynamic list (e.g. detected models from useLocalModels).
 */
export function getModelFromCatalogOrDetected(
  id: string,
  extraModels: ModelMetadata[] = []
): ModelMetadata | undefined {
  return (
    MODEL_CATALOG.find( ( m ) => m.id === id ) ??
    extraModels.find( ( m ) => m.id === id )
  );
}
