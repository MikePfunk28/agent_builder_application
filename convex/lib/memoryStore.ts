/**
 * Internal mutations/queries for the toolMemory table.
 *
 * Used by the memory tool actions (shortTermMemory, longTermMemory, semanticMemory)
 * in convex/tools.ts to persist data in the Convex database instead of returning
 * mock/placeholder values.
 */

import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";

/** Store (upsert) a memory entry. */
export const store = internalMutation({
  args: {
    userId: v.string(),
    memoryType: v.string(),
    key: v.string(),
    value: v.string(),
    metadata: v.optional(v.string()),
    ttl: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check for existing entry to upsert
    const existing = await ctx.db
      .query("toolMemory")
      .withIndex("by_key", (q) =>
        q.eq("userId", args.userId).eq("memoryType", args.memoryType).eq("key", args.key)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        metadata: args.metadata,
        ttl: args.ttl,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("toolMemory", {
      userId: args.userId,
      memoryType: args.memoryType,
      key: args.key,
      value: args.value,
      metadata: args.metadata,
      ttl: args.ttl,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Retrieve a single memory entry by key. */
export const retrieve = internalQuery({
  args: {
    userId: v.string(),
    memoryType: v.string(),
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("toolMemory")
      .withIndex("by_key", (q) =>
        q.eq("userId", args.userId).eq("memoryType", args.memoryType).eq("key", args.key)
      )
      .first();

    if (!entry) return null;

    // Check TTL expiration
    if (entry.ttl && Date.now() - entry.updatedAt > entry.ttl * 1000) {
      return null; // Expired
    }

    return entry;
  },
});

/** Search memory entries by type (returns most recent entries). */
export const search = internalQuery({
  args: {
    userId: v.string(),
    memoryType: v.string(),
    maxItems: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.maxItems || 20;

    const entries = await ctx.db
      .query("toolMemory")
      .withIndex("by_type", (q) =>
        q.eq("userId", args.userId).eq("memoryType", args.memoryType)
      )
      .order("desc")
      .take(limit);

    // Filter expired entries
    const now = Date.now();
    return entries.filter(
      (entry) => !entry.ttl || now - entry.updatedAt <= entry.ttl * 1000
    );
  },
});

/** Delete a memory entry by key. */
export const remove = internalMutation({
  args: {
    userId: v.string(),
    memoryType: v.string(),
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("toolMemory")
      .withIndex("by_key", (q) =>
        q.eq("userId", args.userId).eq("memoryType", args.memoryType).eq("key", args.key)
      )
      .first();

    if (entry) {
      await ctx.db.delete(entry._id);
      return true;
    }
    return false;
  },
});
