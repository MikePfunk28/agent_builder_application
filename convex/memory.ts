"use node";

/**
 * Agent Memory Store
 * Provides hybrid Convex + S3 persistence for long running agent memories.
 */

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

const INLINE_THRESHOLD_BYTES = parseInt(process.env.AGENT_MEMORY_INLINE_THRESHOLD || "8192");
const DEFAULT_BUCKET = process.env.AWS_S3_BUCKET;
const DEFAULT_REGION = process.env.AWS_REGION || "us-east-1";

const MEMORY_TABLE = "agentMemories" as const;

export const appendAgentMemory = action({
  args: {
    agentId: v.optional(v.id("agents")),
    conversationId: v.optional(v.id("interleavedConversations")),
    memoryType: v.string(),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    content: v.string(),
    metadata: v.optional(v.any()),
    tokenCount: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ memoryId: string; s3Key?: string; createdAt: number }> => {
    return await ctx.runAction(internal.memory.recordMemory, args);
  },
});

export const getAgentMemories = action({
  args: {
    agentId: v.optional(v.id("agents")),
    conversationId: v.optional(v.id("interleavedConversations")),
    memoryType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<any[]> => {
    return await ctx.runQuery(api.memoryData.getAgentMemories, args);
  },
});

export const getMemoryContent = action({
  args: {
    memoryId: v.id("agentMemories"),
  },
  handler: async (ctx, args): Promise<{ content: string; metadata: any; s3Key: string | null }> => {
    const memory = await ctx.runQuery(internal.memoryData.getMemoryById, {
      memoryId: args.memoryId,
    });
    if (!memory) {
      throw new Error("Memory not found");
    }

    if (memory.content) {
      return { content: memory.content, metadata: memory.metadata, s3Key: memory.s3Key ?? null };
    }

    if (!memory.s3Key) {
      return { content: "", metadata: memory.metadata, s3Key: null };
    }

    if (!DEFAULT_BUCKET) {
      throw new Error("AWS_S3_BUCKET is not configured");
    }

    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({ region: DEFAULT_REGION });
    const response = await client.send(new GetObjectCommand({
      Bucket: DEFAULT_BUCKET,
      Key: memory.s3Key,
    }));

    const body = await response.Body?.transformToString();
    const parsed = body ? JSON.parse(body) : {};

    return {
      content: parsed.content ?? "",
      metadata: parsed.metadata ?? memory.metadata,
      s3Key: memory.s3Key,
    };
  },
});

export const recordMemory = internalAction({
  args: {
    agentId: v.optional(v.id("agents")),
    conversationId: v.optional(v.id("interleavedConversations")),
    memoryType: v.string(),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    content: v.string(),
    metadata: v.optional(v.any()),
    tokenCount: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ memoryId: any; s3Key?: string; createdAt: number }> => {
    const createdAt = Date.now();
    let inlineContent: string | undefined = args.content;
    let s3Key: string | undefined;

    if (args.content.length > INLINE_THRESHOLD_BYTES) {
      if (!DEFAULT_BUCKET) {
        throw new Error("AWS_S3_BUCKET is not configured for memory storage");
      }

      const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
      const client = new S3Client({ region: DEFAULT_REGION });
      const keySuffix = `${args.agentId ?? "anon"}/${createdAt}-${Math.random().toString(36).slice(2)}.json`;
      const payload = JSON.stringify({
        content: args.content,
        metadata: args.metadata,
        createdAt,
      });
      const fullKey = `agent-memories/${keySuffix}`;
      await client.send(new PutObjectCommand({
        Bucket: DEFAULT_BUCKET,
        Key: fullKey,
        Body: payload,
        ContentType: "application/json",
      }));

      inlineContent = undefined;
      s3Key = fullKey;
    }

    const memoryId = await ctx.runMutation(internal.memoryData.insertMemoryRecord, {
      agentId: args.agentId,
      conversationId: args.conversationId,
      memoryType: args.memoryType,
      title: args.title,
      summary: args.summary,
      content: inlineContent,
      s3Key,
      metadata: args.metadata,
      tokenCount: args.tokenCount,
      createdAt,
    });

    return { memoryId, s3Key, createdAt };
  },
});

export const archiveMemory = action({
  args: {
    memoryId: v.id("agentMemories"),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.memoryData.archiveMemory, args);
  },
});

export const recordConversationSnapshot = internalAction({
  args: {
    agentId: v.optional(v.id("agents")),
    conversationId: v.id("interleavedConversations"),
    s3Key: v.string(),
    messageCount: v.number(),
  },
  handler: async (ctx, args) => {
    const summary = `Conversation snapshot (${args.messageCount} messages)`;
    await ctx.runAction(internal.memory.recordMemory, {
      agentId: args.agentId,
      conversationId: args.conversationId,
      memoryType: "interleaved_snapshot",
      title: "Conversation Snapshot",
      summary,
      content: JSON.stringify({
        s3Key: args.s3Key,
        capturedAt: Date.now(),
      }),
      metadata: {
        messageCount: args.messageCount,
        s3Key: args.s3Key,
      },
    });
  },
});
