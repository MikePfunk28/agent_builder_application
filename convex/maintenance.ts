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
      const cutoffTime = Date.now() - SEVEN_DAYS;

      // Find completed tests older than 7 days
      const oldTests = await ctx.runQuery(internal.maintenance.findOldCompletedTests, {
        cutoffTime,
      });

      for (const test of oldTests) {
        try {
          // Archive test (purge logs, keep metadata)
          await ctx.runMutation(internal.maintenance.archiveTest, {
            testId: test._id,
          });
        } catch (error: any) {
          console.error(`Failed to archive test ${test._id}:`, error);
        }
      }
    } catch (error: any) {
      console.error("Archive old tests error:", error);
    }
  },
});

/**
 * Find old completed tests
 */
export const findOldCompletedTests = internalQuery({
  args: { cutoffTime: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("testExecutions")
      .withIndex("by_status", (q) => q.eq("status", "COMPLETED"))
      .filter((q) => q.lt(q.field("completedAt"), args.cutoffTime))
      .collect();
  },
});

/**
 * Archive a test (purge logs, keep metadata)
 */
export const archiveTest = internalMutation({
  args: { testId: v.id("testExecutions") },
  handler: async (ctx, args) => {
    const test = await ctx.db.get(args.testId);
    if (!test) return;

    // Keep metadata but clear logs and large data
    await ctx.db.patch(args.testId, {
      logs: [], // Clear logs to save space
      agentCode: "", // Clear large code content
      requirements: "",
      dockerfile: "",
      // archived: true, // Remove this field as it doesn't exist in schema
      // archivedAt: Date.now(), // Remove this field as it doesn't exist in schema
    });
  },
});

/**
 * Cleanup expired packages (runs hourly)
 */
export const cleanupExpiredPackages = internalAction({
  args: {},
  handler: async (ctx) => {
    try {
      const expiredPackages = await ctx.runQuery(internal.maintenance.findExpiredPackages);

      for (const pkg of expiredPackages) {
        try {
          // Delete from S3 (if we had S3 integration)
          // await deleteFromS3({ key: pkg.s3Key });

          // Delete Convex record
          await ctx.runMutation(internal.maintenance.deletePackage, {
            packageId: pkg._id,
          });
        } catch (error: any) {
          console.error(`Failed to delete package ${pkg._id}:`, error);
        }
      }
    } catch (error: any) {
      console.error("Cleanup expired packages error:", error);
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