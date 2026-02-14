/**
 * Conversation Management
 * Manages agent conversation history and context in Convex
 */

import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

/**
 * Create a new conversation
 */
export const create = mutation({
  args: {
    agentId: v.id("agents"),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db.insert("conversations", {
      agentId: args.agentId,
      userId,
      title: args.title || "New Conversation",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const createConversation = mutation({
  args: {
    agentId: v.id("agents"),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db.insert("conversations", {
      agentId: args.agentId,
      userId,
      title: args.title || "New Conversation",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Send message and execute agent with strands-agents ConversationManager
 */
export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

    // Add user message to Convex (for persistence)
    const userMessage = {
      role: "user" as const,
      content: args.message,
      timestamp: Date.now(),
    };

    await ctx.db.patch(args.conversationId, {
      messages: [...conversation.messages, userMessage],
      updatedAt: Date.now(),
    });

    // Submit test with conversation history for strands-agents ConversationManager
    // ConversationManager will handle sliding window (last 20 messages / 4000 tokens)
    await ctx.runMutation(api.testExecution.submitTest, {
      agentId: conversation.agentId,
      testQuery: args.message,
      conversationId: args.conversationId,
    });
  },
});

/**
 * Get conversation by ID
 */
export const get = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      return null;
    }

    return conversation;
  },
});

export const getConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      return null;
    }

    return conversation;
  },
});

/**
 * Get conversation history (internal)
 */
export const getHistory = internalQuery({
  args: { conversationId: v.string() },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId as any);
    if (!conversation) {
      return [];
    }

    // Type guard to ensure we have a conversation document
    if ('messages' in conversation && Array.isArray(conversation.messages)) {
      return conversation.messages;
    }
    
    return [];
  },
});

/**
 * List user's conversations for an agent
 */
export const listConversations = query({
  args: {
    agentId: v.id("agents"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    return await ctx.db
      .query("conversations")
      .withIndex("by_agent_user", (q) => q.eq("agentId", args.agentId).eq("userId", userId))
      .order("desc")
      .take(args.limit || 50);
  },
});

/**
 * Add message to conversation
 */
export const addMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    metadata: v.optional(v.record(v.string(), v.any())), // Message metadata key-value pairs
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found or access denied");
    }

    const message = {
      role: args.role,
      content: args.content,
      timestamp: Date.now(),
      metadata: args.metadata,
    };

    const messages = [...(conversation.messages || []), message];

    await ctx.db.patch(args.conversationId, {
      messages,
      updatedAt: Date.now(),
    });

    return message;
  },
});

/**
 * Add message to conversation (internal)
 */
export const addMessageInternal = internalMutation({
  args: {
    conversationId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    metadata: v.optional(v.record(v.string(), v.any())), // Message metadata key-value pairs
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId as any);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const message = {
      role: args.role,
      content: args.content,
      timestamp: Date.now(),
      metadata: args.metadata,
    };

    // Type guard to ensure we have a conversation document
    const existingMessages = ('messages' in conversation && Array.isArray(conversation.messages)) 
      ? conversation.messages 
      : [];
    const messages = [...existingMessages, message];

    await ctx.db.patch(args.conversationId as any, {
      messages,
      updatedAt: Date.now(),
    });

    return message;
  },
});

/**
 * Clear conversation history
 */
export const clear = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.conversationId, {
      messages: [],
      updatedAt: Date.now(),
    });
  },
});

export const clearConversation = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found or access denied");
    }

    await ctx.db.patch(args.conversationId, {
      messages: [],
      updatedAt: Date.now(),
    });
  },
});

/**
 * Delete conversation
 */
export const deleteConversation = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found or access denied");
    }

    await ctx.db.delete(args.conversationId);
  },
});

/**
 * Update conversation title
 */
export const updateTitle = mutation({
  args: {
    conversationId: v.id("conversations"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found or access denied");
    }

    await ctx.db.patch(args.conversationId, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Get conversation statistics
 */
export const getStats = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      return null;
    }

    const messages = conversation.messages || [];
    const userMessages = messages.filter((m: any) => m.role === "user");
    const assistantMessages = messages.filter((m: any) => m.role === "assistant");

    return {
      totalMessages: messages.length,
      userMessages: userMessages.length,
      assistantMessages: assistantMessages.length,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      duration: Date.now() - conversation.createdAt,
    };
  },
});
