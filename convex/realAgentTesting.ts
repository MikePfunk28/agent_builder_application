/**
 * Real Agent Testing - Queue-Based Implementation
 *
 * This replaces the old Docker spawn implementation with a queue-based system
 * that uses AWS ECS Fargate for actual container execution.
 */

import { action, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

/**
 * Execute real agent test (legacy compatibility wrapper)
 *
 * This maintains backwards compatibility with the old API while using
 * the new queue-based test execution system.
 */
export const executeRealAgentTest = action({
  args: {
    agentCode: v.string(),
    requirements: v.string(),
    dockerfile: v.string(),
    testQuery: v.string(),
    modelId: v.string(),
    timeout: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    try {
      // Get or create agent for this test
      const agent = await findOrCreateTestAgent(ctx, args);

      // Submit test to queue
      const result = await ctx.runMutation(api.testExecution.submitTest, {
        agentId: agent._id,
        testQuery: args.testQuery,
        timeout: args.timeout,
        priority: 2, // Normal priority
      });

      // Wait for test to complete (with timeout)
      const maxWaitTime = (args.timeout || 180000) + 60000; // Add 1 minute buffer
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitTime) {
        const test = await ctx.runQuery(api.testExecution.getTestById, {
          testId: result.testId,
        });

        if (!test) {
          return {
            success: false,
            error: "Test not found",
            logs: [],
            stage: "error",
          };
        }

        if (test.status === "COMPLETED" || test.status === "FAILED") {
          // Test finished
          return {
            success: test.success || false,
            output: test.response || "",
            error: test.error,
            logs: test.logs,
            metrics: {
              executionTime: test.executionTime,
              buildTime: test.buildTime,
              queueWaitTime: test.queueWaitTime,
              memoryUsed: test.memoryUsed,
              cpuUsed: test.cpuUsed,
            },
            stage: test.status === "COMPLETED" ? "completed" : test.errorStage || "error",
            testId: result.testId,
            modelUsed: test.modelProvider,
            testEnvironment: test.modelProvider === "ollama" ? "local-ollama" : "aws-bedrock",
          };
        }

        // Wait 2 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Timeout waiting for result
      return {
        success: false,
        error: "Timeout waiting for test result",
        logs: ["⏰ Timeout waiting for test execution"],
        stage: "timeout",
      };
    } catch (error: any) {
      console.error("❌ Test execution error:", error);
      return {
        success: false,
        error: `Test execution failed: ${error.message}`,
        logs: [`❌ Error: ${error.message}`],
        stage: "error",
      };
    }
  },
});

/**
 * Find existing test agent or create a temporary one
 */
async function findOrCreateTestAgent(ctx: any, args: any) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new Error("Not authenticated");
  }

  // Determine deployment type and model from modelId
  const deploymentType = shouldUseOllama(args.modelId) ? "ollama" : "aws";

  // Check if agent with this code already exists (to avoid duplicates)
  // For now, just create a temporary agent
  const agentId = await ctx.runMutation(api.realAgentTesting.createTempAgent, {
    code: args.agentCode,
    modelId: args.modelId,
    deploymentType,
  });

  return { _id: agentId };
}

/**
 * Create temporary agent for testing
 */
export const createTempAgent = mutation({
  args: {
    code: v.string(),
    modelId: v.string(),
    deploymentType: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Parse tools from code (simplified)
    const tools: any[] = [];

    return await ctx.db.insert("agents", {
      name: `Test Agent ${Date.now()}`,
      description: "Temporary agent for testing",
      model: args.modelId,
      systemPrompt: "You are a helpful AI assistant.",
      tools,
      generatedCode: args.code,
      deploymentType: args.deploymentType,
      createdBy: identity.subject,
      isPublic: false,
    });
  },
});

/**
 * Determine if model should use Ollama
 */
function shouldUseOllama(modelId: string): boolean {
  // Model IDs with ":" are Ollama models (e.g., llama2:latest)
  // Model IDs with "." are AWS Bedrock models (e.g., anthropic.claude-3-sonnet)
  return modelId.includes(':') && !modelId.includes('.');
}

/**
 * Stream test logs in real-time
 */
export const streamTestLogs = action({
  args: {
    testId: v.id("testExecutions"),
  },
  handler: async (ctx, args) => {
    const test = await ctx.runQuery(api.testExecution.getTestById, {
      testId: args.testId,
    });

    if (!test) {
      throw new Error("Test not found");
    }

    return {
      testId: args.testId,
      status: test.status,
      phase: test.phase,
      logs: test.logs,
      success: test.success,
      response: test.response,
      error: test.error,
    };
  },
});

/**
 * Get test history for an agent
 */
export const getAgentTestHistory = action({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    // Get all tests for this agent
    const tests = await ctx.runQuery(api.realAgentTesting.queryAgentTests, {
      agentId: args.agentId,
    });

    return tests.map(test => ({
      id: test._id,
      query: test.testQuery,
      response: test.response || "",
      success: test.success || false,
      executionTime: test.executionTime || 0,
      timestamp: test.submittedAt,
      status: test.status,
    }));
  },
});

export const queryAgentTests = action({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const tests = await ctx.runQuery(api.realAgentTesting.getAgentTestsInternal, {
      agentId: args.agentId,
      userId: identity.subject,
    });

    return tests;
  },
});

export const getAgentTestsInternal = action({
  args: {
    agentId: v.id("agents"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // This should be a query, but for now return empty
    return [];
  },
});
