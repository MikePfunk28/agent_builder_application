/**
 * Audit Logs API
 * Track all significant events for compliance and debugging
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Log an event to the audit log
 */
export const logEvent = mutation({
  args: {
    eventType: v.string(),
    userId: v.optional(v.id("users")),
    action: v.string(),
    resource: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    success: v.boolean(),
    details: v.optional(v.any()),
    metadata: v.optional(v.object({
      provider: v.optional(v.string()),
      serverName: v.optional(v.string()),
      toolName: v.optional(v.string()),
      agentId: v.optional(v.string()),
      ipAddress: v.optional(v.string()),
      userAgent: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("auditLogs", {
      eventType: args.eventType,
      userId: args.userId,
      action: args.action,
      resource: args.resource,
      resourceId: args.resourceId,
      success: args.success,
      details: args.details,
      metadata: args.metadata,
      timestamp: Date.now(),
    });
  },
});

/**
 * Get audit logs for current user
 */
export const getUserLogs = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit || 50);

    return logs;
  },
});

/**
 * Get all audit logs (admin only)
 */
export const getAllLogs = query({
  args: {
    limit: v.optional(v.number()),
    eventType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    // TODO: Add admin check here

    if (args.eventType) {
      const logs = await ctx.db
        .query("auditLogs")
        .withIndex("by_event_type", (q) => q.eq("eventType", args.eventType!))
        .order("desc")
        .take(args.limit || 100);

      return logs;
    }

    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit || 100);

    return logs;
  },
});
