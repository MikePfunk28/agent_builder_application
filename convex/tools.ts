/**
 * Executable Tools for Visual Scripting
 *
 * These are the ACTUAL functions that execute when you drag a tool onto the canvas.
 * Each function is exported as a Convex action and can be called from the UI.
 *
 * Memory tools persist data in the Convex toolMemory table.
 * Reasoning tools invoke LLMs via Bedrock/Ollama through executeComposedMessages.
 */

"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { findToolMetadata, normalizeToolName } from "./lib/strandsTools";
import { executeComposedMessages } from "./lib/messageExecutor";
import type { ComposedMessages } from "../src/engine/messageComposer";

/** Shape of entries returned from internal.lib.memoryStore queries */
interface MemoryEntry {
  _id: unknown;
  _creationTime: number;
  userId: string;
  memoryType: string;
  key: string;
  value: string;
  metadata?: string;
  ttl?: number;
  createdAt: number;
  updatedAt: number;
}

/* ──────────────────────────────────────────────────────────────
 * Helper: derive a userId scope from the auth context.
 * Falls back to "anonymous" so tools work during development.
 * ────────────────────────────────────────────────────────────── */
async function resolveUserId(ctx: any): Promise<string> {
  try {
    const identity = await ctx.auth.getUserIdentity();
    return identity?.subject || identity?.tokenIdentifier || "anonymous";
  } catch {
    return "anonymous";
  }
}

/* ──────────────────────────────────────────────────────────────
 * Helper: safely parse JSON from memory store values.
 * Returns raw string if parsing fails (corrupted data).
 * ────────────────────────────────────────────────────────────── */
function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/* ──────────────────────────────────────────────────────────────
 * Helper: invoke a model and return the text response.
 * Builds a ComposedMessages payload for executeComposedMessages.
 * The model arg is expected to be a Bedrock model ID.
 * ────────────────────────────────────────────────────────────── */
async function invokeLLM(
  model: string,
  prompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const isOllama = model.includes(":") && !model.includes(".");

  const composed: ComposedMessages = isOllama
    ? {
        kind: "ollama",
        ollama: {
          endpoint: "http://localhost:11434",
          model,
          messages: [{ role: "user", content: prompt }],
        },
      }
    : {
        kind: "bedrock",
        bedrock: {
          modelId: model,
          messages: [{ role: "user", content: [{ text: prompt }] }],
          inferenceConfig: {
            temperature: options?.temperature ?? 0.7,
            maxTokens: options?.maxTokens ?? 2048,
          },
        },
      };

  const result = await executeComposedMessages(composed);
  return result.text;
}

/**
 * ============================================================================
 * HUMAN-IN-THE-LOOP TOOLS
 * ============================================================================
 */

/**
 * @tool handoff_to_user
 * Hand off control to human for input or decision
 */
export const handoffToUser = action({
  args: {
    question: v.string(),
    options: v.optional(v.array(v.string())),
    currentState: v.optional(v.record(v.string(), v.any())),
    requireConfirmation: v.optional(v.boolean()),
    timeoutSeconds: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const handoffId = `handoff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      status: "pending_user_input",
      handoffId,
      question: args.question,
      options: args.options,
      currentState: args.currentState,
      timestamp: new Date().toISOString(),
      message: "Waiting for user input via UI...",
    };
  },
});

/**
 * ============================================================================
 * MEMORY TOOLS  (backed by Convex toolMemory table)
 * ============================================================================
 */

/**
 * @tool short_term_memory
 * Store and retrieve short-term conversation memory (with TTL)
 */
export const shortTermMemory = action({
  args: {
    operation: v.union(v.literal("store"), v.literal("retrieve"), v.literal("search"), v.literal("clear")),
    key: v.string(),
    value: v.optional(v.any()),
    maxItems: v.optional(v.number()),
    ttl: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<unknown> => {
    const userId = await resolveUserId(ctx);
    const memoryType = "short_term";

    switch (args.operation) {
      case "store": {
        const serialized = JSON.stringify(args.value ?? null);
        await ctx.runMutation(internal.lib.memoryStore.store, {
          userId,
          memoryType,
          key: args.key,
          value: serialized,
          ttl: args.ttl ?? 3600, // default 1h TTL for short-term
        });
        return {
          result: "stored",
          key: args.key,
          timestamp: Date.now(),
        };
      }

      case "retrieve": {
        const entry: MemoryEntry | null = await ctx.runQuery(internal.lib.memoryStore.retrieve, {
          userId,
          memoryType,
          key: args.key,
        });
        return {
          result: entry ? safeJsonParse(entry.value) : null,
          key: args.key,
        };
      }

      case "search": {
        const entries: MemoryEntry[] = await ctx.runQuery(internal.lib.memoryStore.search, {
          userId,
          memoryType,
          maxItems: args.maxItems ?? 20,
        });
        return {
          results: entries.map((e: MemoryEntry) => ({
            key: e.key,
            value: safeJsonParse(e.value),
            updatedAt: e.updatedAt,
          })),
          query: args.key,
        };
      }

      case "clear": {
        await ctx.runMutation(internal.lib.memoryStore.remove, {
          userId,
          memoryType,
          key: args.key,
        });
        return {
          result: "cleared",
          key: args.key,
        };
      }

      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }
  },
});

/**
 * @tool long_term_memory
 * Store and retrieve long-term persistent memory (no TTL)
 */
export const longTermMemory = action({
  args: {
    operation: v.union(v.literal("store"), v.literal("retrieve"), v.literal("search"), v.literal("delete")),
    key: v.string(),
    value: v.optional(v.any()),
    metadata: v.optional(v.any()),
    enableVersioning: v.optional(v.boolean()), // Reserved: version history not yet implemented
  },
  handler: async (ctx, args): Promise<unknown> => {
    const userId = await resolveUserId(ctx);
    const memoryType = "long_term";

    switch (args.operation) {
      case "store": {
        const serialized = JSON.stringify(args.value ?? null);
        const metaSerialized = args.metadata ? JSON.stringify(args.metadata) : undefined;
        await ctx.runMutation(internal.lib.memoryStore.store, {
          userId,
          memoryType,
          key: args.key,
          value: serialized,
          metadata: metaSerialized,
        });
        return {
          result: "stored",
          key: args.key,
          timestamp: Date.now(),
        };
      }

      case "retrieve": {
        const entry: MemoryEntry | null = await ctx.runQuery(internal.lib.memoryStore.retrieve, {
          userId,
          memoryType,
          key: args.key,
        });
        return {
          result: entry ? safeJsonParse(entry.value) : null,
          key: args.key,
          metadata: entry?.metadata ? safeJsonParse(entry.metadata) : null,
        };
      }

      case "search": {
        const entries: MemoryEntry[] = await ctx.runQuery(internal.lib.memoryStore.search, {
          userId,
          memoryType,
          maxItems: 50,
        });
        return {
          results: entries.map((e: MemoryEntry) => ({
            key: e.key,
            value: safeJsonParse(e.value),
            metadata: e.metadata ? safeJsonParse(e.metadata) : null,
            updatedAt: e.updatedAt,
          })),
          query: args.key,
        };
      }

      case "delete": {
        await ctx.runMutation(internal.lib.memoryStore.remove, {
          userId,
          memoryType,
          key: args.key,
        });
        return {
          result: "deleted",
          key: args.key,
        };
      }

      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }
  },
});

/**
 * @tool semantic_memory
 * Search over stored memory entries (keyword-based until vector DB is connected)
 */
export const semanticMemory = action({
  args: {
    query: v.string(),
    topK: v.optional(v.number()),
    similarityThreshold: v.optional(v.number()), // Reserved: used when vector DB is connected
    filters: v.optional(v.record(v.string(), v.string())), // Reserved: used when vector DB is connected
  },
  handler: async (ctx, args): Promise<unknown> => {
    const userId = await resolveUserId(ctx);

    // Retrieve all long-term entries and do keyword matching until vector DB is connected
    const entries: MemoryEntry[] = await ctx.runQuery(internal.lib.memoryStore.search, {
      userId,
      memoryType: "long_term",
      maxItems: 100,
    });

    const queryLower = args.query.toLowerCase();
    const topK = args.topK || 10;

    const scored: Array<{ entry: MemoryEntry; score: number }> = entries
      .map((entry: MemoryEntry) => {
        const keyScore = entry.key.toLowerCase().includes(queryLower) ? 1 : 0;
        const valueScore = entry.value.toLowerCase().includes(queryLower) ? 0.5 : 0;
        return { entry, score: keyScore + valueScore };
      })
      .filter((item: { entry: MemoryEntry; score: number }) => item.score > 0)
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .slice(0, topK);

    return {
      results: scored.map((item: { entry: MemoryEntry; score: number }) => ({
        key: item.entry.key,
        value: safeJsonParse(item.entry.value),
        score: item.score,
      })),
      relevanceScores: scored.map((item: { entry: MemoryEntry; score: number }) => item.score),
      query: args.query,
      topK,
    };
  },
});

/**
 * ============================================================================
 * ADVANCED REASONING PATTERN TOOLS  (backed by real LLM calls)
 * ============================================================================
 */

/**
 * @tool self_consistency
 * Multi-path reasoning with voting: invokes the model N times at varying temperatures
 */
export const selfConsistency = action({
  args: {
    problem: v.string(),
    model: v.string(),
    numPaths: v.optional(v.number()),
    votingStrategy: v.optional(v.union(v.literal("majority"), v.literal("weighted"), v.literal("consensus"))),
  },
  handler: async (_ctx, args) => {
    const numPaths = args.numPaths || 3;
    const answers: string[] = [];
    const reasoningPaths: string[] = [];

    // Generate multiple reasoning paths with different temperatures
    for (let i = 0; i < numPaths; i++) {
      const temperature = Math.min(1.0, 0.5 + (i * 0.15));
      const prompt = `Solve the following problem step by step. Show your reasoning, then give a final answer on the last line prefixed with "ANSWER: ".\n\nProblem: ${args.problem}`;

      try {
        const response = await invokeLLM(args.model, prompt, { temperature, maxTokens: 2048 });
        reasoningPaths.push(response);

        // Extract answer from last line
        const lines = response.trim().split("\n");
        const answerLine = lines.find((l) => l.startsWith("ANSWER:")) || lines[lines.length - 1];
        answers.push(answerLine.replace(/^ANSWER:\s*/i, "").trim());
      } catch (error: any) {
        reasoningPaths.push(`Path ${i + 1} failed: ${error.message}`);
        answers.push(`[error: ${error.message}]`);
      }
    }

    // Count votes
    const voteCounts: Record<string, number> = {};
    answers.forEach((answer) => {
      voteCounts[answer] = (voteCounts[answer] || 0) + 1;
    });

    const sortedAnswers = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);
    const finalAnswer = sortedAnswers[0][0];
    const confidence = sortedAnswers[0][1] / numPaths;

    return {
      finalAnswer,
      confidence,
      reasoningPaths,
      voteDistribution: voteCounts,
      numPaths,
    };
  },
});

/**
 * @tool tree_of_thoughts
 * Explore multiple reasoning branches via LLM-generated thought expansion
 */
export const treeOfThoughts = action({
  args: {
    problem: v.string(),
    model: v.string(),
    maxDepth: v.optional(v.number()),
    branchingFactor: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const maxDepth = args.maxDepth || 3;
    const branchingFactor = args.branchingFactor || 2;
    const explored: string[] = [];
    let bestPath: string[] = [args.problem];
    let bestScore = 0;

    // Breadth-first expansion with path tracking
    let frontier: Array<{ thought: string; path: string[] }> = [
      { thought: args.problem, path: [args.problem] },
    ];

    for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
      const nextFrontier: Array<{ thought: string; path: string[] }> = [];

      for (const { thought, path } of frontier.slice(0, branchingFactor)) {
        const expandPrompt = `Given this reasoning step:\n"${thought}"\n\nGenerate ${branchingFactor} possible next reasoning steps. Number them 1), 2), etc. Then rate which is most promising on a scale of 0-10 after "SCORE: ".`;

        try {
          const response = await invokeLLM(args.model, expandPrompt, { temperature: 0.8, maxTokens: 1024 });
          explored.push(response);

          // Extract numbered items as next thoughts with path tracking
          const items = response.match(/\d\)\s*(.+)/g) || [];
          nextFrontier.push(...items.map((item) => {
            const cleaned = item.replace(/^\d\)\s*/, "").trim();
            return { thought: cleaned, path: [...path, cleaned] };
          }));

          // Extract score
          const scoreMatch = response.match(/SCORE:\s*(\d+)/i);
          const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 5;
          if (score > bestScore) {
            bestScore = score;
            bestPath = path;
          }
        } catch (error: any) {
          explored.push(`Expansion failed: ${error.message}`);
        }
      }

      frontier = nextFrontier;
    }

    return {
      bestPath,
      confidence: bestScore / 10,
      treeStructure: { root: { content: args.problem, depth: 0, explored: explored.length } },
      nodesExplored: explored.length,
    };
  },
});

/**
 * @tool reflexion
 * Self-reflection and iterative improvement via LLM critique loop
 */
export const reflexion = action({
  args: {
    task: v.string(),
    model: v.string(),
    maxIterations: v.optional(v.number()),
    improvementThreshold: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const maxIterations = args.maxIterations || 3;
    const iterationHistory: Array<{
      iteration: number;
      solution: string;
      critique: string;
      improvementScore: number;
    }> = [];

    let currentSolution = "";

    for (let i = 0; i < maxIterations; i++) {
      // Generate or improve solution
      const solvePrompt = i === 0
        ? `Solve this task:\n${args.task}\n\nProvide a complete solution.`
        : `Previous solution:\n${currentSolution}\n\nPrevious critique:\n${iterationHistory[i - 1].critique}\n\nImprove the solution based on the critique. Provide the improved version.`;

      try {
        const solution = await invokeLLM(args.model, solvePrompt, { temperature: 0.5, maxTokens: 2048 });
        currentSolution = solution;

        // Self-critique
        const critiquePrompt = `Critically evaluate this solution to the task "${args.task}":\n\n${solution}\n\nList specific weaknesses and rate the improvement needed on a scale of 0-1 after "IMPROVEMENT_NEEDED: ".`;
        const critiqueResponse = await invokeLLM(args.model, critiquePrompt, { temperature: 0.3, maxTokens: 1024 });

        const scoreMatch = critiqueResponse.match(/IMPROVEMENT_NEEDED:\s*([\d.]+)/i);
        const improvementScore = scoreMatch ? parseFloat(scoreMatch[1]) : 0.5;

        iterationHistory.push({
          iteration: i + 1,
          solution,
          critique: critiqueResponse,
          improvementScore,
        });

        if (improvementScore < (args.improvementThreshold || 0.1)) {
          break;
        }
      } catch (error: any) {
        iterationHistory.push({
          iteration: i + 1,
          solution: `Error: ${error.message}`,
          critique: "Could not generate critique due to error",
          improvementScore: 1,
        });
        break;
      }
    }

    return {
      finalResult: currentSolution,
      iterationHistory,
      improvements: iterationHistory.map((h) => h.critique.slice(0, 200)),
      iterations: iterationHistory.length,
    };
  },
});

/**
 * @tool map_reduce
 * Parallel processing with aggregation via real LLM calls
 */
export const mapReduce = action({
  args: {
    data: v.array(v.any()),
    model: v.string(),
    mapPrompt: v.string(),
    reducePrompt: v.string(),
    chunkSize: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const chunkSize = args.chunkSize || 5;

    // Split data into chunks
    const chunks: any[][] = [];
    for (let i = 0; i < args.data.length; i += chunkSize) {
      chunks.push(args.data.slice(i, i + chunkSize));
    }

    // MAP phase: Process chunks in batches to limit concurrency
    const MAP_CONCURRENCY = 5;
    const mapResults: string[] = [];
    for (let i = 0; i < chunks.length; i += MAP_CONCURRENCY) {
      const batch = chunks.slice(i, i + MAP_CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (chunk, batchIdx) => {
          const index = i + batchIdx;
          const prompt = `${args.mapPrompt}\n\nData chunk ${index + 1}:\n${JSON.stringify(chunk, null, 2)}`;
          try {
            return await invokeLLM(args.model, prompt, { temperature: 0.3, maxTokens: 2048 });
          } catch (error: any) {
            return `Chunk ${index + 1} failed: ${error.message}`;
          }
        })
      );
      mapResults.push(...batchResults);
    }

    // REDUCE phase: Aggregate results with LLM
    let finalResult: string;
    try {
      const reduceInput = mapResults.map((r, i) => `Result ${i + 1}:\n${r}`).join("\n\n");
      finalResult = await invokeLLM(
        args.model,
        `${args.reducePrompt}\n\nIntermediate results:\n${reduceInput}`,
        { temperature: 0.2, maxTokens: 4096 }
      );
    } catch (error: any) {
      finalResult = `Reduce phase failed: ${error.message}. Intermediate: ${mapResults.join(" | ")}`;
    }

    return {
      result: finalResult,
      intermediateResults: mapResults,
      chunksProcessed: chunks.length,
      totalItems: args.data.length,
    };
  },
});

/**
 * @tool parallel_prompts
 * Execute multiple prompts in parallel with real LLM calls
 */
export const parallelPrompts = action({
  args: {
    prompts: v.array(v.object({
      id: v.string(),
      template: v.string(),
      priority: v.optional(v.number()),
    })),
    model: v.string(),
    inputData: v.optional(v.record(v.string(), v.any())),
    maxParallelism: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const startTime = Date.now();
    const maxParallelism = args.maxParallelism || 3;

    // Sort by priority
    const sortedPrompts = [...args.prompts].sort((a, b) =>
      (b.priority || 0) - (a.priority || 0)
    );

    // Execute in batches with real LLM calls
    const results: Record<string, string> = {};
    const timings: Record<string, number> = {};

    for (let i = 0; i < sortedPrompts.length; i += maxParallelism) {
      const batch = sortedPrompts.slice(i, i + maxParallelism);

      const batchResults = await Promise.all(
        batch.map(async (prompt) => {
          const promptStart = Date.now();
          try {
            const result = await invokeLLM(args.model, prompt.template, { temperature: 0.7, maxTokens: 2048 });
            return { id: prompt.id, result, timing: Date.now() - promptStart };
          } catch (error: any) {
            return { id: prompt.id, result: `Error: ${error.message}`, timing: Date.now() - promptStart };
          }
        })
      );

      batchResults.forEach((r) => {
        results[r.id] = r.result;
        timings[r.id] = r.timing;
      });
    }

    return {
      results,
      timings,
      totalLatency: Date.now() - startTime,
      promptsExecuted: sortedPrompts.length,
    };
  },
});

/**
 * Generic executor for any registered Strands tool.
 * Returns an honest status when the runtime is not connected.
 */
export const executeStrandsTool = action({
  args: {
    toolName: v.string(),
    params: v.optional(v.record(v.string(), v.any())),
    context: v.optional(v.record(v.string(), v.any())),
  },
  handler: async (_ctx, args) => {
    const normalized = normalizeToolName(args.toolName);
    const metadata = findToolMetadata(normalized);

    if (!metadata) {
      return {
        success: false,
        error: `Tool "${args.toolName}" is not registered in the Strands catalog.`,
      };
    }

    return {
      success: false,
      tool: metadata.name,
      displayName: metadata.displayName,
      category: metadata.category,
      description: metadata.description,
      capabilities: metadata.capabilities,
      echo: args.params || {},
      context: args.context || {},
      error: "Strands runtime is not connected. Install the strands-agents Python package and configure the MCP bridge to enable live tool execution.",
      requirements: {
        basePackage: metadata.basePip,
        extras: metadata.extrasPip,
        additionalPackages: metadata.additionalPipPackages || [],
        requiredEnv: metadata.requiresEnvVars || [],
      },
      timestamp: Date.now(),
    };
  },
});
