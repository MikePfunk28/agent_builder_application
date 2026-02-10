/**
 * Rate Limiting Middleware for Convex Backend
 * Implements sliding window rate limiting with Redis-like behavior
 * Protects against abuse while allowing legitimate usage
 */

import { action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests per window
  blockDurationMs?: number; // How long to block after limit exceeded
  burstAllowance?: number;  // Allow burst requests
}

interface RateLimitEntry {
  userId: string;
  action: string;
  requests: number[];
  blockedUntil?: number;
  lastRequest: number;
}

// Default rate limits by action type
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Agent execution (most expensive)
  "agentExecution": {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 10,         // 10 executions per minute
    blockDurationMs: 5 * 60 * 1000, // 5 minute block
  },

  // Agent testing (expensive)
  "agentTesting": {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 20,         // 20 tests per minute
    blockDurationMs: 2 * 60 * 1000, // 2 minute block
  },

  // Swarm operations (very expensive)
  "swarmExecution": {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 3,          // 3 swarm executions per 5 minutes
    blockDurationMs: 15 * 60 * 1000, // 15 minute block
  },

  // Model operations
  "modelOperations": {
    windowMs: 30 * 1000,     // 30 seconds
    maxRequests: 50,         // 50 operations per 30 seconds
    blockDurationMs: 60 * 1000, // 1 minute block
  },

  // General API calls
  "generalApi": {
    windowMs: 10 * 1000,     // 10 seconds
    maxRequests: 100,        // 100 calls per 10 seconds
    blockDurationMs: 30 * 1000, // 30 second block
  },

  // File uploads/downloads
  "fileOperations": {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 30,         // 30 operations per minute
    blockDurationMs: 2 * 60 * 1000, // 2 minute block
  },

  // Authentication operations
  "authOperations": {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 10,         // 10 auth operations per minute
    blockDurationMs: 5 * 60 * 1000, // 5 minute block
  },
};

/**
 * Check if request is within rate limits
 */
export async function checkRateLimit(
  ctx: ActionCtx,
  userId: string,
  action: string,
  config?: RateLimitConfig
): Promise<{
  allowed: boolean;
  remainingRequests: number;
  resetTime: number;
  blockedUntil?: number;
  reason?: string;
}> {
  const limitConfig = config || RATE_LIMITS[action] || RATE_LIMITS.generalApi;

  // Get current rate limit entry
  const entry = await ctx.runQuery(internal.rateLimiter.getRateLimitEntry, {
    userId,
    action,
  });

  const now = Date.now();

  // Check if user is currently blocked
  if (entry?.blockedUntil && now < entry.blockedUntil) {
    return {
      allowed: false,
      remainingRequests: 0,
      resetTime: entry.blockedUntil,
      blockedUntil: entry.blockedUntil,
      reason: "Rate limit exceeded - temporarily blocked",
    };
  }

  // Clean old requests outside the window
  const windowStart = now - limitConfig.windowMs;
  const validRequests = entry?.requests.filter((time: number) => time > windowStart) || [];

  // Check if within limits
  if (validRequests.length >= limitConfig.maxRequests) {
    // Block the user
    const blockedUntil = now + (limitConfig.blockDurationMs || limitConfig.windowMs);

    await ctx.runMutation(internal.rateLimiter.updateRateLimitEntry, {
      userId,
      action,
      requests: validRequests,
      blockedUntil,
      lastRequest: now,
    });

    return {
      allowed: false,
      remainingRequests: 0,
      resetTime: blockedUntil,
      blockedUntil,
      reason: `Rate limit exceeded: ${limitConfig.maxRequests} requests per ${limitConfig.windowMs / 1000}s`,
    };
  }

  // Update the entry with new request
  const newRequests = [...validRequests, now];
  await ctx.runMutation(internal.rateLimiter.updateRateLimitEntry, {
    userId,
    action,
    requests: newRequests,
    lastRequest: now,
  });

  const remainingRequests = limitConfig.maxRequests - newRequests.length;
  const resetTime = now + limitConfig.windowMs;

  return {
    allowed: true,
    remainingRequests,
    resetTime,
  };
}

/**
 * Rate limiting middleware wrapper for actions
 */
export function withRateLimit<T extends any[], R>(
  actionName: string,
  config?: RateLimitConfig
) {
  return (fn: (ctx: ActionCtx, ...args: T) => Promise<R>) => {
    return async (ctx: ActionCtx, ...args: T): Promise<R> => {
      // Get user ID from Convex auth
      const identity = await ctx.auth.getUserIdentity();
      const userId = identity?.subjectId;

      if (!userId) {
        throw new Error("Authentication required");
      }

      // Check rate limit
      const rateLimitResult = await checkRateLimit(ctx, String(userId), actionName, config);

      if (!rateLimitResult.allowed) {
        throw new Error(`Rate limit exceeded: ${rateLimitResult.reason}`);
      }

      // Execute the original function
      return fn(ctx, ...args);
    };
  };
}

/**
 * Get rate limit entry for user and action
 */
export const getRateLimitEntry = internalQuery({
  args: {
    userId: v.string(),
    action: v.string(),
  },
  handler: async (ctx, args): Promise<RateLimitEntry | null> => {
    const entry = await ctx.db
      .query("rateLimitEntries")
      .withIndex("by_user_action", (q) =>
        q.eq("userId", args.userId).eq("action", args.action)
      )
      .first();

    return entry as RateLimitEntry | null;
  },
});

/**
 * Update or create rate limit entry
 */
export const updateRateLimitEntry = internalMutation({
  args: {
    userId: v.string(),
    action: v.string(),
    requests: v.array(v.number()),
    blockedUntil: v.optional(v.number()),
    lastRequest: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("rateLimitEntries")
      .withIndex("by_user_action", (q) =>
        q.eq("userId", args.userId).eq("action", args.action)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        requests: args.requests,
        blockedUntil: args.blockedUntil,
        lastRequest: args.lastRequest,
      });
    } else {
      await ctx.db.insert("rateLimitEntries", {
        userId: args.userId,
        action: args.action,
        requests: args.requests,
        blockedUntil: args.blockedUntil,
        lastRequest: args.lastRequest,
      });
    }
  },
});

/**
 * Clean up old rate limit entries (run periodically)
 */
export const cleanupOldEntries = internalMutation({
  handler: async (ctx) => {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago

    const oldEntries = await ctx.db
      .query("rateLimitEntries")
      .filter((q) => q.lt(q.field("lastRequest"), cutoffTime))
      .collect();

    for (const entry of oldEntries) {
      await ctx.db.delete(entry._id);
    }

    return { cleaned: oldEntries.length };
  },
});

/**
 * Get rate limit status for user
 */
export const getRateLimitStatus = internalQuery({
  args: {
    userId: v.string(),
    action: v.string(),
  },
  handler: async (ctx, args): Promise<{
    currentRequests: number;
    limit: number;
    windowMs: number;
    blockedUntil?: number;
    resetTime: number;
  } | null> => {
    // Direct db access instead of ctx.runQuery (cannot nest queries inside internalQuery)
    const entry = await ctx.db
      .query("rateLimitEntries")
      .withIndex("by_user_action", (q) =>
        q.eq("userId", args.userId).eq("action", args.action)
      )
      .first();

    const config = RATE_LIMITS[args.action] || RATE_LIMITS.generalApi;

    if (!entry) {
      return {
        currentRequests: 0,
        limit: config.maxRequests,
        windowMs: config.windowMs,
        resetTime: Date.now() + config.windowMs,
      };
    }

    const now = Date.now();
    const windowStart = now - config.windowMs;
    const validRequests = entry.requests.filter((time: number) => time > windowStart);

    return {
      currentRequests: validRequests.length,
      limit: config.maxRequests,
      windowMs: config.windowMs,
      blockedUntil: entry.blockedUntil,
      resetTime: now + config.windowMs,
    };
  },
});

/**
 * Reset rate limits for a user (admin function)
 */
export const resetUserRateLimits = internalMutation({
  args: {
    userId: v.string(),
    action: v.optional(v.string()), // If not provided, reset all actions
  },
  handler: async (ctx, args) => {
    if (args.action) {
      // Reset specific action
      const entry = await ctx.db
        .query("rateLimitEntries")
        .withIndex("by_user_action", (q) =>
          q.eq("userId", args.userId).eq("action", args.action!)
        )
        .first();

      if (entry) {
        await ctx.db.delete(entry._id);
      }
    } else {
      // Reset all actions for user
      const entries = await ctx.db
        .query("rateLimitEntries")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();

      for (const entry of entries) {
        await ctx.db.delete(entry._id);
      }
    }
  },
});

/**
 * Get rate limit statistics (admin only)
 */
export const getRateLimitStats = internalQuery({
  handler: async (ctx) => {
    const totalEntries = await ctx.db.query("rateLimitEntries").collect();
    const blockedUsers = totalEntries.filter(entry => entry.blockedUntil && entry.blockedUntil > Date.now());

    // Group by action
    const byAction: Record<string, number> = {};
    for (const entry of totalEntries) {
      byAction[entry.action] = (byAction[entry.action] || 0) + 1;
    }

    return {
      totalEntries: totalEntries.length,
      blockedUsers: blockedUsers.length,
      actions: byAction,
    };
  },
});
