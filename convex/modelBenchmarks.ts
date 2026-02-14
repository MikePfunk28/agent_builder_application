/**
 * Model Benchmark Database
 * Comprehensive scoring based on real benchmarks
 *
 * Benchmarks included:
 * - MMLU (Massive Multitask Language Understanding)
 * - HumanEval (Code generation)
 * - GSM8K (Math reasoning)
 * - BBH (Big Bench Hard - complex reasoning)
 * - GPQA (Graduate-level Q&A)
 * - HellaSwag (Common sense reasoning)
 * - TruthfulQA (Factual accuracy)
 * - MT-Bench (Multi-turn conversation)
 */

import { query } from "./_generated/server";
import { v } from "convex/values";
import { BEDROCK_MODELS, OLLAMA_MODELS } from "./modelRegistry";

export interface ModelBenchmarks {
  model: string;
  provider: "bedrock" | "openai" | "ollama";
  
  // Benchmark scores (0-100)
  mmlu: number;           // General knowledge
  humaneval: number;      // Code generation
  gsm8k: number;          // Math reasoning
  bbh: number;            // Complex reasoning
  gpqa: number;           // Expert knowledge
  hellaswag: number;      // Common sense
  truthfulqa: number;     // Factual accuracy
  mtbench: number;        // Multi-turn conversation
  
  // Composite scores (0-100)
  overallAbility: number; // Weighted average of benchmarks
  codeAbility: number;    // Code-specific tasks
  reasoningAbility: number; // Reasoning tasks
  knowledgeAbility: number; // Knowledge tasks
  
  // Cost metrics
  costPerMToken: number;  // Input cost
  costPerMTokenOutput: number; // Output cost
  costScore: number;      // 0-100 (100 = most expensive)
  
  // Size metrics
  parameters: string;     // e.g., "175B", "70B"
  contextWindow: number;  // Max tokens
  sizeScore: number;      // 0-100 (100 = largest)
  
  // Metadata
  releaseDate: string;    // YYYY-MM-DD
  recencyScore: number;   // 0-100 (100 = newest)
  
  // Final scores
  totalScore: number;     // Composite score for budget system
  valueScore: number;     // Quality-adjusted value (ability² / cost)
  efficiencyScore: number; // Performance per dollar spent
}

/**
 * Helper: look up a model from the authoritative registry and extract cost/context.
 * Returns undefined if the model ID is not in the registry so we can skip stale entries.
 */
function registryCost(modelId: string): { input: number; output: number } | undefined {
  const meta = BEDROCK_MODELS[modelId] ?? OLLAMA_MODELS[modelId];
  return meta?.costPer1MTokens;
}

function registryContext(modelId: string): number | undefined {
  const meta = BEDROCK_MODELS[modelId] ?? OLLAMA_MODELS[modelId];
  return meta ? meta.contextWindow : undefined;
}

/**
 * Comprehensive model database with real benchmark data.
 *
 * Cost and context-window values are derived from the authoritative
 * modelRegistry.ts rather than hardcoded here.
 *
 * NOTE: Only models that still exist in modelRegistry.ts are included.
 * Removed models (Claude 3.x, old Ollama entries) were pruned because
 * they no longer appear in the registry.
 */
export const MODEL_BENCHMARKS: ModelBenchmarks[] = [
  // ============================================================================
  // AMAZON NOVA (Bedrock) — sourced from modelRegistry.ts
  // ============================================================================
  {
    model: "amazon.nova-pro-v1:0",
    provider: "bedrock",

    mmlu: 78.0,
    humaneval: 70.0,
    gsm8k: 85.0,
    bbh: 75.0,
    gpqa: 40.0,
    hellaswag: 82.0,
    truthfulqa: 60.0,
    mtbench: 7.8,

    overallAbility: 73.5,
    codeAbility: 70.0,
    reasoningAbility: 80.0,
    knowledgeAbility: 72.0,

    costPerMToken: registryCost("amazon.nova-pro-v1:0")?.input ?? 0.80,
    costPerMTokenOutput: registryCost("amazon.nova-pro-v1:0")?.output ?? 3.20,
    costScore: 35,

    parameters: "~100B",
    contextWindow: registryContext("amazon.nova-pro-v1:0") ?? 300000,
    sizeScore: 75,

    releaseDate: "2024-12-03",
    recencyScore: 98,

    totalScore: 0,    // computed below
    valueScore: 0,    // computed below
    efficiencyScore: 0, // computed below
  },

  {
    model: "amazon.nova-lite-v1:0",
    provider: "bedrock",

    mmlu: 65.0,
    humaneval: 55.0,
    gsm8k: 70.0,
    bbh: 60.0,
    gpqa: 25.0,
    hellaswag: 75.0,
    truthfulqa: 45.0,
    mtbench: 6.5,

    overallAbility: 57.6,
    codeAbility: 55.0,
    reasoningAbility: 65.0,
    knowledgeAbility: 55.0,

    costPerMToken: registryCost("amazon.nova-lite-v1:0")?.input ?? 0.06,
    costPerMTokenOutput: registryCost("amazon.nova-lite-v1:0")?.output ?? 0.24,
    costScore: 8,

    parameters: "~20B",
    contextWindow: registryContext("amazon.nova-lite-v1:0") ?? 300000,
    sizeScore: 35,

    releaseDate: "2024-12-03",
    recencyScore: 98,

    totalScore: 0,    // computed below
    valueScore: 0,    // computed below
    efficiencyScore: 0, // computed below
  },
];

// Derive composite scores from dynamic cost values at module load time
for ( const m of MODEL_BENCHMARKS ) {
  m.totalScore = m.overallAbility + m.costScore + m.recencyScore;
  m.valueScore = m.costPerMToken > 0 ? ( m.overallAbility ** 2 ) / m.costPerMToken : 0;
  m.efficiencyScore = m.costPerMToken > 0 ? m.overallAbility / m.costPerMToken : 0;
}

/**
 * Get model by ID
 */
export function getModelBenchmarks(modelId: string): ModelBenchmarks | undefined {
  return MODEL_BENCHMARKS.find(m => m.model === modelId);
}

/**
 * Find best model for task type within budget
 */
export function findOptimalModel(
  taskType: "code" | "reasoning" | "knowledge" | "general",
  maxCostPerMToken: number,
  minAbility: number = 0
): ModelBenchmarks | undefined {
  const abilityKey = taskType === "code" ? "codeAbility" :
                     taskType === "reasoning" ? "reasoningAbility" :
                     taskType === "knowledge" ? "knowledgeAbility" :
                     "overallAbility";
  
  const candidates = MODEL_BENCHMARKS.filter(m => 
    m.costPerMToken <= maxCostPerMToken && 
    m[abilityKey] >= minAbility
  );
  
  if (candidates.length === 0) return undefined;
  
  // Return highest ability within budget
  return candidates.reduce((best, current) => 
    current[abilityKey] > best[abilityKey] ? current : best
  );
}

/**
 * Get best value models (Quality-adjusted value)
 * Uses ability² / cost to favor quality while considering cost
 */
export function getBestValueModels(
  minAbility: number = 0,
  limit: number = 5
): ModelBenchmarks[] {
  return [...MODEL_BENCHMARKS]
    .filter(m => m.valueScore > 0 && m.overallAbility >= minAbility)
    .sort((a, b) => b.valueScore - a.valueScore)
    .slice(0, limit);
}

/**
 * Get models by task-specific value
 */
export function getBestValueForTask(
  taskType: "code" | "reasoning" | "knowledge" | "general",
  minAbility: number = 50,
  limit: number = 3
): ModelBenchmarks[] {
  const abilityKey = taskType === "code" ? "codeAbility" :
                     taskType === "reasoning" ? "reasoningAbility" :
                     taskType === "knowledge" ? "knowledgeAbility" :
                     "overallAbility";
  
  return [...MODEL_BENCHMARKS]
    .filter(m => m[abilityKey] >= minAbility && m.costPerMToken > 0)
    .map(m => ({
      ...m,
      taskValue: (m[abilityKey] ** 2) / m.costPerMToken,
    }))
    .sort((a: any, b: any) => b.taskValue - a.taskValue)
    .slice(0, limit);
}

/**
 * Calculate complexity score from task analysis
 */
export function calculateTaskComplexity(analysis: {
  requiresCode: boolean;
  requiresReasoning: boolean;
  requiresExpertKnowledge: boolean;
  multiStep: boolean;
  requiresAccuracy: boolean;
}): number {
  let complexity = 0;
  
  if (analysis.requiresCode) complexity += 20;
  if (analysis.requiresReasoning) complexity += 25;
  if (analysis.requiresExpertKnowledge) complexity += 30;
  if (analysis.multiStep) complexity += 15;
  if (analysis.requiresAccuracy) complexity += 10;
  
  return Math.min(complexity, 100);
}

/**
 * Recommend model based on task complexity
 */
export function recommendModelForComplexity(
  complexity: number,
  taskType: "code" | "reasoning" | "knowledge" | "general" = "general",
  maxBudget: number = 300
): ModelBenchmarks {
  // Map complexity to required ability
  const requiredAbility = complexity * 0.8; // 80% of complexity score

  // Map complexity to max cost
  const maxCost = complexity < 30 ? 0.5 :
                  complexity < 50 ? 2.0 :
                  complexity < 70 ? 5.0 :
                  15.0;

  const optimal = findOptimalModel(taskType, maxCost, requiredAbility);

  if (optimal) return optimal;

  // Fallback: return best available
  return MODEL_BENCHMARKS[0];
}

/**
 * Convex Query: Get all model benchmarks
 * Safe for browser consumption
 */
export const getAllBenchmarks = query({
  args: {},
  handler: async () => {
    return MODEL_BENCHMARKS;
  },
});

/**
 * Convex Query: Get benchmark for specific model
 * Safe for browser consumption
 */
export const getBenchmarkForModel = query({
  args: { modelId: v.string() },
  handler: async (_, { modelId }) => {
    return MODEL_BENCHMARKS.find(m => m.model === modelId);
  },
});
