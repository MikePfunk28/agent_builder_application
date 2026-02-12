/**
 * Unified User Identity System
 *
 * Handles both authenticated and anonymous users with a single identity.
 * Prevents multiple accounts for the same user across different auth methods.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Get or create unified user identity
 * Returns same userId for:
 * - Logged in users (by auth)
 * - Anonymous users (by browser fingerprint/device ID)
 * - Prevents duplicate accounts
 */
export const getUnifiedUserId = mutation({
  args: {
    deviceId: v.optional(v.string()), // Browser fingerprint for anonymous
    email: v.optional(v.string()), // If signing in, check for existing accounts
  },
  handler: async (ctx, args) => {
    // Try to get authenticated user
    const authUserId = await getAuthUserId(ctx);

    if (authUserId) {
      // User is logged in - use their auth ID
      const user = await ctx.db.get(authUserId);

      // If they were previously anonymous with this device, merge accounts
      // Security: Only merge if the authenticated user's record already has this deviceId
      // to prevent account takeover via arbitrary deviceId submission
      if (args.deviceId && user && user.deviceId === args.deviceId) {
        const anonymousUser = await ctx.db
          .query("users")
          .withIndex("by_device_id", (q) => q.eq("deviceId", args.deviceId))
          .first();

        if (anonymousUser && anonymousUser._id !== authUserId) {
          // Merge anonymous data into authenticated account
          await mergeAnonymousUser(ctx, anonymousUser._id, authUserId);
        }
      }

      return {
        userId: authUserId,
        isAnonymous: false,
        isNewUser: !user,
      };
    }

    // User is anonymous - find or create by device ID
    if (args.deviceId) {
      const existingAnonymous = await ctx.db
        .query("users")
        .withIndex("by_device_id", (q) => q.eq("deviceId", args.deviceId))
        .first();

      if (existingAnonymous) {
        return {
          userId: existingAnonymous._id,
          isAnonymous: true,
          isNewUser: false,
        };
      }

      // Create new anonymous user
      const anonymousUserId = await ctx.db.insert("users", {
        deviceId: args.deviceId,
        isAnonymous: true,
        tier: "freemium",
        executionsThisMonth: 0,
        createdAt: Date.now(),
      });

      return {
        userId: anonymousUserId,
        isAnonymous: true,
        isNewUser: true,
      };
    }

    throw new Error("Must provide either authentication or deviceId");
  },
});

/**
 * Merge anonymous user data into authenticated account
 */
async function mergeAnonymousUser(ctx: any, anonymousId: any, authenticatedId: any) {
  // Transfer agents
  const agents = await ctx.db
    .query("agents")
    .withIndex("by_user", (q: any) => q.eq("createdBy", anonymousId))
    .collect();

  for (const agent of agents) {
    await ctx.db.patch(agent._id, { createdBy: authenticatedId });
  }

  // Transfer workflows
  const workflows = await ctx.db
    .query("workflows")
    .withIndex("by_user", (q: any) => q.eq("userId", anonymousId))
    .collect();

  for (const workflow of workflows) {
    await ctx.db.patch(workflow._id, { userId: authenticatedId });
  }

  // Transfer conversations
  const conversations = await ctx.db
    .query("interleavedConversations")
    .withIndex("by_user", (q: any) => q.eq("userId", anonymousId))
    .collect();

  for (const conv of conversations) {
    await ctx.db.patch(conv._id, { userId: authenticatedId });
  }

  // Mark anonymous user as merged (don't delete, keep for audit)
  await ctx.db.patch(anonymousId, {
    mergedInto: authenticatedId,
    mergedAt: Date.now(),
  });
}

/**
 * Check if user has access to a specific agent
 * (for unified access control across all builders)
 */
export const canAccessAgent = query({
  args: {
    agentId: v.id("agents"),
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUserId = await getAuthUserId(ctx);

    // Get user identity
    let userId = authUserId;
    if (!userId && args.deviceId) {
      const anonymousUser = await ctx.db
        .query("users")
        .withIndex("by_device_id", (q: any) => q.eq("deviceId", args.deviceId))
        .first();
      userId = anonymousUser?._id || null;
    }

    if (!userId) {
      return { canAccess: false, reason: "No user identity" };
    }

    // Get agent
    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      return { canAccess: false, reason: "Agent not found" };
    }

    // Check ownership
    if (agent.createdBy === userId) {
      return { canAccess: true, reason: "Owner" };
    }

    // Check if public
    if (agent.isPublic) {
      return { canAccess: true, reason: "Public" };
    }

    return { canAccess: false, reason: "Not authorized" };
  },
});
