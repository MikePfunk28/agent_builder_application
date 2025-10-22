/**
 * API Key Management and Usage Tracking
 * Implements 10 tests/month limit for freemium users
 */

import { mutation, query, action, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";

/**
 * Generate API key for user
 */
export const generateAPIKey = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Generate secure API key
    const apiKey = `ab_${generateSecureToken(32)}`;

    const keyId = await ctx.db.insert("apiKeys", {
      userId,
      name: args.name,
      description: args.description,
      keyHash: await hashAPIKey(apiKey), // Store hash, not plain key
      keyPrefix: apiKey.substring(0, 8), // For display purposes
      isActive: true,
      testsUsed: 0,
      lastUsed: undefined,
      createdAt: Date.now(),
    });

    return {
      keyId,
      apiKey, // Only returned once during creation
      keyPrefix: apiKey.substring(0, 8),
    };
  },
});

/**
 * List user's API keys
 */
export const listAPIKeys = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Never return the actual key, only metadata
    return keys.map(key => ({
      _id: key._id,
      name: key.name,
      description: key.description,
      keyPrefix: key.keyPrefix,
      isActive: key.isActive,
      testsUsed: key.testsUsed,
      lastUsed: key.lastUsed,
      createdAt: key.createdAt,
    }));
  },
});

/**
 * Revoke API key
 */
export const revokeAPIKey = mutation({
  args: {
    keyId: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const key = await ctx.db.get(args.keyId);
    if (!key || key.userId !== userId) {
      throw new Error("API key not found or not authorized");
    }

    await ctx.db.patch(args.keyId, {
      isActive: false,
      revokedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Validate API key and check usage limits
 */
export const validateAPIKeyAndUsage: any = action({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    // Hash the provided key to compare with stored hash
    const keyHash = await hashAPIKey(args.apiKey);

    // Find API key by hash
    const key = await ctx.runQuery(api.apiKeys.findByHash, { keyHash });
    
    if (!key || !key.isActive) {
      return {
        valid: false,
        error: "Invalid or revoked API key",
      };
    }

    // Get user to check tier and limits
    const user = await ctx.runQuery(internal.apiKeys.getUserInternal, { userId: key.userId });
    const tier = user?.tier || "freemium";

    // Check usage limits based on tier
    const limits = getTierLimits(tier);
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Get usage for current month
    const monthlyUsage = await ctx.runQuery(api.apiKeys.getMonthlyUsage, {
      userId: key.userId,
      month: currentMonth,
      year: currentYear,
    });

    if (monthlyUsage >= limits.testsPerMonth) {
      return {
        valid: false,
        error: `Monthly limit exceeded (${monthlyUsage}/${limits.testsPerMonth} tests used). Upgrade your plan for more tests.`,
        usage: {
          used: monthlyUsage,
          limit: limits.testsPerMonth,
          tier,
        },
      };
    }

    return {
      valid: true,
      userId: key.userId,
      keyId: key._id,
      usage: {
        used: monthlyUsage,
        limit: limits.testsPerMonth,
        tier,
      },
    };
  },
});

/**
 * Find API key by hash (internal)
 */
export const findByHash = query({
  args: {
    keyHash: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("apiKeys")
      .withIndex("by_hash", (q) => q.eq("keyHash", args.keyHash))
      .first();
  },
});

/**
 * Get monthly usage for user
 */
export const getMonthlyUsage = query({
  args: {
    userId: v.id("users"),
    month: v.number(),
    year: v.number(),
  },
  handler: async (ctx, args) => {
    const startOfMonth = new Date(args.year, args.month, 1).getTime();
    const endOfMonth = new Date(args.year, args.month + 1, 0, 23, 59, 59).getTime();

    const tests = await ctx.db
      .query("testExecutions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => 
        q.and(
          q.gte(q.field("submittedAt"), startOfMonth),
          q.lte(q.field("submittedAt"), endOfMonth)
        )
      )
      .collect();

    return tests.length;
  },
});

/**
 * Internal helper to load user document by id
 */
export const getUserInternal = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * Increment API key usage
 */
export const incrementUsage = mutation({
  args: {
    keyId: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.keyId);
    if (!key) {
      throw new Error("API key not found");
    }

    await ctx.db.patch(args.keyId, {
      testsUsed: key.testsUsed + 1,
      lastUsed: Date.now(),
    });
  },
});

/**
 * Get tier limits
 */
function getTierLimits(tier: string) {
  switch (tier) {
    case "freemium":
      return {
        testsPerMonth: 10,
        maxConcurrentTests: 1,
        maxAgents: 5,
      };
    case "personal":
      return {
        testsPerMonth: 1000,
        maxConcurrentTests: 5,
        maxAgents: 50,
      };
    case "enterprise":
      return {
        testsPerMonth: 10000,
        maxConcurrentTests: 20,
        maxAgents: 500,
      };
    default:
      return {
        testsPerMonth: 10,
        maxConcurrentTests: 1,
        maxAgents: 5,
      };
  }
}

/**
 * Generate secure random token
 */
function generateSecureToken(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Hash API key for secure storage
 */
async function hashAPIKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const secret = process.env.JWT_PRIVATE_KEY || 'default-secret';
  const data = encoder.encode(apiKey + secret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
