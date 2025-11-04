import { mutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";

async function getUserScope(ctx: any): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return "anonymous";
  }
  return (
    identity.subject ||
    identity.tokenIdentifier ||
    identity.email ||
    identity.provider ||
    "anonymous"
  );
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userScope = await getUserScope(ctx);
    return await ctx.db
      .query("workflows")
      .withIndex("by_user", (q) => q.eq("userId", userScope))
      .order("desc")
      .take(50);
  },
});

export const get = query({
  args: {
    workflowId: v.id("workflows"),
  },
  handler: async (ctx, args) => {
    const workflow = await ctx.db.get(args.workflowId);
    if (!workflow) {
      return null;
    }
    const userScope = await getUserScope(ctx);
    if (workflow.userId !== userScope) {
      throw new Error("Workflow not found for current user");
    }
    return workflow;
  },
});

// Internal query for Node.js actions to fetch workflows without user scope check
export const getInternal = internalQuery({
  args: {
    workflowId: v.id("workflows"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.workflowId);
  },
});

export const save = mutation({
  args: {
    workflowId: v.optional(v.id("workflows")),
    name: v.string(),
    nodes: v.array(v.any()),
    edges: v.array(v.any()),
    templateId: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userScope = await getUserScope(ctx);
    const now = Date.now();
    const status = args.status ?? "draft";
    const templateId = args.templateId ?? "custom";

    if (args.workflowId) {
      const existing = await ctx.db.get(args.workflowId);
      if (!existing) {
        throw new Error("Workflow not found");
      }
      if (existing.userId !== userScope) {
        throw new Error("Workflow not found for current user");
      }
      await ctx.db.patch(args.workflowId, {
        name: args.name,
        nodes: args.nodes,
        edges: args.edges,
        status,
        updatedAt: now,
      });
      return { workflowId: args.workflowId };
    }

    const workflowId = await ctx.db.insert("workflows", {
      name: args.name,
      userId: userScope,
      templateId,
      nodes: args.nodes,
      edges: args.edges,
      status,
      createdAt: now,
      updatedAt: now,
    });

    return { workflowId };
  },
});

export const remove = mutation({
  args: {
    workflowId: v.id("workflows"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.workflowId);
    if (!existing) {
      return { removed: false };
    }
    const userScope = await getUserScope(ctx);
    if (existing.userId !== userScope) {
      throw new Error("Workflow not found for current user");
    }
    await ctx.db.delete(args.workflowId);
    return { removed: true };
  },
});
