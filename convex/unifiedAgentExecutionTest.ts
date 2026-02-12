/**
 * Test Suite for Unified Agent Execution
 *
 * Tests all modality paths and model switching decisions
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import {
  decideUnifiedModelSwitch,
  detectModality,
  analyzeUnifiedComplexity,
  calculateUnifiedComplexityScore,
  type Modality,
} from "./lib/unifiedModalitySwitching";

/**
 * Test modality detection
 */
export const testModalityDetection = action({
  args: {},
  handler: async (_ctx): Promise<{ results: Array<{ message: string; detected: Modality }> }> => {
    const testCases = [
      // Text
      "What is the capital of France?",
      "Explain quantum computing step by step",

      // Image
      "Generate an image of a sunset over mountains",
      "Create a professional banner for my website",

      // Video
      "Create a video showing product demo",
      "Generate an explainer video about AI",

      // Speech
      "Convert this to voice: Hello world",
      "Create a voiceover for my presentation",

      // Multimodal
      "Create a video with narration explaining machine learning",
      "Generate an image and describe it in voice",
    ];

    const results = testCases.map((message) => ({
      message,
      detected: detectModality(message),
    }));

    console.log("\n=== MODALITY DETECTION TEST ===");
    results.forEach(({ message, detected }) => {
      console.log(`Message: "${message}"`);
      console.log(`Detected: ${detected}\n`);
    });

    return { results };
  },
});

/**
 * Test complexity scoring
 */
export const testComplexityScoring = action({
  args: {},
  handler: async (_ctx): Promise<{ results: Array<{ message: string; modality: Modality; score: number }> }> => {
    const testCases: Array<{ message: string; modality: Modality }> = [
      // Simple text
      { message: "Hello", modality: "text" },

      // Moderate text
      { message: "Can you explain how neural networks work?", modality: "text" },

      // Complex text
      { message: "Please explain step by step, with detailed reasoning, how transformer architectures work including attention mechanisms, positional encoding, and multi-head attention. Include code examples.", modality: "text" },

      // Simple image
      { message: "Generate a simple logo", modality: "image" },

      // Complex image
      { message: "Create a photorealistic high-resolution 4K banner with intricate details showing a futuristic cityscape at sunset", modality: "image" },

      // Simple video
      { message: "Create a 5 second video clip", modality: "video" },

      // Complex video
      { message: "Generate a 60-second premium quality cinematic video with smooth camera movements showing a product showcase", modality: "video" },
    ];

    const results = testCases.map(({ message, modality }) => {
      const signals = analyzeUnifiedComplexity(message, modality, []);
      const score = calculateUnifiedComplexityScore(signals, modality);
      return { message, modality, score };
    });

    console.log("\n=== COMPLEXITY SCORING TEST ===");
    results.forEach(({ message, modality, score }) => {
      console.log(`Message: "${message}"`);
      console.log(`Modality: ${modality}`);
      console.log(`Complexity Score: ${score}/100\n`);
    });

    return { results };
  },
});

/**
 * Test model switching decisions
 */
export const testModelSwitching = action({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.runQuery(api.agents.get, { id: args.agentId });
    if (!agent) {
      throw new Error("Agent not found");
    }

    const testCases = [
      // Text: simple → Haiku
      {
        message: "Hello",
        history: [],
        expectedTier: "haiku",
      },

      // Text: moderate → Sonnet
      {
        message: "Explain how database indexing works with examples",
        history: [],
        expectedTier: "sonnet",
      },

      // Text: complex → Opus
      {
        message: "Think step by step and explain in detail how distributed consensus algorithms work, comparing Paxos and Raft with code examples",
        history: [],
        expectedTier: "opus",
      },

      // Image: simple → Titan
      {
        message: "Generate a simple icon",
        history: [],
        expectedTier: "titan",
      },

      // Image: complex → Nova Canvas
      {
        message: "Create a photorealistic 4K high-resolution professional banner with intricate details",
        history: [],
        expectedTier: "novaCanvas",
      },

      // Video: standard → Nova Reel Standard
      {
        message: "Create a 5 second video clip",
        history: [],
        expectedTier: "novaReelStandard",
      },

      // Video: premium → Nova Reel Premium
      {
        message: "Generate a 60-second premium cinematic video with smooth professional camera work",
        history: [],
        expectedTier: "novaReelPremium",
      },
    ];

    const results = [];

    console.log("\n=== MODEL SWITCHING TEST ===");

    for (const testCase of testCases) {
      const decision = decideUnifiedModelSwitch(
        testCase.message,
        testCase.history,
        agent as any,
        { userTier: "personal" }
      );

      const result = {
        message: testCase.message,
        modality: decision.modality,
        selectedModel: decision.selectedModel.name,
        complexityScore: decision.complexityScore,
        estimatedCost: decision.estimatedCost,
        reasoning: decision.reasoning,
        expectedTier: testCase.expectedTier,
        match: decision.selectedModel.modelId.includes(testCase.expectedTier) ||
               decision.selectedModel.name.toLowerCase().includes(testCase.expectedTier.toLowerCase()),
      };

      results.push(result);

      console.log(`\nMessage: "${testCase.message}"`);
      console.log(`Modality: ${decision.modality}`);
      console.log(`Selected: ${decision.selectedModel.name}`);
      console.log(`Complexity: ${decision.complexityScore}/100`);
      console.log(`Cost: $${decision.estimatedCost.toFixed(4)}`);
      console.log(`Reasoning: ${decision.reasoning}`);
      console.log(`Expected: ${testCase.expectedTier}`);
      console.log(`Match: ${result.match ? "✓" : "✗"}`);
    }

    return { results };
  },
});

/**
 * Test tier-based routing
 */
export const testTierBasedRouting = action({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.runQuery(api.agents.get, { id: args.agentId });
    if (!agent) {
      throw new Error("Agent not found");
    }

    const message = "Explain quantum computing step by step with detailed reasoning";
    const history: Array<{ role: string; content: string }> = [];

    const tiers: Array<"freemium" | "personal" | "enterprise"> = ["freemium", "personal", "enterprise"];
    const results = [];

    console.log("\n=== TIER-BASED ROUTING TEST ===");
    console.log(`Message: "${message}"\n`);

    for (const tier of tiers) {
      const decision = decideUnifiedModelSwitch(
        message,
        history,
        agent as any,
        { userTier: tier }
      );

      const result = {
        tier,
        selectedModel: decision.selectedModel.name,
        complexityScore: decision.complexityScore,
        estimatedCost: decision.estimatedCost,
      };

      results.push(result);

      console.log(`Tier: ${tier}`);
      console.log(`Selected: ${decision.selectedModel.name}`);
      console.log(`Cost: $${decision.estimatedCost.toFixed(4)}\n`);
    }

    return { results };
  },
});

/**
 * Test conversation history impact
 */
export const testConversationHistory = action({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.runQuery(api.agents.get, { id: args.agentId });
    if (!agent) {
      throw new Error("Agent not found");
    }

    const message = "What about databases?";

    const histories = [
      // No history
      [],

      // Short history
      [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi! How can I help?" },
      ],

      // Long history with tool calls
      [
        { role: "user", content: "Explain indexing" },
        { role: "assistant", content: "Indexing is... tool_use..." },
        { role: "user", content: "Can you show examples?" },
        { role: "assistant", content: "Here are examples... tool_use..." },
        { role: "user", content: "What about performance?" },
        { role: "assistant", content: "Performance considerations..." },
      ],

      // History with failures
      [
        { role: "user", content: "Solve this problem" },
        { role: "assistant", content: "I encountered an error..." },
        { role: "user", content: "Try again" },
        { role: "assistant", content: "Still failed..." },
      ],
    ];

    const results = [];

    console.log("\n=== CONVERSATION HISTORY TEST ===");
    console.log(`Message: "${message}"\n`);

    for (let i = 0; i < histories.length; i++) {
      const decision = decideUnifiedModelSwitch(
        message,
        histories[i],
        agent as any,
        { userTier: "personal" }
      );

      const result = {
        historyLength: histories[i].length,
        selectedModel: decision.selectedModel.name,
        complexityScore: decision.complexityScore,
        reasoning: decision.reasoning,
      };

      results.push(result);

      console.log(`History Length: ${histories[i].length}`);
      console.log(`Selected: ${decision.selectedModel.name}`);
      console.log(`Complexity: ${decision.complexityScore}/100`);
      console.log(`Reasoning: ${decision.reasoning}\n`);
    }

    return { results };
  },
});

/**
 * Run all tests
 *
 * Note: To run all tests, call each test action individually from the UI:
 * 1. testModalityDetection
 * 2. testComplexityScoring
 * 3. testModelSwitching
 * 4. testTierBasedRouting
 * 5. testConversationHistory
 *
 * This master test combines modality detection and complexity scoring only (no agent needed).
 */
export const runBasicTests = action({
  args: {},
  handler: async (_ctx) => {
    console.log("\n========================================");
    console.log("UNIFIED MODALITY SWITCHING - BASIC TESTS");
    console.log("========================================\n");

    // Test 1: Modality Detection
    console.log("\n=== TEST 1: MODALITY DETECTION ===\n");
    const modalityTests = [
      { message: "What is the capital of France?", expected: "text" },
      { message: "Generate an image of a sunset", expected: "image" },
      { message: "Create a video showing product demo", expected: "video" },
      { message: "Convert this to voice: Hello world", expected: "speech" },
      { message: "Create a video with narration", expected: "multimodal" },
    ];

    const modalityResults = modalityTests.map(({ message, expected }) => {
      const detected = detectModality(message);
      const pass = detected === expected;
      console.log(`${pass ? "✓" : "✗"} "${message}"`);
      console.log(`  Expected: ${expected}, Got: ${detected}\n`);
      return { message, expected, detected, pass };
    });

    // Test 2: Complexity Scoring
    console.log("\n=== TEST 2: COMPLEXITY SCORING ===\n");
    const complexityTests = [
      { message: "Hello", modality: "text" as Modality, expectedRange: [0, 30] },
      { message: "Explain neural networks step by step", modality: "text" as Modality, expectedRange: [30, 60] },
      { message: "Think step by step and explain in extreme detail how transformers work with code examples", modality: "text" as Modality, expectedRange: [60, 100] },
    ];

    const complexityResults = complexityTests.map(({ message, modality, expectedRange }) => {
      const signals = analyzeUnifiedComplexity(message, modality, []);
      const score = calculateUnifiedComplexityScore(signals, modality);
      const inRange = score >= expectedRange[0] && score <= expectedRange[1];
      console.log(`${inRange ? "✓" : "✗"} "${message}"`);
      console.log(`  Score: ${score}/100, Expected: ${expectedRange[0]}-${expectedRange[1]}\n`);
      return { message, score, expectedRange, inRange };
    });

    const allPassed =
      modalityResults.every((r) => r.pass) &&
      complexityResults.every((r) => r.inRange);

    console.log("\n========================================");
    console.log(`BASIC TESTS ${allPassed ? "PASSED ✓" : "FAILED ✗"}`);
    console.log("========================================\n");

    return {
      summary: {
        totalTests: modalityResults.length + complexityResults.length,
        passed: modalityResults.filter((r) => r.pass).length + complexityResults.filter((r) => r.inRange).length,
        failed: modalityResults.filter((r) => !r.pass).length + complexityResults.filter((r) => !r.inRange).length,
        allPassed,
      },
      modalityDetection: modalityResults,
      complexityScoring: complexityResults,
    };
  },
});
