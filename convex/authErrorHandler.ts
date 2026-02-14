/**
 * OAuth Authentication Error Handler
 * 
 * This module provides comprehensive error handling for OAuth authentication flows.
 * It logs errors, provides user-friendly messages, and tracks authentication attempts.
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Log OAuth authentication attempt
 * 
 * RATE LIMITED: Only logs once per minute per provider to prevent quota exhaustion
 */
export const logOAuthAttempt = mutation({
  args: {
    provider: v.string(), // "github" | "google" | "cognito"
    success: v.boolean(),
    userId: v.optional(v.id("users")),
    error: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    callbackUrl: v.optional(v.string()),
    expectedCallbackUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // RATE LIMITING: Check if we've logged this provider in the last minute
    const oneMinuteAgo = Date.now() - 60000;
    const recentLogs = await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", oneMinuteAgo))
      .filter((q) => q.eq(q.field("eventType"), "oauth_login"))
      .collect();
    
    // Check if any recent log matches this provider
    const recentLog = recentLogs.find(log => 
      log.metadata?.provider === args.provider
    );
    
    if (recentLog) {
      return; // Rate limited — skip duplicate log for this provider
    }

    // Log audit event
    await ctx.db.insert("auditLogs", {
      eventType: "oauth_login",
      userId: args.userId,
      action: `oauth_${args.provider}_${args.success ? "success" : "failure"}`,
      resource: "authentication",
      resourceId: args.provider,
      success: args.success,
      details: {
        provider: args.provider,
        error: args.error,
        errorCode: args.errorCode,
        callbackUrl: args.callbackUrl,
        expectedCallbackUrl: args.expectedCallbackUrl,
      },
      metadata: {
        provider: args.provider,
      },
      timestamp: Date.now(),
    });

    // If failed, also log as error
    if (!args.success && args.error) {
      await ctx.db.insert("errorLogs", {
        category: "oauth",
        severity: "error",
        message: `OAuth ${args.provider} authentication failed: ${args.error}`,
        details: {
          provider: args.provider,
          errorCode: args.errorCode,
          callbackUrl: args.callbackUrl,
          expectedCallbackUrl: args.expectedCallbackUrl,
        },
        userId: args.userId,
        metadata: {
          provider: args.provider,
        },
        timestamp: Date.now(),
        resolved: false,
      });
    }

    // Auth attempt already persisted to auditLogs + errorLogs tables above
  },
});

/**
 * Log OAuth callback URL mismatch
 * 
 * RATE LIMITED: Only logs once per 5 minutes per provider
 */
export const logCallbackMismatch = mutation({
  args: {
    provider: v.string(),
    actualUrl: v.string(),
    expectedUrl: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    // RATE LIMITING: Check if we've logged this error recently
    const fiveMinutesAgo = Date.now() - 300000;
    const recentLogs = await ctx.db
      .query("errorLogs")
      .withIndex("by_category", (q) => q.eq("category", "oauth"))
      .filter((q) => q.gte(q.field("timestamp"), fiveMinutesAgo))
      .collect();
    
    // Check if any recent log matches this provider
    const recentLog = recentLogs.find(log => 
      log.metadata?.provider === args.provider
    );
    
    if (recentLog) {
      return; // Rate limited — skip duplicate callback mismatch log
    }

    await ctx.db.insert("errorLogs", {
      category: "oauth",
      severity: "warning",
      message: `OAuth callback URL mismatch for ${args.provider}`,
      details: {
        provider: args.provider,
        actualUrl: args.actualUrl,
        expectedUrl: args.expectedUrl,
        troubleshooting: [
          `Update ${args.provider} OAuth app callback URLs`,
          `Add: ${args.expectedUrl}`,
          `Current: ${args.actualUrl}`,
        ],
      },
      userId: args.userId,
      metadata: {
        provider: args.provider,
      },
      timestamp: Date.now(),
      resolved: false,
    });

    console.warn(`[OAuth] Callback URL mismatch for ${args.provider}`, {
      actualUrl: args.actualUrl,
      expectedUrl: args.expectedUrl,
    });
  },
});

/**
 * Log OAuth configuration error
 */
export const logConfigurationError = mutation({
  args: {
    provider: v.string(),
    missingVars: v.array(v.string()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("errorLogs", {
      category: "oauth",
      severity: "error",
      message: `OAuth ${args.provider} configuration incomplete`,
      details: {
        provider: args.provider,
        missingVariables: args.missingVars,
        troubleshooting: [
          `Set the following environment variables in Convex:`,
          ...args.missingVars.map((v) => `- ${v}`),
          `Run: npx convex env set ${args.missingVars[0]} "your-value"`,
        ],
      },
      userId: args.userId,
      metadata: {
        provider: args.provider,
      },
      timestamp: Date.now(),
      resolved: false,
    });

    console.error(`[OAuth] Configuration error for ${args.provider}`, {
      missingVariables: args.missingVars,
    });
  },
});

/**
 * Get OAuth error statistics
 */
export const getOAuthErrorStats = mutation({
  args: {
    timeRangeHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const timeRange = args.timeRangeHours || 24;
    const cutoffTime = Date.now() - (timeRange * 60 * 60 * 1000);

    const oauthErrors = await ctx.db
      .query("errorLogs")
      .withIndex("by_category", (q) => q.eq("category", "oauth"))
      .filter((q) => q.gte(q.field("timestamp"), cutoffTime))
      .collect();

    const stats = {
      total: oauthErrors.length,
      byProvider: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      resolved: oauthErrors.filter((e) => e.resolved).length,
      unresolved: oauthErrors.filter((e) => !e.resolved).length,
    };

    oauthErrors.forEach((error) => {
      const provider = error.metadata?.provider || "unknown";
      stats.byProvider[provider] = (stats.byProvider[provider] || 0) + 1;
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
    });

    return stats;
  },
});
