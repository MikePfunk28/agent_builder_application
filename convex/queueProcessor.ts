/**
 * Queue Processor
 *
 * Scheduled action that processes the test queue and starts ECS tasks.
 * Runs every 5 seconds to maintain ~2 second queue latency.
 */

import { internalAction, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const MAX_CONCURRENT_TESTS = parseInt(process.env.MAX_CONCURRENT_TESTS || "10");

/**
 * Main queue processor - triggered on-demand when tests are submitted
 * Also runs periodically as a backup (if enabled in crons.ts)
 * 
 * Cost optimization: Exits silently when queue is empty (no logs, minimal operations)
 */
export const processQueue = internalAction({
  args: {},
  handler: async (ctx) => {
    try {
      // Quick check: is there anything in the queue? (fast query, no logging)
      const nextTests = await ctx.runQuery(internal.queueProcessor.queryNextPendingTests, {
        limit: 1,
      });

      // If queue is empty, exit silently (no logs, no wasted operations)
      if (nextTests.length === 0) {
        return;
      }

      // Only log when there's actual work to do
      console.log("🔄 Processing test queue...");

      // Check current capacity
      const runningTests = await ctx.runQuery(internal.queueProcessor.queryRunningTests);
      const runningCount = runningTests.length;

      if (runningCount >= MAX_CONCURRENT_TESTS) {
        console.log(`⏸️  At capacity (${runningCount}/${MAX_CONCURRENT_TESTS}), skipping queue processing`);
        return;
      }

      const availableSlots = MAX_CONCURRENT_TESTS - runningCount;
      console.log(`📊 Available slots: ${availableSlots}`);

      // Get all pending tests we can process
      const allNextTests = await ctx.runQuery(internal.queueProcessor.queryNextPendingTests, {
        limit: availableSlots,
      });

      console.log(`🚀 Starting ${allNextTests.length} test(s)...`);

      // Process each test
      for (const queueEntry of allNextTests) {
        try {
          // Claim the test atomically
          const claimed = await ctx.runMutation(internal.queueProcessor.claimTest, {
            queueId: queueEntry._id,
          });

          if (!claimed) {
            console.log(`⚠️  Test ${queueEntry.testId} already claimed, skipping`);
            continue;
          }

          // Get test details
          const test = await ctx.runQuery(internal.testExecution.getTestByIdInternal, {
            testId: queueEntry.testId,
          });

          if (!test) {
            console.log(`❌ Test ${queueEntry.testId} not found`);
            await ctx.runMutation(internal.queueProcessor.removeFromQueue, {
              queueId: queueEntry._id,
            });
            continue;
          }

          // Update test status to BUILDING
          await ctx.runMutation(internal.testExecution.updateStatus, {
            testId: test._id,
            status: "BUILDING",
          });

          await ctx.runMutation(internal.testExecution.appendLogs, {
            testId: test._id,
            logs: [
              "📦 Test claimed from queue",
              "🔨 Starting container build...",
            ],
            timestamp: Date.now(),
          });

          // SMART ROUTING: Bedrock → AgentCore, Ollama → Lambda
          const agent = await ctx.runQuery(internal.agents.getInternal, { id: test.agentId });
          const modelId = agent?.model || test.modelConfig?.modelId || '';
          
          // Check if Bedrock model (starts with provider prefix)
          const isBedrockModel = modelId.startsWith('anthropic.') || 
                                modelId.startsWith('amazon.') || 
                                modelId.startsWith('ai21.') ||
                                modelId.startsWith('cohere.') ||
                                modelId.startsWith('meta.') ||
                                modelId.startsWith('mistral.');
          
          let result;
          if (isBedrockModel) {
            // Route to AgentCore Sandbox (fast, serverless, Bedrock only)
            await ctx.runMutation(internal.testExecution.appendLogs, {
              testId: test._id,
              logs: ['🚀 Routing to AgentCore Sandbox (Bedrock model)'],
              timestamp: Date.now(),
            });
            
            result = await ctx.runAction(internal.agentcoreTestExecution.executeAgentCoreTest, {
              testId: test._id,
              agentId: test.agentId,
              input: test.testQuery,
              conversationHistory: test.conversationId ? await ctx.runQuery(internal.conversations.getHistory, { conversationId: test.conversationId }) : [],
            });
          } else {
            // Route to ECS Fargate (Docker support for Ollama)
            await ctx.runMutation(internal.testExecution.appendLogs, {
              testId: test._id,
              logs: ['🚀 Routing to ECS Fargate (Ollama model)'],
              timestamp: Date.now(),
            });

            result = await ctx.runAction(internal.containerOrchestrator.startTestContainer, {
              testId: test._id,
              agentCode: test.agentCode,
              requirements: test.requirements,
              dockerfile: test.dockerfile || '',
              testQuery: test.testQuery,
              modelProvider: 'ollama',
              modelConfig: {
                modelId: modelId,
                baseUrl: process.env.OLLAMA_BASE_URL || 'http://host.docker.internal:11434',
                testEnvironment: 'fargate',
              },
              timeout: 300000, // 5 minutes
            });
          }

          if ("error" in result) {
            // Failed to start container
            console.error(`❌ Failed to start container for test ${test._id}:`, result.error);

            await ctx.runMutation(internal.testExecution.updateStatus, {
              testId: test._id,
              status: "FAILED",
              success: false,
              error: result.error,
              errorStage: "build",
            });

            await ctx.runMutation(internal.testExecution.appendLogs, {
              testId: test._id,
              logs: [`❌ Container start failed: ${result.error}`],
              timestamp: Date.now(),
            });

            // Remove from queue
            await ctx.runMutation(internal.queueProcessor.removeFromQueue, {
              queueId: queueEntry._id,
            });

            // Retry if attempts < 3
            if (queueEntry.attempts < 3) {
              console.log(`🔄 Retrying test ${test._id} (attempt ${queueEntry.attempts + 1}/3)`);
              await ctx.runMutation(internal.queueProcessor.requeueTest, {
                testId: test._id,
                priority: queueEntry.priority,
                attempts: queueEntry.attempts + 1,
                lastError: result.error ?? "",
              });
            }
          } else {
            // Successfully completed (Lambda returns immediately)
            console.log(`✅ Lambda test completed for ${test._id}`);

            // Remove from queue
            await ctx.runMutation(internal.queueProcessor.removeFromQueue, {
              queueId: queueEntry._id,
            });

            // Test status already updated by Lambda execution
          }
        } catch (error: any) {
          console.error(`❌ Error processing test ${queueEntry.testId}:`, error);

          await ctx.runMutation(internal.testExecution.appendLogs, {
            testId: queueEntry.testId,
            logs: [`❌ Queue processing error: ${error.message}`],
            timestamp: Date.now(),
          });
        }
      }

      console.log("✅ Queue processing complete");
    } catch (error: any) {
      console.error("❌ Queue processor error:", error);
    }
  },
});

/**
 * Get count of currently running tests
 */
export const getRunningTestsCount = internalAction({
  args: {},
  handler: async (ctx): Promise<number> => {
    const running: any[] = await ctx.runQuery(internal.queueProcessor.queryRunningTests);
    return running.length;
  },
});

export const queryRunningTests = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("testExecutions")
      .withIndex("by_status", (q) => q.eq("status", "RUNNING"))
      .collect();
  },
});

/**
 * Get next pending tests from queue
 */
export const getNextPendingTests = internalAction({
  args: { limit: v.number() },
  handler: async (ctx, args): Promise<any[]> => {
    return await ctx.runQuery(internal.queueProcessor.queryNextPendingTests, {
      limit: args.limit,
    });
  },
});

export const queryNextPendingTests = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("testQueue")
      .withIndex("by_status_priority", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(args.limit);
  },
});

/**
 * Claim a test from the queue (atomic)
 */
export const claimTest = internalMutation({
  args: { queueId: v.id("testQueue") },
  handler: async (ctx, args) => {
    const queueEntry = await ctx.db.get(args.queueId);

    if (!queueEntry || queueEntry.status !== "pending") {
      return false; // Already claimed or doesn't exist
    }

    await ctx.db.patch(args.queueId, {
      status: "claimed",
      claimedAt: Date.now(),
      claimedBy: "system", // ctx.auth?.userId is not available in internal mutations
    });

    return true;
  },
});

/**
 * Remove test from queue
 */
export const removeFromQueue = internalMutation({
  args: { queueId: v.id("testQueue") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.queueId);
  },
});

/**
 * Requeue a failed test for retry
 */
export const requeueTest = internalMutation({
  args: {
    testId: v.id("testExecutions"),
    priority: v.number(),
    attempts: v.number(),
    lastError: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("testQueue", {
      testId: args.testId,
      priority: args.priority,
      status: "pending",
      createdAt: Date.now(),
      attempts: args.attempts,
      lastError: args.lastError,
    });

    // Reset test status to QUEUED
    await ctx.db.patch(args.testId, {
      status: "QUEUED",
      phase: "queued",
    });
  },
});

/**
 * Update test with ECS task information
 */
export const updateTestWithTaskInfo = internalMutation({
  args: {
    testId: v.id("testExecutions"),
    taskArn: v.string(),
    taskId: v.string(),
    logGroup: v.string(),
    logStream: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.testId, {
      ecsTaskArn: args.taskArn,
      ecsTaskId: args.taskId,
      cloudwatchLogGroup: args.logGroup,
      cloudwatchLogStream: args.logStream,
    });
  },
});

/**
 * Cleanup abandoned tests (scheduled to run every 15 minutes)
 */
export const cleanupAbandonedTests = internalAction({
  args: {},
  handler: async (ctx) => {
    const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;

    const abandoned = await ctx.runQuery(internal.queueProcessor.queryAbandonedTests, {
      cutoffTime: fifteenMinutesAgo,
    });

    for (const queueEntry of abandoned) {
      console.log(`🧹 Cleaning up abandoned test: ${queueEntry.testId}`);

      if (queueEntry.attempts < 3) {
        // Retry
        await ctx.runMutation(internal.queueProcessor.requeueTest, {
          testId: queueEntry.testId,
          priority: queueEntry.priority,
          attempts: queueEntry.attempts + 1,
          lastError: "Test abandoned - claimed but never started",
        });
      } else {
        // Mark as failed
        await ctx.runMutation(internal.testExecution.updateStatus, {
          testId: queueEntry.testId,
          status: "FAILED",
          success: false,
          error: "Test abandoned after 3 retry attempts",
          errorStage: "service",
        });

        await ctx.runMutation(internal.queueProcessor.removeFromQueue, {
          queueId: queueEntry._id,
        });
      }
    }
  },
});

export const queryAbandonedTests = internalQuery({
  args: { cutoffTime: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("testQueue")
      .withIndex("by_status_priority", (q) => q.eq("status", "claimed"))
      .filter((q) => q.lt(q.field("claimedAt"), args.cutoffTime))
      .collect();
  },
});

// v is already imported at the top of the file
