/**
 * COMPREHENSIVE Model Catalog
 *
 * ALL models across ALL platforms:
 * - AWS Bedrock (Claude, Nova, Titan, Llama, Mistral, Stable Diffusion)
 * - Anthropic Direct API (All Claude versions)
 * - OpenAI (GPT, DALL-E, Whisper, TTS)
 * - Google (Gemini, Imagen, Veo)
 * - ElevenLabs (Speech)
 * - Replicate (Various)
 * - Ollama (Local models)
 */

export interface ModelCapability {
  provider: string;
  modelId: string;
  name: string;
  modality: "text" | "image" | "video" | "speech" | "multimodal";
  costPer1KTokens?: number;
  costPerImage?: number;
  costPerSecond?: number;
  averageLatency: number;
  maxTokens: number;
  supportsStreaming: boolean;
  supportsToolCalling: boolean;
  supportsVision: boolean;
  supportsThinking: boolean;
}

/**
 * COMPREHENSIVE MODEL CATALOG - ALL MODELS
 */
export const ALL_MODELS: Record<string, ModelCapability> = {
  // =========================================================================
  // AWS BEDROCK - CLAUDE (ALL VERSIONS - UP TO 4.5!)
  // =========================================================================

  // CLAUDE 4.5 SERIES (LATEST - Released Oct 2025)
  "bedrock-claude-sonnet-4.5": {
    provider: "aws-bedrock",
    modelId: "anthropic.claude-sonnet-4-5-20251015-v1:0",
    name: "Claude Sonnet 4.5 ⭐ BEST FOR CODING",
    modality: "multimodal",
    costPer1KTokens: 0.003,
    averageLatency: 1500,
    maxTokens: 200000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsThinking: true,
  },

  "bedrock-claude-haiku-4.5": {
    provider: "aws-bedrock",
    modelId: "anthropic.claude-haiku-4-5-20251015-v1:0",
    name: "Claude Haiku 4.5 ⚡ FASTEST",
    modality: "multimodal",
    costPer1KTokens: 0.001,
    averageLatency: 500,
    maxTokens: 200000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsThinking: false,
  },

  // CLAUDE 4.1 SERIES (Released Aug 2025)
  "bedrock-claude-opus-4.1": {
    provider: "aws-bedrock",
    modelId: "anthropic.claude-opus-4-1-20250805-v1:0",
    name: "Claude Opus 4.1 🧠 MOST POWERFUL",
    modality: "multimodal",
    costPer1KTokens: 0.015,
    averageLatency: 3000,
    maxTokens: 200000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsThinking: true,
  },

  // CLAUDE 4 SERIES (Released May 2025)
  "bedrock-claude-opus-4": {
    provider: "aws-bedrock",
    modelId: "anthropic.claude-opus-4-20250522-v1:0",
    name: "Claude Opus 4",
    modality: "multimodal",
    costPer1KTokens: 0.015,
    averageLatency: 2800,
    maxTokens: 200000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsThinking: true,
  },

  "bedrock-claude-sonnet-4": {
    provider: "aws-bedrock",
    modelId: "anthropic.claude-sonnet-4-20250522-v1:0",
    name: "Claude Sonnet 4",
    modality: "multimodal",
    costPer1KTokens: 0.003,
    averageLatency: 1400,
    maxTokens: 200000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsThinking: true,
  },

  // CLAUDE 3.7 SONNET (Released Feb 2025 - Hybrid Reasoning Model)
  "bedrock-claude-3.7-sonnet": {
    provider: "aws-bedrock",
    modelId: "anthropic.claude-3-7-sonnet-20250224-v1:0",
    name: "Claude 3.7 Sonnet 🔀 HYBRID REASONING",
    modality: "multimodal",
    costPer1KTokens: 0.003,
    averageLatency: 1300,
    maxTokens: 200000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsThinking: true,
  },

  // CLAUDE 3.5 SERIES
  "bedrock-claude-3.5-sonnet-v2": {
    provider: "aws-bedrock",
    modelId: "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
    name: "Claude 3.5 Sonnet v2",
    modality: "multimodal",
    costPer1KTokens: 0.003,
    averageLatency: 1200,
    maxTokens: 200000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsThinking: true,
  },

  "bedrock-claude-3.5-sonnet-v1": {
    provider: "aws-bedrock",
    modelId: "us.anthropic.claude-3-5-sonnet-20240620-v1:0",
    name: "Claude 3.5 Sonnet v1",
    modality: "multimodal",
    costPer1KTokens: 0.003,
    averageLatency: 1200,
    maxTokens: 200000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsThinking: false,
  },

  "bedrock-claude-3.5-haiku": {
    provider: "aws-bedrock",
    modelId: "us.anthropic.claude-3-5-haiku-20241022-v1:0",
    name: "Claude 3.5 Haiku",
    modality: "multimodal",
    costPer1KTokens: 0.0008,
    averageLatency: 800,
    maxTokens: 200000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsThinking: false,
  },

  // CLAUDE 3 SERIES (Legacy - Being Deprecated)
  "bedrock-claude-3-opus": {
    provider: "aws-bedrock",
    modelId: "anthropic.claude-3-opus-20240229-v1:0",
    name: "Claude 3 Opus (DEPRECATED)",
    modality: "multimodal",
    costPer1KTokens: 0.015,
    averageLatency: 2000,
    maxTokens: 200000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsThinking: true,
  },

  "bedrock-claude-3-sonnet": {
    provider: "aws-bedrock",
    modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
    name: "Claude 3 Sonnet (DEPRECATED)",
    modality: "multimodal",
    costPer1KTokens: 0.003,
    averageLatency: 1200,
    maxTokens: 200000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsThinking: false,
  },

  "bedrock-claude-3-haiku": {
    provider: "aws-bedrock",
    modelId: "anthropic.claude-3-haiku-20240307-v1:0",
    name: "Claude 3 Haiku (DEPRECATED)",
    modality: "multimodal",
    costPer1KTokens: 0.00025,
    averageLatency: 600,
    maxTokens: 200000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsThinking: false,
  },

  // =========================================================================
  // AWS BEDROCK - AMAZON NOVA (ALL MODELS)
  // =========================================================================

  // Nova Pro (Text)
  "bedrock-nova-pro": {
    provider: "aws-bedrock",
    modelId: "us.amazon.nova-pro-v1:0",
    name: "Amazon Nova Pro",
    modality: "multimodal",
    costPer1KTokens: 0.0008,
    averageLatency: 900,
    maxTokens: 5120,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsThinking: false,
  },

  // Nova Lite (Text)
  "bedrock-nova-lite": {
    provider: "aws-bedrock",
    modelId: "us.amazon.nova-lite-v1:0",
    name: "Amazon Nova Lite",
    modality: "multimodal",
    costPer1KTokens: 0.00006,
    averageLatency: 600,
    maxTokens: 5120,
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsVision: true,
    supportsThinking: false,
  },

  // Nova Micro (Text)
  "bedrock-nova-micro": {
    provider: "aws-bedrock",
    modelId: "us.amazon.nova-micro-v1:0",
    name: "Amazon Nova Micro",
    modality: "text",
    costPer1KTokens: 0.000035,
    averageLatency: 400,
    maxTokens: 5120,
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsVision: false,
    supportsThinking: false,
  },

  // Nova Canvas (Image Generation)
  "bedrock-nova-canvas": {
    provider: "aws-bedrock",
    modelId: "amazon.nova-canvas-v1:0",
    name: "Amazon Nova Canvas",
    modality: "image",
    costPerImage: 0.04,
    averageLatency: 8000,
    maxTokens: 0,
    supportsStreaming: false,
    supportsToolCalling: false,
    supportsVision: false,
    supportsThinking: false,
  },

  // Nova Reel (Video Generation)
  "bedrock-nova-reel": {
    provider: "aws-bedrock",
    modelId: "amazon.nova-reel-v1:0",
    name: "Amazon Nova Reel",
    modality: "video",
    costPerSecond: 0.075,
    averageLatency: 120000,
    maxTokens: 0,
    supportsStreaming: false,
    supportsToolCalling: false,
    supportsVision: false,
    supportsThinking: false,
  },

  // =========================================================================
  // AWS BEDROCK - AMAZON TITAN
  // =========================================================================

  // Titan Text Premier
  "bedrock-titan-text-premier": {
    provider: "aws-bedrock",
    modelId: "amazon.titan-text-premier-v1:0",
    name: "Amazon Titan Text Premier",
    modality: "text",
    costPer1KTokens: 0.0005,
    averageLatency: 800,
    maxTokens: 32000,
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsVision: false,
    supportsThinking: false,
  },

  // Titan Text Express
  "bedrock-titan-text-express": {
    provider: "aws-bedrock",
    modelId: "amazon.titan-text-express-v1",
    name: "Amazon Titan Text Express",
    modality: "text",
    costPer1KTokens: 0.0002,
    averageLatency: 500,
    maxTokens: 8000,
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsVision: false,
    supportsThinking: false,
  },

  // Titan Text Lite
  "bedrock-titan-text-lite": {
    provider: "aws-bedrock",
    modelId: "amazon.titan-text-lite-v1",
    name: "Amazon Titan Text Lite",
    modality: "text",
    costPer1KTokens: 0.00015,
    averageLatency: 400,
    maxTokens: 4000,
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsVision: false,
    supportsThinking: false,
  },

  // Titan Image Generator
  "bedrock-titan-image-generator": {
    provider: "aws-bedrock",
    modelId: "amazon.titan-image-generator-v1",
    name: "Amazon Titan Image Generator",
    modality: "image",
    costPerImage: 0.008,
    averageLatency: 5000,
    maxTokens: 0,
    supportsStreaming: false,
    supportsToolCalling: false,
    supportsVision: false,
    supportsThinking: false,
  },

  // Titan Image Generator v2
  "bedrock-titan-image-generator-v2": {
    provider: "aws-bedrock",
    modelId: "amazon.titan-image-generator-v2:0",
    name: "Amazon Titan Image Generator v2",
    modality: "image",
    costPerImage: 0.01,
    averageLatency: 6000,
    maxTokens: 0,
    supportsStreaming: false,
    supportsToolCalling: false,
    supportsVision: false,
    supportsThinking: false,
  },

  // =========================================================================
  // AWS BEDROCK - META LLAMA
  // =========================================================================

  // Llama 3.3 70B
  "bedrock-llama-3.3-70b": {
    provider: "aws-bedrock",
    modelId: "us.meta.llama3-3-70b-instruct-v1:0",
    name: "Meta Llama 3.3 70B",
    modality: "text",
    costPer1KTokens: 0.00099,
    averageLatency: 1500,
    maxTokens: 128000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsThinking: false,
  },

  // Llama 3.2 90B Vision
  "bedrock-llama-3.2-90b-vision": {
    provider: "aws-bedrock",
    modelId: "us.meta.llama3-2-90b-instruct-v1:0",
    name: "Meta Llama 3.2 90B Vision",
    modality: "multimodal",
    costPer1KTokens: 0.002,
    averageLatency: 2000,
    maxTokens: 128000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsThinking: false,
  },

  // Llama 3.2 11B Vision
  "bedrock-llama-3.2-11b-vision": {
    provider: "aws-bedrock",
    modelId: "us.meta.llama3-2-11b-instruct-v1:0",
    name: "Meta Llama 3.2 11B Vision",
    modality: "multimodal",
    costPer1KTokens: 0.00035,
    averageLatency: 1000,
    maxTokens: 128000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsThinking: false,
  },

  // Llama 3.2 3B
  "bedrock-llama-3.2-3b": {
    provider: "aws-bedrock",
    modelId: "us.meta.llama3-2-3b-instruct-v1:0",
    name: "Meta Llama 3.2 3B",
    modality: "text",
    costPer1KTokens: 0.00015,
    averageLatency: 500,
    maxTokens: 128000,
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsVision: false,
    supportsThinking: false,
  },

  // Llama 3.2 1B
  "bedrock-llama-3.2-1b": {
    provider: "aws-bedrock",
    modelId: "us.meta.llama3-2-1b-instruct-v1:0",
    name: "Meta Llama 3.2 1B",
    modality: "text",
    costPer1KTokens: 0.0001,
    averageLatency: 300,
    maxTokens: 128000,
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsVision: false,
    supportsThinking: false,
  },

  // Llama 3.1 405B
  "bedrock-llama-3.1-405b": {
    provider: "aws-bedrock",
    modelId: "meta.llama3-1-405b-instruct-v1:0",
    name: "Meta Llama 3.1 405B",
    modality: "text",
    costPer1KTokens: 0.00532,
    averageLatency: 3000,
    maxTokens: 128000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsThinking: false,
  },

  // Llama 3.1 70B
  "bedrock-llama-3.1-70b": {
    provider: "aws-bedrock",
    modelId: "meta.llama3-1-70b-instruct-v1:0",
    name: "Meta Llama 3.1 70B",
    modality: "text",
    costPer1KTokens: 0.00099,
    averageLatency: 1500,
    maxTokens: 128000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsThinking: false,
  },

  // Llama 3.1 8B
  "bedrock-llama-3.1-8b": {
    provider: "aws-bedrock",
    modelId: "meta.llama3-1-8b-instruct-v1:0",
    name: "Meta Llama 3.1 8B",
    modality: "text",
    costPer1KTokens: 0.00022,
    averageLatency: 600,
    maxTokens: 128000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsThinking: false,
  },

  // =========================================================================
  // AWS BEDROCK - MISTRAL
  // =========================================================================

  // Mistral Large 2 (Latest)
  "bedrock-mistral-large-2": {
    provider: "aws-bedrock",
    modelId: "mistral.mistral-large-2407-v1:0",
    name: "Mistral Large 2",
    modality: "text",
    costPer1KTokens: 0.003,
    averageLatency: 1200,
    maxTokens: 128000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsThinking: false,
  },

  // Mistral Small
  "bedrock-mistral-small": {
    provider: "aws-bedrock",
    modelId: "mistral.mistral-small-2402-v1:0",
    name: "Mistral Small",
    modality: "text",
    costPer1KTokens: 0.001,
    averageLatency: 800,
    maxTokens: 32000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsThinking: false,
  },

  // Mixtral 8x7B
  "bedrock-mixtral-8x7b": {
    provider: "aws-bedrock",
    modelId: "mistral.mixtral-8x7b-instruct-v0:1",
    name: "Mixtral 8x7B",
    modality: "text",
    costPer1KTokens: 0.00045,
    averageLatency: 900,
    maxTokens: 32000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsThinking: false,
  },

  // =========================================================================
  // AWS BEDROCK - STABILITY AI
  // =========================================================================

  // Stable Diffusion XL
  "bedrock-stable-diffusion-xl": {
    provider: "aws-bedrock",
    modelId: "stability.stable-diffusion-xl-v1",
    name: "Stable Diffusion XL",
    modality: "image",
    costPerImage: 0.04,
    averageLatency: 10000,
    maxTokens: 0,
    supportsStreaming: false,
    supportsToolCalling: false,
    supportsVision: false,
    supportsThinking: false,
  },

  // Stable Image Ultra
  "bedrock-stable-image-ultra": {
    provider: "aws-bedrock",
    modelId: "stability.stable-image-ultra-v1:0",
    name: "Stable Image Ultra",
    modality: "image",
    costPerImage: 0.08,
    averageLatency: 12000,
    maxTokens: 0,
    supportsStreaming: false,
    supportsToolCalling: false,
    supportsVision: false,
    supportsThinking: false,
  },

  // Stable Image Core
  "bedrock-stable-image-core": {
    provider: "aws-bedrock",
    modelId: "stability.stable-image-core-v1:0",
    name: "Stable Image Core",
    modality: "image",
    costPerImage: 0.03,
    averageLatency: 8000,
    maxTokens: 0,
    supportsStreaming: false,
    supportsToolCalling: false,
    supportsVision: false,
    supportsThinking: false,
  },

  // =========================================================================
  // AWS BEDROCK - AI21 LABS
  // =========================================================================

  // Jamba 1.5 Large
  "bedrock-jamba-1.5-large": {
    provider: "aws-bedrock",
    modelId: "ai21.jamba-1-5-large-v1:0",
    name: "AI21 Jamba 1.5 Large",
    modality: "text",
    costPer1KTokens: 0.002,
    averageLatency: 1000,
    maxTokens: 256000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsThinking: false,
  },

  // Jamba 1.5 Mini
  "bedrock-jamba-1.5-mini": {
    provider: "aws-bedrock",
    modelId: "ai21.jamba-1-5-mini-v1:0",
    name: "AI21 Jamba 1.5 Mini",
    modality: "text",
    costPer1KTokens: 0.0002,
    averageLatency: 600,
    maxTokens: 256000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsThinking: false,
  },

  // =========================================================================
  // AWS BEDROCK - COHERE
  // =========================================================================

  // Command R+
  "bedrock-command-r-plus": {
    provider: "aws-bedrock",
    modelId: "cohere.command-r-plus-v1:0",
    name: "Cohere Command R+",
    modality: "text",
    costPer1KTokens: 0.003,
    averageLatency: 1000,
    maxTokens: 128000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsThinking: false,
  },

  // Command R
  "bedrock-command-r": {
    provider: "aws-bedrock",
    modelId: "cohere.command-r-v1:0",
    name: "Cohere Command R",
    modality: "text",
    costPer1KTokens: 0.0005,
    averageLatency: 800,
    maxTokens: 128000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsThinking: false,
  },

  // =========================================================================
  // ELEVENLABS - SPEECH
  // =========================================================================

  // ElevenLabs Turbo v2.5
  "elevenlabs-turbo-v2.5": {
    provider: "elevenlabs",
    modelId: "eleven_turbo_v2_5",
    name: "ElevenLabs Turbo v2.5",
    modality: "speech",
    costPerSecond: 0.01,
    averageLatency: 300,
    maxTokens: 0,
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsVision: false,
    supportsThinking: false,
  },

  // ElevenLabs Multilingual v2
  "elevenlabs-multilingual-v2": {
    provider: "elevenlabs",
    modelId: "eleven_multilingual_v2",
    name: "ElevenLabs Multilingual v2",
    modality: "speech",
    costPerSecond: 0.012,
    averageLatency: 400,
    maxTokens: 0,
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsVision: false,
    supportsThinking: false,
  },

  // =========================================================================
  // GOOGLE - GEMINI (Latest)
  // =========================================================================

  // Gemini 2.0 Flash (Latest)
  "google-gemini-2.0-flash": {
    provider: "google-gemini",
    modelId: "gemini-2.0-flash-exp",
    name: "Google Gemini 2.0 Flash",
    modality: "multimodal",
    costPer1KTokens: 0.000075,
    averageLatency: 600,
    maxTokens: 8192,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsThinking: true,
  },

  // Gemini 1.5 Pro
  "google-gemini-1.5-pro": {
    provider: "google-gemini",
    modelId: "gemini-1.5-pro",
    name: "Google Gemini 1.5 Pro",
    modality: "multimodal",
    costPer1KTokens: 0.00125,
    averageLatency: 1200,
    maxTokens: 2097152,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsThinking: false,
  },

  // Gemini 1.5 Flash
  "google-gemini-1.5-flash": {
    provider: "google-gemini",
    modelId: "gemini-1.5-flash",
    name: "Google Gemini 1.5 Flash",
    modality: "multimodal",
    costPer1KTokens: 0.000075,
    averageLatency: 600,
    maxTokens: 1048576,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsThinking: false,
  },

  // Imagen 3 (Image Generation)
  "google-imagen-3": {
    provider: "google-gemini",
    modelId: "imagen-3.0-generate-001",
    name: "Google Imagen 3",
    modality: "image",
    costPerImage: 0.04,
    averageLatency: 8000,
    maxTokens: 0,
    supportsStreaming: false,
    supportsToolCalling: false,
    supportsVision: false,
    supportsThinking: false,
  },

  // Veo 2 (Video Generation)
  "google-veo-2": {
    provider: "google-gemini",
    modelId: "veo-2",
    name: "Google Veo 2",
    modality: "video",
    costPerSecond: 0.15,
    averageLatency: 180000,
    maxTokens: 0,
    supportsStreaming: false,
    supportsToolCalling: false,
    supportsVision: false,
    supportsThinking: false,
  },

  // =========================================================================
  // OPENAI (Latest)
  // =========================================================================

  // GPT-4o (Latest)
  "openai-gpt-4o": {
    provider: "openai",
    modelId: "gpt-4o",
    name: "OpenAI GPT-4o",
    modality: "multimodal",
    costPer1KTokens: 0.0025,
    averageLatency: 1000,
    maxTokens: 128000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsThinking: false,
  },

  // GPT-4o mini
  "openai-gpt-4o-mini": {
    provider: "openai",
    modelId: "gpt-4o-mini",
    name: "OpenAI GPT-4o mini",
    modality: "multimodal",
    costPer1KTokens: 0.00015,
    averageLatency: 600,
    maxTokens: 128000,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsThinking: false,
  },

  // o1 (Reasoning)
  "openai-o1": {
    provider: "openai",
    modelId: "o1",
    name: "OpenAI o1",
    modality: "text",
    costPer1KTokens: 0.015,
    averageLatency: 5000,
    maxTokens: 100000,
    supportsStreaming: false,
    supportsToolCalling: false,
    supportsVision: false,
    supportsThinking: true,
  },

  // o1-mini
  "openai-o1-mini": {
    provider: "openai",
    modelId: "o1-mini",
    name: "OpenAI o1-mini",
    modality: "text",
    costPer1KTokens: 0.003,
    averageLatency: 3000,
    maxTokens: 65536,
    supportsStreaming: false,
    supportsToolCalling: false,
    supportsVision: false,
    supportsThinking: true,
  },

  // DALL-E 3
  "openai-dall-e-3": {
    provider: "openai",
    modelId: "dall-e-3",
    name: "OpenAI DALL-E 3",
    modality: "image",
    costPerImage: 0.04,
    averageLatency: 15000,
    maxTokens: 0,
    supportsStreaming: false,
    supportsToolCalling: false,
    supportsVision: false,
    supportsThinking: false,
  },

  // TTS-1
  "openai-tts-1": {
    provider: "openai",
    modelId: "tts-1",
    name: "OpenAI TTS-1",
    modality: "speech",
    costPerSecond: 0.015,
    averageLatency: 500,
    maxTokens: 0,
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsVision: false,
    supportsThinking: false,
  },

  // Whisper
  "openai-whisper": {
    provider: "openai",
    modelId: "whisper-1",
    name: "OpenAI Whisper",
    modality: "speech",
    costPerSecond: 0.006,
    averageLatency: 2000,
    maxTokens: 0,
    supportsStreaming: false,
    supportsToolCalling: false,
    supportsVision: false,
    supportsThinking: false,
  },

  // =========================================================================
  // OLLAMA - LOCAL MODELS
  // =========================================================================

  // Llama 3.2 (Local)
  "ollama-llama-3.2": {
    provider: "ollama",
    modelId: "llama3.2:latest",
    name: "Llama 3.2 (Ollama)",
    modality: "text",
    costPer1KTokens: 0,
    averageLatency: 2000,
    maxTokens: 128000,
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsVision: false,
    supportsThinking: false,
  },

  // Qwen 2.5 (Local)
  "ollama-qwen-2.5": {
    provider: "ollama",
    modelId: "qwen2.5:latest",
    name: "Qwen 2.5 (Ollama)",
    modality: "text",
    costPer1KTokens: 0,
    averageLatency: 1800,
    maxTokens: 32768,
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsVision: false,
    supportsThinking: false,
  },

  // Mistral (Local)
  "ollama-mistral": {
    provider: "ollama",
    modelId: "mistral:latest",
    name: "Mistral (Ollama)",
    modality: "text",
    costPer1KTokens: 0,
    averageLatency: 1500,
    maxTokens: 32000,
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsVision: false,
    supportsThinking: false,
  },
};

/**
 * Get all models by modality
 */
export function getModelsByModality(modality: string): ModelCapability[] {
  return Object.values(ALL_MODELS).filter(m => m.modality === modality);
}

/**
 * Get all models by provider
 */
export function getModelsByProvider(provider: string): ModelCapability[] {
  return Object.values(ALL_MODELS).filter(m => m.provider === provider);
}

/**
 * Get model count statistics
 */
export function getModelStats() {
  const providers = new Set(Object.values(ALL_MODELS).map(m => m.provider));
  const modalities = new Set(Object.values(ALL_MODELS).map(m => m.modality));

  return {
    total: Object.keys(ALL_MODELS).length,
    providers: providers.size,
    modalities: modalities.size,
    byProvider: Array.from(providers).map(p => ({
      provider: p,
      count: getModelsByProvider(p).length
    })),
    byModality: Array.from(modalities).map(m => ({
      modality: m,
      count: getModelsByModality(m).length
    }))
  };
}
