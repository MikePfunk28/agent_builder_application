/**
 * Centralized Error Logging and Audit System
 *
 * This module provides comprehensive error logging and audit trail functionality
 * for OAuth authentication, MCP operations, and agent invocations.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Log an error with context
 */
export const logError = mutation({
  args: {
    category: v.string(), // "oauth" | "mcp" | "agent" | "deployment" | "general"
    severity: v.string(), // "info" | "warning" | "error" | "critical"
    message: v.string(),
    details: v.optional(v.record(v.string(), v.any())), // Error detail key-value pairs
    userId: v.optional(v.id("users")),
    stackTrace: v.optional(v.string()),
    metadata: v.optional(v.object({
      provider: v.optional(v.string()),
      serverName: v.optional(v.string()),
      agentId: v.optional(v.string()),
      deploymentId: v.optional(v.string()),
      requestId: v.optional(v.string()),
    })),
  },
  handler: async (ctx: any, args: any): Promise<string> => {
    const errorId = await ctx.db.insert("errorLogs", {
      category: args.category,
      severity: args.severity,
      message: args.message,
      details: args.details,
      userId: args.userId,
      stackTrace: args.stackTrace,
      metadata: args.metadata,
      timestamp: Date.now(),
      resolved: false,
    });

    // Log to console for immediate visibility
    console.error(`[${args.category.toUpperCase()}] ${args.severity.toUpperCase()}: ${args.message}`, {
      errorId,
      details: args.details,
      metadata: args.metadata,
    });

    return errorId;
  },
});

/**
 * Log an audit event (for tracking important actions)
 */
export const logAuditEvent = mutation({
  args: {
    eventType: v.string(), // "oauth_login" | "mcp_invocation" | "agent_invocation" | "deployment_created"
    userId: v.optional(v.id("users")),
    action: v.string(),
    resource: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    success: v.boolean(),
    details: v.optional(v.record(v.string(), v.any())), // Audit event detail key-value pairs
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
    const auditId = await ctx.db.insert("auditLogs", {
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

    // Log to console for audit trail
    console.log(`[AUDIT] ${args.eventType}: ${args.action}`, {
      auditId,
      userId: args.userId,
      success: args.success,
      resource: args.resource,
      metadata: args.metadata,
    });

    return auditId;
  },
});

/**
 * Query error logs with filtering
 */
export const getErrorLogs = query({
  args: {
    category: v.optional(v.string()),
    severity: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let logs;

    // Apply filters
    if (args.category) {
      logs = await ctx.db
        .query("errorLogs")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .order("desc")
        .take(args.limit || 100);
    } else if (args.severity) {
      logs = await ctx.db
        .query("errorLogs")
        .withIndex("by_severity", (q) => q.eq("severity", args.severity!))
        .order("desc")
        .take(args.limit || 100);
    } else if (args.userId) {
      logs = await ctx.db
        .query("errorLogs")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .take(args.limit || 100);
    } else {
      logs = await ctx.db
        .query("errorLogs")
        .order("desc")
        .take(args.limit || 100);
    }

    return logs;
  },
});

/**
 * Query audit logs with filtering
 */
export const getAuditLogs = query({
  args: {
    eventType: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    success: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let logs;

    // Apply filters
    if (args.eventType) {
      logs = await ctx.db
        .query("auditLogs")
        .withIndex("by_event_type", (q) => q.eq("eventType", args.eventType!))
        .order("desc")
        .take(args.limit || 100);
    } else if (args.userId) {
      logs = await ctx.db
        .query("auditLogs")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .take(args.limit || 100);
    } else {
      logs = await ctx.db
        .query("auditLogs")
        .order("desc")
        .take(args.limit || 100);
    }

    // Filter by success if specified
    if (args.success !== undefined) {
      logs = logs.filter((log) => log.success === args.success);
    }

    return logs;
  },
});

/**
 * Mark an error as resolved
 */
export const resolveError = mutation({
  args: {
    errorId: v.id("errorLogs"),
    resolution: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.errorId, {
      resolved: true,
      resolvedAt: Date.now(),
      resolution: args.resolution,
    });

    return { success: true };
  },
});

/**
 * Get error statistics
 */
export const getErrorStats = query({
  args: {
    timeRangeHours: v.optional(v.number()), // Default 24 hours
  },
  handler: async (ctx, args) => {
    const timeRange = args.timeRangeHours || 24;
    const cutoffTime = Date.now() - (timeRange * 60 * 60 * 1000);

    const allErrors = await ctx.db
      .query("errorLogs")
      .filter((q) => q.gte(q.field("timestamp"), cutoffTime))
      .collect();

    const stats = {
      total: allErrors.length,
      byCategory: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      resolved: allErrors.filter((e) => e.resolved).length,
      unresolved: allErrors.filter((e) => !e.resolved).length,
    };

    // Count by category
    allErrors.forEach((error) => {
      stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
    });

    return stats;
  },
});
