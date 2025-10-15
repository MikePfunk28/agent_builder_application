/**
 * Package Database Mutations
 * 
 * Separated from deploymentPackageGenerator.ts because that file uses "use node".
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Create package record (internal mutation)
 */
export const createPackageRecord = mutation({
  args: {
    testId: v.id("testExecutions"),
    agentId: v.id("agents"),
    userId: v.id("users"),
    packageName: v.string(),
    fileSize: v.number(),
    s3Bucket: v.string(),
    s3Key: v.string(),
    downloadUrl: v.string(),
    urlExpiresAt: v.number(),
    files: v.array(v.object({
      path: v.string(),
      size: v.number(),
      checksum: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const packageId = await ctx.db.insert("deploymentPackages", {
      testId: args.testId,
      agentId: args.agentId,
      userId: args.userId,
      packageName: args.packageName,
      fileSize: args.fileSize,
      s3Bucket: args.s3Bucket,
      s3Key: args.s3Key,
      downloadUrl: args.downloadUrl,
      urlExpiresAt: args.urlExpiresAt,
      files: args.files,
      generatedAt: Date.now(),
      downloadCount: 0,
    });

    // Update test with package URL
    await ctx.db.patch(args.testId, {
      deploymentPackageUrl: args.downloadUrl,
      deploymentPackageExpiry: args.urlExpiresAt,
    });

    return packageId;
  },
});