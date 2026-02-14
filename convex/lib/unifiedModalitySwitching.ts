/**
 * Unified Modality Switching
 *
 * Dynamically selects optimal models for ALL modalities:
 * - Text (Claude: Haiku → Sonnet)
 * - Image (Titan V2 → Nova Canvas)
 * - Video (Nova Reel variants)
 * - Speech (Polly Standard → Neural)
 *
 * Single location for all model routing decisions.
 */

import type { Doc } from "../_generated/dataModel";
import { BEDROCK_MODELS } from "../modelRegistry";

type AgentDoc = Doc<"agents">;

/**
 * Supported modalities
 */
export type Modality = "text" | "image" | "video" | "speech" | "multimodal";

/**
 * Model tier for any modality
 */
export interface UnifiedModelTier {
  modality: Modality;
  name: string;
  modelId: string;
  costPer1KTokensOrUnit: number; // USD
  speedRating: 1 | 2 | 3; // 1 = fast, 3 = slow
  qualityRating: 1 | 2 | 3; // 1 = basic, 3 = premium
  maxDuration?: number; // For video (seconds)
  maxDimensions?: { width: number; height: number };
}

// ---------------------------------------------------------------------------
// Registry model IDs — single source of truth for text & image Bedrock models
// ---------------------------------------------------------------------------
const HAIKU_ID = "anthropic.claude-haiku-4-5-20251001-v1:0";
const SONNET_ID = "anthropic.claude-sonnet-4-5-20250929-v1:0";
const TITAN_IMG_ID = "amazon.titan-image-generator-v2:0";
const NOVA_CANVAS_ID = "amazon.nova-canvas-v1:0";
const NOVA_REEL_ID = "amazon.nova-reel-v1:0";

/**
 * Helper: compute averaged cost-per-1K-tokens from registry costPer1MTokens.
 * Average = (input + output) / 2 / 1000 — matches the original blended approach.
 */
function avgCostPer1K(modelId: string): number {
  const meta = BEDROCK_MODELS[modelId];
  if (meta?.costPer1MTokens) {
    return (meta.costPer1MTokens.input + meta.costPer1MTokens.output) / 2 / 1000;
  }
  return 0;
}

/**
 * All available models across modalities.
 *
 * Text and image model IDs / names are derived from the authoritative
 * BEDROCK_MODELS registry.  Video (Nova Reel) uses the registry model ID but
 * keeps per-second pricing (not per-token).  Speech (Polly) is an AWS service,
 * not a Bedrock LLM, so its IDs are kept inline.
 *
 * NOTE: Stable Diffusion XL was removed because its model ID
 * ("stability.stable-diffusion-xl-v1") no longer exists in modelRegistry.ts.
 * Amazon Titan Image Generator updated from v1 to v2 to match the registry.
 */
export const UNIFIED_MODEL_CATALOG: Record<string, Record<string, UnifiedModelTier>> = {
  // TEXT MODELS — derived from BEDROCK_MODELS
  text: {
    haiku: {
      modality: "text",
      name: BEDROCK_MODELS[HAIKU_ID]?.name ?? "Claude 4.5 Haiku",
      modelId: HAIKU_ID,
      costPer1KTokensOrUnit: avgCostPer1K(HAIKU_ID),
      speedRating: 1,
      qualityRating: 1,
    },
    sonnet: {
      modality: "text",
      name: BEDROCK_MODELS[SONNET_ID]?.name ?? "Claude 4.5 Sonnet",
      modelId: SONNET_ID,
      costPer1KTokensOrUnit: avgCostPer1K(SONNET_ID),
      speedRating: 2,
      qualityRating: 3,
    },
  },

  // IMAGE MODELS — Titan V2 and Nova Canvas from registry
  image: {
    titan: {
      modality: "image",
      name: BEDROCK_MODELS[TITAN_IMG_ID]?.name ?? "Titan Image Generator V2",
      modelId: TITAN_IMG_ID,
      costPer1KTokensOrUnit: 0.008, // Per-image pricing (not per-token)
      speedRating: 1,
      qualityRating: 1,
      maxDimensions: { width: 512, height: 512 },
    },
    novaCanvas: {
      modality: "image",
      name: BEDROCK_MODELS[NOVA_CANVAS_ID]?.name ?? "Nova Canvas",
      modelId: NOVA_CANVAS_ID,
      costPer1KTokensOrUnit: 0.040, // Per-image pricing
      speedRating: 2,
      qualityRating: 2,
      maxDimensions: { width: 1024, height: 1024 },
    },
  },

  // VIDEO MODELS — Nova Reel ID from registry, pricing is per-second
  video: {
    novaReelStandard: {
      modality: "video",
      name: "Amazon Nova Reel (Standard)",
      modelId: NOVA_REEL_ID,
      costPer1KTokensOrUnit: 0.063, // $0.063 per second
      speedRating: 2,
      qualityRating: 2,
      maxDuration: 6,
    },
    novaReelPremium: {
      modality: "video",
      name: "Amazon Nova Reel (Premium)",
      modelId: NOVA_REEL_ID, // Same model, different config
      costPer1KTokensOrUnit: 0.095, // $0.095 per second (higher quality settings)
      speedRating: 3,
      qualityRating: 3,
      maxDuration: 6,
    },
  },

  // SPEECH MODELS — AWS Polly service IDs (not Bedrock LLMs, kept inline)
  speech: {
    pollyStandard: {
      modality: "speech",
      name: "Amazon Polly (Standard)",
      modelId: "polly-standard",
      costPer1KTokensOrUnit: 0.004, // $4.00 per 1M characters
      speedRating: 1,
      qualityRating: 1,
    },
    pollyNeural: {
      modality: "speech",
      name: "Amazon Polly (Neural)",
      modelId: "polly-neural",
      costPer1KTokensOrUnit: 0.016, // $16.00 per 1M characters
      speedRating: 2,
      qualityRating: 3,
    },
  },
};

/**
 * Detect modality from user message
 */
export function detectModality( message: string ): Modality {
  const lower = message.toLowerCase();

  // Check for multiple modalities
  const hasVideo = /video|clip|animation|footage|reel|explainer/i.test( lower );
  const hasImage = /image|picture|photo|illustration|graphic|banner|thumbnail/i.test( lower );
  const hasSpeech = /voice|speech|audio|narration|voiceover|tts|text.to.speech/i.test( lower );
  const hasText = true; // Always has text (it's a text message)

  const modalityCount = [hasVideo, hasImage, hasSpeech, hasText].filter( Boolean ).length;

  if ( modalityCount > 2 || ( hasVideo && hasImage ) ) {
    return "multimodal";
  }

  if ( hasVideo ) return "video";
  if ( hasImage ) return "image";
  if ( hasSpeech ) return "speech";
  return "text";
}

/**
 * Complexity signals for ANY modality
 */
export interface UnifiedComplexitySignals {
  // Message characteristics
  messageLength: number;
  hasCodeBlocks: boolean;
  hasMultipleQuestions: boolean;
  hasTechnicalTerms: boolean;

  // Modality-specific signals
  modalitySignals: {
    // Image
    requestsHighResolution?: boolean;
    requestsMultipleVariations?: boolean;
    requestsComplexStyle?: boolean;
    requestsPhotoRealism?: boolean;

    // Video
    requestsLongDuration?: boolean;
    requestsMultipleScenes?: boolean;
    requestsAnimation?: boolean;
    requestsProfessionalQuality?: boolean;

    // Speech
    requestsMultipleVoices?: boolean;
    requestsEmotionalTone?: boolean;
    requestsLongForm?: boolean;

    // Text
    requestsDeepReasoning?: boolean;
    requestsStepByStep?: boolean;
  };

  // Context
  conversationLength: number;
  previousFailures: number;
  userExplicitQualityRequest: boolean;
}

/**
 * Analyze complexity for ANY modality
 */
export function analyzeUnifiedComplexity(
  message: string,
  modality: Modality,
  conversationHistory: Array<{ role: string; content: string }> = []
): UnifiedComplexitySignals {
  const lower = message.toLowerCase();

  // Base signals
  const messageLength = message.length;
  const hasCodeBlocks = /```|`/.test( message );
  const hasMultipleQuestions = ( message.match( /\?/g ) || [] ).length > 1;
  const hasTechnicalTerms = /algorithm|architecture|implementation|framework|api/i.test( lower );

  // Context
  const conversationLength = conversationHistory.length;
  const previousFailures = conversationHistory.filter( ( m ) =>
    m.role === "assistant" && /error|failed|couldn't/i.test( m.content )
  ).length;
  const userExplicitQualityRequest = /high.quality|premium|professional|best/i.test( lower );

  // Modality-specific signals
  const modalitySignals: UnifiedComplexitySignals["modalitySignals"] = {};

  switch ( modality ) {
    case "image":
      modalitySignals.requestsHighResolution = /high.res|hd|4k|large|1920|2048/i.test( lower );
      modalitySignals.requestsMultipleVariations = /variation|multiple|different|several/i.test(
        lower
      );
      modalitySignals.requestsComplexStyle = /artistic|detailed|intricate|complex|realistic/i.test(
        lower
      );
      modalitySignals.requestsPhotoRealism = /photorealistic|photo.realistic|like.a.photo/i.test(
        lower
      );
      break;

    case "video":
      modalitySignals.requestsLongDuration = /\d+.second|long|extended|full/i.test( lower );
      modalitySignals.requestsMultipleScenes = /scene|transition|sequence|story/i.test( lower );
      modalitySignals.requestsAnimation = /animate|animation|motion|movement/i.test( lower );
      modalitySignals.requestsProfessionalQuality = /professional|cinematic|polished/i.test( lower );
      break;

    case "speech":
      modalitySignals.requestsMultipleVoices = /voices|characters|dialogue/i.test( lower );
      modalitySignals.requestsEmotionalTone = /emotion|expressive|natural|human/i.test( lower );
      modalitySignals.requestsLongForm = /podcast|audiobook|narration|long/i.test( lower );
      break;

    case "text":
      modalitySignals.requestsDeepReasoning = /analyze|explain|prove|reason|why/i.test( lower );
      modalitySignals.requestsStepByStep = /step.by.step|break.down|detail/i.test( lower );
      break;
  }

  return {
    messageLength,
    hasCodeBlocks,
    hasMultipleQuestions,
    hasTechnicalTerms,
    modalitySignals,
    conversationLength,
    previousFailures,
    userExplicitQualityRequest,
  };
}

/**
 * Calculate complexity score (0-100) for ANY modality
 */
export function calculateUnifiedComplexityScore(
  signals: UnifiedComplexitySignals,
  modality: Modality
): number {
  let score = 0;

  // Base complexity (0-40 points)
  if ( signals.messageLength > 500 ) score += 20;
  else if ( signals.messageLength > 200 ) score += 10;
  else score += 5;

  if ( signals.hasCodeBlocks ) score += 5;
  if ( signals.hasMultipleQuestions ) score += 5;
  if ( signals.hasTechnicalTerms ) score += 10;

  // Context (0-20 points)
  if ( signals.conversationLength > 10 ) score += 10;
  else if ( signals.conversationLength > 5 ) score += 5;

  if ( signals.previousFailures > 0 ) score += 10;

  // Modality-specific complexity (0-40 points)
  const ms = signals.modalitySignals;

  switch ( modality ) {
    case "image":
      if ( ms.requestsHighResolution ) score += 10;
      if ( ms.requestsMultipleVariations ) score += 10;
      if ( ms.requestsComplexStyle ) score += 10;
      if ( ms.requestsPhotoRealism ) score += 10;
      break;

    case "video":
      if ( ms.requestsLongDuration ) score += 10;
      if ( ms.requestsMultipleScenes ) score += 15;
      if ( ms.requestsAnimation ) score += 5;
      if ( ms.requestsProfessionalQuality ) score += 10;
      break;

    case "speech":
      if ( ms.requestsMultipleVoices ) score += 15;
      if ( ms.requestsEmotionalTone ) score += 10;
      if ( ms.requestsLongForm ) score += 15;
      break;

    case "text":
      if ( ms.requestsDeepReasoning ) score += 20;
      if ( ms.requestsStepByStep ) score += 20;
      break;
  }

  // User explicit quality request (bonus 20 points)
  if ( signals.userExplicitQualityRequest ) score += 20;

  return Math.min( score, 100 );
}

/**
 * Select optimal model for ANY modality
 */
export function selectUnifiedModel(
  modality: Modality,
  complexityScore: number,
  options: {
    preferCost?: boolean;
    preferSpeed?: boolean;
    preferQuality?: boolean;
    userTier?: "freemium" | "personal" | "enterprise";
  } = {}
): UnifiedModelTier {
  const { preferCost = false, preferSpeed = false, preferQuality = false, userTier = "freemium" } =
    options;

  // Fallback "multimodal" to "text" since UNIFIED_MODEL_CATALOG has no multimodal key
  const effectiveModality = modality === "multimodal" ? "text" : modality;
  const models = UNIFIED_MODEL_CATALOG[effectiveModality];
  if ( !models ) {
    throw new Error( `No models available for modality: ${modality}` );
  }

  const availableModels = Object.values( models );

  // Freemium: always cheapest
  if ( userTier === "freemium" ) {
    return availableModels.sort(
      ( a, b ) => a.costPer1KTokensOrUnit - b.costPer1KTokensOrUnit
    )[0];
  }

  // Complexity-based routing
  if ( complexityScore < 30 ) {
    // Low complexity → Cheapest/Fastest
    return availableModels.sort( ( a, b ) => {
      if ( preferSpeed ) return a.speedRating - b.speedRating;
      return a.costPer1KTokensOrUnit - b.costPer1KTokensOrUnit;
    } )[0];
  } else if ( complexityScore < 60 ) {
    // Medium complexity → Balanced
    return availableModels.sort( ( a, b ) => {
      if ( preferQuality ) return b.qualityRating - a.qualityRating;
      if ( preferCost ) return a.costPer1KTokensOrUnit - b.costPer1KTokensOrUnit;
      return a.speedRating - b.speedRating;
    } )[Math.min( 1, availableModels.length - 1 )];
  } else {
    // High complexity → Best quality
    return availableModels.sort( ( a, b ) => b.qualityRating - a.qualityRating )[0];
  }
}

/**
 * Unified model switching decision
 */
export interface UnifiedModelDecision {
  modality: Modality;
  selectedModel: UnifiedModelTier;
  complexityScore: number;
  reasoning: string;
  estimatedCost: number;
  signals: UnifiedComplexitySignals;
}

/**
 * Make unified model switching decision for ANY modality
 */
export function decideUnifiedModelSwitch(
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
  agent: AgentDoc,
  options: {
    preferCost?: boolean;
    preferSpeed?: boolean;
    preferQuality?: boolean;
    userTier?: "freemium" | "personal" | "enterprise";
    explicitModality?: Modality; // Override auto-detection
  } = {}
): UnifiedModelDecision {
  // Detect modality
  const modality = options.explicitModality || detectModality( message );

  // Analyze complexity
  const signals = analyzeUnifiedComplexity( message, modality, conversationHistory );
  const complexityScore = calculateUnifiedComplexityScore( signals, modality );

  // Select model
  const selectedModel = selectUnifiedModel( modality, complexityScore, options );

  // Calculate estimated cost
  let estimatedCost = 0;
  switch ( modality ) {
    case "text":
      estimatedCost = ( 1000 / 1000 ) * selectedModel.costPer1KTokensOrUnit; // 1K tokens avg
      break;
    case "image":
      estimatedCost = selectedModel.costPer1KTokensOrUnit; // Per image
      break;
    case "video":
      estimatedCost = 6 * selectedModel.costPer1KTokensOrUnit; // 6 seconds
      break;
    case "speech":
      estimatedCost = ( 500 / 1000 ) * selectedModel.costPer1KTokensOrUnit; // 500 chars avg
      break;
  }

  // Generate reasoning
  let reasoning = `Modality: ${modality}. Complexity: ${complexityScore}/100. `;

  if ( complexityScore < 30 ) {
    reasoning += `Low complexity - using ${selectedModel.name} (fast, cost-effective).`;
  } else if ( complexityScore < 60 ) {
    reasoning += `Moderate complexity - using ${selectedModel.name} (balanced).`;
  } else {
    reasoning += `High complexity - using ${selectedModel.name} (premium quality).`;
  }

  if ( signals.userExplicitQualityRequest ) {
    reasoning += " User requested high quality.";
  }

  if ( signals.previousFailures > 0 ) {
    reasoning += " Escalating due to previous failures.";
  }

  return {
    modality,
    selectedModel,
    complexityScore,
    reasoning,
    estimatedCost,
    signals,
  };
}

/**
 * Get model configuration for execution
 */
export function getModelExecutionConfig( decision: UnifiedModelDecision ): any {
  const { modality, selectedModel } = decision;

  switch ( modality ) {
    case "text":
      return {
        modelId: selectedModel.modelId,
        maxTokens: 4096,
        temperature: 1,
        thinking: {
          type: "enabled",
          budget_tokens: 3000,
        },
      };

    case "image":
      return {
        modelId: selectedModel.modelId,
        taskType: "TEXT_IMAGE",
        imageGenerationConfig: {
          numberOfImages: 1,
          quality: selectedModel.qualityRating === 3 ? "premium" : "standard",
          height: selectedModel.maxDimensions?.height || 1024,
          width: selectedModel.maxDimensions?.width || 1024,
        },
      };

    case "video":
      return {
        modelId: selectedModel.modelId,
        taskType: "TEXT_VIDEO",
        videoGenerationConfig: {
          durationSeconds: selectedModel.maxDuration || 6,
          fps: selectedModel.qualityRating === 3 ? 60 : 24,
          dimension: selectedModel.qualityRating === 3 ? "1920x1080" : "1280x720",
        },
      };

    case "speech":
      return {
        engine: selectedModel.modelId.includes( "neural" ) ? "neural" : "standard",
        voiceId: "Joanna", // Can be configured
        languageCode: "en-US",
      };

    default:
      throw new Error( `Unknown modality: ${modality}` );
  }
}
