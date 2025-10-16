// Deployment Router - Routes deployments to correct tier
// Tier 1: Freemium (YOUR AWS)
// Tier 2: Personal (USER's AWS)
// Tier 3: Enterprise (ENTERPRISE AWS via SSO)

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

// Main deployment entry point - routes to correct tier
export const deployAgent = action({
  args: {
    agentId: v.id("agents"),
    testQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get user profile to determine tier
    const user = await ctx.runQuery(api.deploymentRouter.getUserTier);

    if (!user) {
      throw new Error("User profile not found");
    }

    // Route based on tier
    switch (user.tier) {
      case "freemium":
        return await deployTier1(ctx, args, userId);

      case "personal":
        return await deployTier2(ctx, args, userId);

      case "enterprise":
        return await deployTier3(ctx, args, userId);

      default:
        throw new Error(`Unknown tier: ${user.tier}`);
    }
  },
});

// Get user tier
export const getUserTier = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    return user || null;
  },
});

// Tier 1: Deploy to YOUR Fargate (Freemium)
async function deployTier1(ctx: any, args: any, userId: string) {
  // Check usage limits
  const user = await ctx.runQuery(api.deploymentRouter.getUserTier);

  if (!user) throw new Error("User not found");

  const testsThisMonth = user.testsThisMonth || 0;
  const limit = 10; // Free tier limit

  if (testsThisMonth >= limit) {
    return {
      success: false,
      error: "Free tier limit reached",
      message: `You've used ${testsThisMonth}/${limit} free tests this month. Upgrade to deploy to your own AWS account!`,
      upgradeUrl: "/settings/aws",
    };
  }

  // Deploy to YOUR Fargate
  try {
    const result = await ctx.runAction(api.tier1Deployment.deployToYourFargate, {
      agentId: args.agentId,
      testQuery: args.testQuery,
    });

    // Increment usage counter
    await ctx.runMutation(api.deploymentRouter.incrementUsage, {
      userId,
    });

    return {
      success: true,
      tier: "freemium",
      result,
      message: "Agent deployed to platform infrastructure",
      upgradePrompt: `You have ${limit - testsThisMonth - 1} free tests remaining. Upgrade to deploy to your own AWS account!`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      tier: "freemium",
    };
  }
}

// Tier 2: Deploy to USER's Fargate (Personal AWS Account)
async function deployTier2(ctx: any, args: any, userId: string) {
  try {
    const result = await ctx.runAction(
      api.awsCrossAccount.deployToUserAccount,
      {
        agentId: args.agentId,
      }
    );

    return {
      success: true,
      tier: "personal",
      result,
      message: "Agent deployed to your AWS account",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      tier: "personal",
      message:
        "Failed to deploy to your AWS account. Check your connection settings.",
    };
  }
}

// Tier 3: Deploy to ENTERPRISE AWS (via SSO)
async function deployTier3(ctx: any, args: any, userId: string) {
  try {
    // TODO: Implement enterprise SSO deployment
    // This would use AWS SSO credentials instead of AssumeRole

    return {
      success: false,
      error: "Enterprise tier not yet implemented",
      tier: "enterprise",
      message: "Enterprise SSO deployment coming soon!",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      tier: "enterprise",
    };
  }
}

// Increment usage counter for freemium users
export const incrementUsage = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();

    if (!user) return;

    await ctx.db.patch(user._id, {
      testsThisMonth: (user.testsThisMonth || 0) + 1,
    });
  },
});

// Reset monthly usage (call this from a cron job)
export const resetMonthlyUsage = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_tier", (q) => q.eq("tier", "freemium"))
      .collect();

    for (const user of users) {
      await ctx.db.patch(user._id, {
        testsThisMonth: 0,
      });
    }

    return { reset: users.length };
  },
});

// Get deployment history
export const getDeploymentHistory = query({
  args: {
    agentId: v.optional(v.id("agents")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    let query = ctx.db
      .query("deployments")
      .withIndex("by_user", (q) => q.eq("userId", userId as any));

    if (args.agentId) {
      query = ctx.db
        .query("deployments")
        .withIndex("by_agent", (q) => q.eq("agentId", args.agentId!));
    }

    const deployments = await query
      .order("desc")
      .take(args.limit || 20);

    return deployments;
  },
});
