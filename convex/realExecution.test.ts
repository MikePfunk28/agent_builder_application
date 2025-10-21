/**
 * REAL Agent Execution Integration Tests
 *
 * These tests ACTUALLY execute agents - no mocking!
 * - Calls real Bedrock models via MCP
 * - Runs real containers in Fargate
 * - Verifies actual responses
 *
 * WARNING: These tests will incur AWS costs!
 */

import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach, afterEach } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

describe("REAL Agent Execution (Integration Tests)", () => {
  let t: any;
  let testUserId: Id<"users">;
  let bedrockAgentId: Id<"agents">;

  beforeEach(async () => {
    t = convexTest(schema, modules);

    // Create test user
    testUserId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        userId: "test-user-real-execution",
        email: "real@test.com",
        name: "Real Test User",
        tier: "personal",
        testsThisMonth: 0,
        createdAt: Date.now(),
        isAnonymous: false,
      });
    });

    t = t.withIdentity({ subject: testUserId });

    // Create REAL Bedrock agent with simple code
    bedrockAgentId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("agents", {
        name: "Real Bedrock Test Agent",
        description: "Real agent that actually calls Bedrock",
        model: "anthropic.claude-3-haiku-20240307-v1:0", // Use Haiku for cost savings
        systemPrompt: "You are a helpful assistant. Be concise.",
        tools: [],
        generatedCode: `
from strands_agents import Agent

class RealBedrockAgent(Agent):
    def __init__(self):
        super().__init__(
            name="RealBedrockAgent",
            model="anthropic.claude-3-haiku-20240307-v1:0",
            system_prompt="You are a helpful assistant. Be concise."
        )

    async def process_message(self, message: str) -> str:
        # This will actually invoke Bedrock
        response = await self.invoke_model(message)
        return response
`,
        deploymentType: "bedrock",
        createdBy: testUserId,
        isPublic: false,
      });
    });
  });

  afterEach(async () => {
    // Cleanup
    if (t && testUserId) {
      await t.run(async (ctx: any) => {
        const tests = await ctx.db
          .query("testExecutions")
          .withIndex("by_user", (q: any) => q.eq("userId", testUserId))
          .collect();

        for (const test of tests) {
          await ctx.db.delete(test._id);
        }

        const queueEntries = await ctx.db.query("testQueue").collect();
        for (const entry of queueEntries) {
          const test = await ctx.db.get(entry.testId);
          if (test && test.userId === testUserId) {
            await ctx.db.delete(entry._id);
          }
        }

        if (bedrockAgentId) {
          await ctx.db.delete(bedrockAgentId);
        }

        await ctx.db.delete(testUserId);
      });
    }
  });

  test("should ACTUALLY execute Bedrock agent via AgentCore and get real response", async () => {
    // This test will ACTUALLY call Bedrock!
    console.log("⚠️  WARNING: This test will call AWS Bedrock and incur costs!");

    // 1. Submit test
    const result = await t.mutation(api.testExecution.submitTest, {
      agentId: bedrockAgentId,
      testQuery: "What is 2+2? Answer with just the number.",
      timeout: 60000,
      priority: 1,
    });

    expect(result.testId).toBeDefined();
    expect(result.status).toBe("QUEUED");

    // 2. Manually trigger queue processing
    await t.run(async (ctx: any) => {
      await ctx.runAction(internal.queueProcessor.processQueue);
    });

    // 3. Wait for execution to complete (poll for status)
    let test: any;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max

    while (attempts < maxAttempts) {
      test = await t.query(api.testExecution.getTestById, {
        testId: result.testId,
      });

      if (test.status === "COMPLETED" || test.status === "FAILED") {
        break;
      }

      // Wait 1 second before next poll
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }

    // 4. Verify REAL execution
    console.log("Test Status:", test.status);
    console.log("Test Response:", test.response);
    console.log("Test Logs:", test.logs);

    expect(test.status).toBe("COMPLETED");
    expect(test.success).toBe(true);
    expect(test.response).toBeDefined();
    expect(test.response).not.toBe(""); // Should have real response
    expect(test.response).not.toContain("Bedrock processed:"); // NOT the fake mock response

    // Verify it's an actual response (should contain "4" for 2+2)
    expect(test.response.toLowerCase()).toContain("4");

    // Verify execution metrics
    expect(test.executionTime).toBeGreaterThan(0);
    expect(test.completedAt).toBeDefined();

    console.log(" Real Bedrock execution successful!");
  }, 60000); // 60 second timeout

  test("should handle Bedrock errors properly", async () => {
    // Create agent with invalid model to trigger error
    const badAgentId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("agents", {
        name: "Bad Agent",
        description: "Agent with invalid config",
        model: "invalid-model-id",
        systemPrompt: "Test",
        tools: [],
        generatedCode: `print("test")`,
        deploymentType: "bedrock",
        createdBy: testUserId,
        isPublic: false,
      });
    });

    const result = await t.mutation(api.testExecution.submitTest, {
      agentId: badAgentId,
      testQuery: "test",
      timeout: 30000,
      priority: 1,
    });

    await t.run(async (ctx: any) => {
      await ctx.runAction(internal.queueProcessor.processQueue);
    });

    // Wait for execution
    let test: any;
    let attempts = 0;
    while (attempts < 20) {
      test = await t.query(api.testExecution.getTestById, {
        testId: result.testId,
      });

      if (test.status === "COMPLETED" || test.status === "FAILED") {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }

    // Should fail with error
    expect(test.status).toBe("FAILED");
    expect(test.error).toBeDefined();
    expect(test.error).not.toBe("");

    console.log("✅ Error handling works correctly!");

    // Cleanup
    await t.run(async (ctx: any) => {
      await ctx.db.delete(badAgentId);
    });
  }, 30000);
});
