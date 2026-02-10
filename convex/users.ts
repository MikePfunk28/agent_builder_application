/**
 * User Management API
 */

import { query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Create user role types
 */
export enum UserRole {
  ADMIN = "admin",
  USER = "user",
  PAID = "paid",
  GUEST = "guest",
}
/**
 * Internal query to get user by ID (no auth required)
 * Used by system actions like test execution
 */
export const getInternal = internalQuery( {
  args: {
    id: v.id( "users" ),
  },
  handler: async ( ctx, args ) => {
    return await ctx.db.get( args.id );
  },
} );

/**
 * Get current user profile
 */
export const getCurrentUser = query( {
  args: {},
  handler: async ( ctx ) => {
    const userId = await getAuthUserId( ctx );
    if ( !userId ) {
      return null;
    }

    // Get user by auth-resolved Convex document ID
    const user = await ctx.db.get( userId );
    return user;
  },
} );
