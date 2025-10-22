import { query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

const MEMORY_TABLE = "agentMemories" as const;

export const getAgentMemories = query({
  args: {
    agentId: v.optional(v.id("agents")),
    conversationId: v.optional(v.id("interleavedConversations")),
    memoryType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 20, 100);
    let cursor = ctx.db.query(MEMORY_TABLE).order("desc");

    if (args.agentId) {
      cursor = cursor.filter((q) => q.eq(q.field("agentId"), args.agentId));
    }

    if (args.conversationId) {
      cursor = cursor.filter((q) => q.eq(q.field("conversationId"), args.conversationId));
    }

    if (args.memoryType) {
      cursor = cursor.filter((q) => q.eq(q.field("memoryType"), args.memoryType));
    }

    const results = await cursor.take(limit);
    return results.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  },
});

export const getMemoryById = internalQuery({
  args: {
    memoryId: v.id("agentMemories"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.memoryId);
  },
});

export const insertMemoryRecord = internalMutation({
  args: {
    agentId: v.optional(v.id("agents")),
    conversationId: v.optional(v.id("interleavedConversations")),
    memoryType: v.string(),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    content: v.optional(v.string()),
    s3Key: v.optional(v.string()),
    metadata: v.optional(v.any()),
    tokenCount: v.optional(v.number()),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert(MEMORY_TABLE, {
      ...args,
      archived: false,
    });
  },
});

export const archiveMemory = internalMutation({
  args: {
    memoryId: v.id("agentMemories"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.memoryId, {
      archived: true,
    });
  },
});
