import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    
    return await ctx.db
      .query("agents")
      .withIndex("by_user", (q) => q.eq("createdBy", userId))
      .order("desc")
      .collect();
  },
});

export const getPublicAgents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("agents")
      .withIndex("by_public", (q) => q.eq("isPublic", true))
      .order("desc")
      .take(20);
  },
});

export const get = query({
  args: { id: v.id("agents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const agent = await ctx.db.get(args.id);

    if (!agent) {
      return null;
    }

    // Allow access if user owns it or it's public
    if (agent.createdBy === userId || agent.isPublic) {
      return agent;
    }

    return null;
  },
});

// Internal version for use by other Convex functions
export const getInternal = internalQuery({
  args: { id: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    model: v.string(),
    systemPrompt: v.string(),
    tools: v.array(v.object({
      name: v.string(),
      type: v.string(),
      config: v.optional(v.any()),
      requiresPip: v.optional(v.boolean()),
      pipPackages: v.optional(v.array(v.string())),
    })),
    generatedCode: v.string(),
    dockerConfig: v.optional(v.string()),
    deploymentType: v.string(),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be authenticated");
    }

    return await ctx.db.insert("agents", {
      ...args,
      createdBy: userId,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("agents"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    model: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    tools: v.optional(v.array(v.object({
      name: v.string(),
      type: v.string(),
      config: v.optional(v.any()),
      requiresPip: v.optional(v.boolean()),
      pipPackages: v.optional(v.array(v.string())),
    }))),
    generatedCode: v.optional(v.string()),
    dockerConfig: v.optional(v.string()),
    deploymentType: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be authenticated");
    }

    const agent = await ctx.db.get(args.id);
    if (!agent || agent.createdBy !== userId) {
      throw new Error("Agent not found or access denied");
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("agents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be authenticated");
    }

    const agent = await ctx.db.get(args.id);
    if (!agent || agent.createdBy !== userId) {
      throw new Error("Agent not found or access denied");
    }

    await ctx.db.delete(args.id);
  },
});
