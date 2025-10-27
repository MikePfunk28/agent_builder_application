/**
 * User Management API
 */

import { query, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Internal query to get user by ID (no auth required)
 * Used by system actions like test execution
 */
export const getInternal = internalQuery({
  args: {
    id: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Get current user profile
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // Get user by Convex user ID
    const user = await ctx.db.get(identity.subject as any);
    return user;
  },
});
