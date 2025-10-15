"use node";

/**
 * Maintenance Functions
 *
 * Scheduled maintenance tasks for archiving old tests,
 * cleaning up expired packages, and managing storage.
 */

import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

/**
 * Archive old tests (runs daily at 2 AM UTC)
 */
export const archiveOldTests = internalAction({
  args: {},
  handler: async (ctx) => {
    try {
      console.log("🧹 Starting old test archival...");

      const cutoffTime = Date.now() - SEVEN_DAYS;

      // Find completed tests older than 7 days
      const oldTests = await ctx.runQuery(internal.maintenance.findOldCompletedTests, {
        cutoffTime,
      });

      console.log(`📊 Found ${oldTests.length} tests to archive`);

      let archived = 0;
      let failed = 0;

      for (const test of oldTests) {
        try {
          // Archive test (purge logs, keep metadata)
          await ctx.runMutation(internal.maintenance.archiveTest, {
            testId: test._id,
          });

          archived++;

          if (archived % 100 === 0) {
            console.log(`📦 Archived ${archived}/${oldTests.length} tests...`);
          }
        } catch (error: any) {
          console.error(`❌ Failed to archive test ${test._id}:`, error);
          failed++;
        }
      }

      console.log(`✅ Archival complete: ${archived} archived, ${failed} failed`);

      return {
        archived,
        failed,
        total: oldTests.length,
      };
    } catch (error: any) {
      console.error("❌ Archive job failed:", error);
      return {
        error: error.message,
      };
    }
  },
});

/**
 * Find old completed tests
 */
export const findOldCompletedTests = internalQuery({
  args: { cutoffTime: v.number() },
  handler: async (ctx, args) => {
    const completedTests = await ctx.db
      .query("testExecutions")
      .withIndex("by_status", (q) => q.eq("status", "COMPLETED"))
      .filter((q) => q.lt(q.field("completedAt"), args.cutoffTime))
      .collect();

    const failedTests = await ctx.db
      .query("testExecutions")
      .withIndex("by_status", (q) => q.eq("status", "FAILED"))
      .filter((q) => q.lt(q.field("completedAt"), args.cutoffTime))
      .collect();

    return [...completedTests, ...failedTests];
  },
});

/**
 * Archive a test (purge logs, keep metadata)
 */
export const archiveTest = internalMutation({
  args: { testId: v.id("testExecutions") },
  handler: async (ctx, args) => {
    const test = await ctx.db.get(args.testId);

    if (!test) {
      return;
    }

    // Update status to ARCHIVED and clear logs
    await ctx.db.patch(args.testId, {
      status: "ARCHIVED",
      logs: ["[Logs archived after 7 days]"],
      agentCode: "", // Clear large fields to save storage
      requirements: "",
      dockerfile: "",
    });
  },
});

/**
 * Cleanup expired deployment packages (runs hourly)
 */
export const cleanupExpiredPackages = internalAction({
  args: {},
  handler: async (ctx) => {
    try {
      console.log("🧹 Starting expired package cleanup...");

      const expiredPackages = await ctx.runQuery(internal.maintenance.findExpiredPackages);

      console.log(`📊 Found ${expiredPackages.length} expired packages`);

      let deleted = 0;
      let failed = 0;

      for (const pkg of expiredPackages) {
        try {
          // Delete from S3
          await deleteFromS3(pkg.s3Bucket, pkg.s3Key);

          // Delete Convex record
          await ctx.runMutation(internal.maintenance.deletePackage, {
            packageId: pkg._id,
          });

          deleted++;

          if (deleted % 50 === 0) {
            console.log(`🗑️  Deleted ${deleted}/${expiredPackages.length} packages...`);
          }
        } catch (error: any) {
          console.error(`❌ Failed to delete package ${pkg._id}:`, error);
          failed++;
        }
      }

      console.log(`✅ Cleanup complete: ${deleted} deleted, ${failed} failed`);

      return {
        deleted,
        failed,
        total: expiredPackages.length,
      };
    } catch (error: any) {
      console.error("❌ Cleanup job failed:", error);
      return {
        error: error.message,
      };
    }
  },
});

/**
 * Find expired packages
 */
export const findExpiredPackages = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    return await ctx.db
      .query("deploymentPackages")
      .withIndex("by_expiry")
      .filter((q) => q.lt(q.field("urlExpiresAt"), now))
      .collect();
  },
});

/**
 * Delete package record
 */
export const deletePackage = internalMutation({
  args: { packageId: v.id("deploymentPackages") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.packageId);
  },
});

/**
 * Cleanup abandoned queue entries
 */
export const cleanupAbandonedQueue = internalAction({
  args: {},
  handler: async (ctx) => {
    try {
      const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;

      const abandoned = await ctx.runQuery(internal.maintenance.findAbandonedQueueEntries, {
        cutoffTime: fifteenMinutesAgo,
      });

      console.log(`🧹 Found ${abandoned.length} abandoned queue entries`);

      for (const entry of abandoned) {
        await ctx.runMutation(internal.maintenance.deleteQueueEntry, {
          queueId: entry._id,
        });
      }

      return {
        cleaned: abandoned.length,
      };
    } catch (error: any) {
      console.error("❌ Queue cleanup failed:", error);
      return {
        error: error.message,
      };
    }
  },
});

/**
 * Find abandoned queue entries
 */
export const findAbandonedQueueEntries = internalQuery({
  args: { cutoffTime: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("testQueue")
      .withIndex("by_status_priority", (q) => q.eq("status", "abandoned"))
      .collect();
  },
});

/**
 * Delete queue entry
 */
export const deleteQueueEntry = internalMutation({
  args: { queueId: v.id("testQueue") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.queueId);
  },
});

/**
 * Get storage statistics
 */
export const getStorageStats = internalQuery({
  args: {},
  handler: async (ctx) => {
    const allTests = await ctx.db.query("testExecutions").collect();
    const allPackages = await ctx.db.query("deploymentPackages").collect();

    const testsByStatus: Record<string, number> = {};
    let totalLogSize = 0;

    allTests.forEach(test => {
      testsByStatus[test.status] = (testsByStatus[test.status] || 0) + 1;
      totalLogSize += test.logs.reduce((sum, log) => sum + log.length, 0);
    });

    const totalPackageSize = allPackages.reduce((sum, pkg) => sum + pkg.fileSize, 0);

    return {
      tests: {
        total: allTests.length,
        byStatus: testsByStatus,
        logSizeBytes: totalLogSize,
      },
      packages: {
        total: allPackages.length,
        totalSizeBytes: totalPackageSize,
        expired: allPackages.filter(p => p.urlExpiresAt < Date.now()).length,
      },
    };
  },
});

// Helper Functions

async function deleteFromS3(bucket: string, key: string): Promise<void> {
  try {
    // Import AWS SDK dynamically
    const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");

    const s3Client = new S3Client({
      region: process.env.AWS_S3_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    await s3Client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }));

    console.log(`✅ Deleted S3 object: ${bucket}/${key}`);
  } catch (error: any) {
    console.error(`❌ Failed to delete from S3: ${error.message}`);
    throw error;
  }
}
