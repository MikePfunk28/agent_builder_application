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

    console.log(`[OAuth] ${args.provider} authentication ${args.success ? "succeeded" : "failed"}`, {
      provider: args.provider,
      success: args.success,
      error: args.error,
      userId: args.userId,
    });
  },
});

/**
 * Log OAuth callback URL mismatch
 */
export const logCallbackMismatch = mutation({
  args: {
    provider: v.string(),
    actualUrl: v.string(),
    expectedUrl: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
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
