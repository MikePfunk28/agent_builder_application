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
    agentCoreRuntimeId: v.optional(v.string()),
    agentCoreEndpoint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const deploymentId = await ctx.db.insert("deployments", {
      agentId: args.agentId,
      userId: userId,
      tier: args.tier,
      awsAccountId: args.awsAccountId,
      region: args.region,
      taskArn: args.taskArn,
      agentCoreRuntimeId: args.agentCoreRuntimeId,
      agentCoreEndpoint: args.agentCoreEndpoint,
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
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit || 20);
  },
});

// Update AgentCore-specific metadata
export const updateAgentCoreMetadata = mutation({
  args: {
    deploymentId: v.id("deployments"),
    agentCoreRuntimeId: v.optional(v.string()),
    agentCoreEndpoint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.deploymentId, {
      agentCoreRuntimeId: args.agentCoreRuntimeId,
      agentCoreEndpoint: args.agentCoreEndpoint,
    });
  },
});


// Delete deployment (with AgentCore cleanup)
export const deleteDeployment = mutation({
  args: {
    deploymentId: v.id("deployments"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const deployment = await ctx.db.get(args.deploymentId);
    if (!deployment) {
      throw new Error("Deployment not found");
    }

    if (deployment.userId !== userId) {
      throw new Error("Not authorized to delete this deployment");
    }

    // Mark as deleted
    await ctx.db.patch(args.deploymentId, {
      status: "DELETED",
      deletedAt: Date.now(),
      isActive: false,
    });

    // Return sandbox ID for cleanup (if AgentCore deployment)
    return {
      success: true,
      agentCoreRuntimeId: deployment.agentCoreRuntimeId,
      tier: deployment.tier,
    };
  },
});
