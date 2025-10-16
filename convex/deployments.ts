// Deployment tracking and management

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Create deployment record
export const create = mutation({
  args: {
    agentId: v.id("agents"),
    tier: v.string(),
    awsAccountId: v.optional(v.string()),
    region: v.string(),
    taskArn: v.optional(v.string()),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const deploymentId = await ctx.db.insert("deployments", {
      agentId: args.agentId,
      userId: userId as any,
      tier: args.tier,
      awsAccountId: args.awsAccountId,
      region: args.region,
      taskArn: args.taskArn,
      status: args.status,
      startedAt: Date.now(),
    });

    return deploymentId;
  },
});

// Update deployment status
export const updateStatus = mutation({
  args: {
    deploymentId: v.id("deployments"),
    status: v.string(),
    error: v.optional(v.string()),
    logs: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.deploymentId, {
      status: args.status,
      error: args.error,
      logs: args.logs,
      completedAt: Date.now(),
    });
  },
});

// Get deployment by ID
export const get = query({
  args: { id: v.id("deployments") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// List user's deployments
export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("deployments")
      .withIndex("by_user", (q) => q.eq("userId", userId as any))
      .order("desc")
      .take(args.limit || 20);
  },
});
