/**
 * Token-Based Billing — Single Source of Truth
 *
 * Extracts token usage from Bedrock responses (all providers),
 * calculates billing units using 2x markup over AWS cost.
 *
 * Formula:
 *   awsCost = (inputTokens × inputPer1M / 1M) + (outputTokens × outputPer1M / 1M)
 *   userCharge = awsCost × 2
 *   units = ceil(userCharge / 0.05)   // $0.05 per unit, minimum 1
 *
 * Imports costPer1MTokens from modelRegistry.ts (the authoritative pricing source).
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface TokenCostBreakdown {
  awsCostUsd: number;
  userChargeUsd: number;
  units: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Price per billing unit charged to the user */
const UNIT_PRICE_USD = 0.05;

/** Markup multiplier over AWS cost */
const MARKUP_MULTIPLIER = 2;

/**
 * Approximate tokens-per-character ratio for estimation.
 * English text averages ~4 characters per token across most models.
 * We round UP to be conservative (charge slightly more than actual).
 */
const CHARS_PER_TOKEN = 4;

// ─── Token Extraction ────────────────────────────────────────────────────────

/**
 * Extract token usage from a Bedrock response body, normalizing across
 * all provider-specific formats.
 *
 * For InvokeModelCommand: pass the parsed JSON from response.body.
 * For ConverseCommand: pass response.usage directly (standardized by AWS SDK).
 *
 * Returns zeros if extraction fails. When that happens, callers should
 * use estimateTokenUsage(inputText, outputText) for a character-based
 * estimate. This ensures we ALWAYS meter usage, even for providers that
 * don't return token counts.
 */
export function extractTokenUsage(
  responseBody: any,
  modelId: string,
): TokenUsage {
  if ( !responseBody ) {
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  }

  // ConverseCommand format (AWS SDK standardized):
  //   response.usage = { inputTokens: N, outputTokens: N }
  if (
    responseBody.inputTokens !== undefined &&
    responseBody.outputTokens !== undefined
  ) {
    const input = responseBody.inputTokens || 0;
    const output = responseBody.outputTokens || 0;
    return { inputTokens: input, outputTokens: output, totalTokens: input + output };
  }

  // Anthropic Claude / DeepSeek / Mistral / Moonshot (Kimi):
  //   usage.input_tokens, usage.output_tokens
  if ( responseBody.usage?.input_tokens !== undefined ) {
    const input = responseBody.usage.input_tokens || 0;
    const output = responseBody.usage.output_tokens || 0;
    return { inputTokens: input, outputTokens: output, totalTokens: input + output };
  }

  // Meta / Llama:
  //   prompt_token_count, generation_token_count
  if ( responseBody.prompt_token_count !== undefined ) {
    const input = responseBody.prompt_token_count || 0;
    const output = responseBody.generation_token_count || 0;
    return { inputTokens: input, outputTokens: output, totalTokens: input + output };
  }

  // Amazon Titan:
  //   inputTokenCount, outputTokenCount (top-level)
  if ( responseBody.inputTokenCount !== undefined ) {
    const input = responseBody.inputTokenCount || 0;
    const output = responseBody.outputTokenCount || 0;
    return { inputTokens: input, outputTokens: output, totalTokens: input + output };
  }

  // Cohere (billed_units variant):
  //   meta.billed_units.input_tokens, meta.billed_units.output_tokens
  if ( responseBody.meta?.billed_units?.input_tokens !== undefined ) {
    const input = responseBody.meta.billed_units.input_tokens || 0;
    const output = responseBody.meta.billed_units.output_tokens || 0;
    return { inputTokens: input, outputTokens: output, totalTokens: input + output };
  }

  // Cohere (legacy variant):
  //   prompt_tokens, generation_tokens
  if ( responseBody.prompt_tokens !== undefined ) {
    const input = responseBody.prompt_tokens || 0;
    const output = responseBody.generation_tokens || 0;
    return { inputTokens: input, outputTokens: output, totalTokens: input + output };
  }

  // AI21:
  //   usage.prompt_tokens, usage.completion_tokens
  if ( responseBody.usage?.prompt_tokens !== undefined ) {
    const input = responseBody.usage.prompt_tokens || 0;
    const output = responseBody.usage.completion_tokens || 0;
    return { inputTokens: input, outputTokens: output, totalTokens: input + output };
  }

  // Could not extract from structured fields — return zeros.
  // Callers should use estimateTokenUsage() with the raw text as a fallback.
  console.warn(
    `[tokenBilling] Could not extract token usage from response for model ${modelId}. ` +
    `Use estimateTokenUsage() with input/output text for character-based estimation.`,
  );
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

/**
 * Estimate token usage from raw text when the provider does not return
 * structured token counts. Uses ~4 characters per token (conservative).
 *
 * This ensures we ALWAYS bill something, even for providers that don't
 * report token counts in their response.
 *
 * @param inputText   The prompt/input text sent to the model
 * @param outputText  The response text returned by the model
 * @returns TokenUsage with estimated counts (always > 0)
 */
export function estimateTokenUsage(
  inputText: string,
  outputText: string,
): TokenUsage {
  const inputTokens = Math.max( 1, Math.ceil( inputText.length / CHARS_PER_TOKEN ) );
  const outputTokens = Math.max( 1, Math.ceil( outputText.length / CHARS_PER_TOKEN ) );
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}

// ─── Unit Calculation ────────────────────────────────────────────────────────

/**
 * Calculate billing units from actual token counts.
 *
 * Reads costPer1MTokens from modelRegistry.ts BEDROCK_MODELS.
 * Falls back to Haiku 4.5 pricing ($1/$5) for unknown models.
 */
export function calculateUnitsFromTokens(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  // Dynamic import avoided — we import the lookup at call time
  // to keep this module side-effect-free during testing.
  // Callers should pass pricing if needed, but we inline the lookup here.
  const pricing = getModelPricing( modelId );

  const awsCost =
    ( inputTokens * pricing.input / 1_000_000 ) +
    ( outputTokens * pricing.output / 1_000_000 );

  const userCharge = awsCost * MARKUP_MULTIPLIER;
  const units = Math.ceil( userCharge / UNIT_PRICE_USD );

  return Math.max( 1, units ); // Minimum 1 unit per call
}

/**
 * Full cost breakdown for analytics/display.
 */
export function calculateTokenCostBreakdown(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): TokenCostBreakdown {
  const pricing = getModelPricing( modelId );

  const awsCostUsd =
    ( inputTokens * pricing.input / 1_000_000 ) +
    ( outputTokens * pricing.output / 1_000_000 );

  const userChargeUsd = awsCostUsd * MARKUP_MULTIPLIER;
  const units = Math.max( 1, Math.ceil( userChargeUsd / UNIT_PRICE_USD ) );

  return { awsCostUsd, userChargeUsd, units };
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Look up per-1M-token pricing from the model registry.
 * Falls back to Haiku 4.5 pricing if model is unknown.
 */
function getModelPricing( modelId: string ): { input: number; output: number } {
  // Lazy require to avoid circular dependency at module load time.
  // modelRegistry.ts is a pure data file so this is safe.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { BEDROCK_MODELS } = require( "../modelRegistry" );
    const model = BEDROCK_MODELS[modelId];
    if ( model?.costPer1MTokens ) {
      return model.costPer1MTokens;
    }
  } catch {
    // Module not available (e.g., in unit tests) — use fallback
  }

  // Default: Haiku 4.5 pricing ($1 input / $5 output per 1M)
  return { input: 1.0, output: 5.0 };
}
