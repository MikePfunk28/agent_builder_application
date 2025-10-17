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

// Tier 1: Deploy to AgentCore (Freemium)
async function deployTier1(ctx: any, args: any, userId: string): Promise<any> {
  // Check usage limits
  const user = await ctx.runQuery(api.deploymentRouter.getUserTier);

  if (!user) throw new Error("User not found");

  const testsThisMonth: number = user.testsThisMonth || 0;
  const limit = 10; // Free tier limit

  if (testsThisMonth >= limit) {
    return {
      success: false,
      error: "Free tier limit reached",
      message: `You've used ${testsThisMonth}/${limit} free tests this month. Upgrade to deploy to your own AWS account!`,
      upgradeUrl: "/settings/aws",
    };
  }

  // Deploy to AgentCore sandbox
  try {
    // Get agent details
    const agent = await ctx.runQuery(api.agents.get, { id: args.agentId });
    if (!agent) {
      throw new Error("Agent not found");
    }

    // Extract dependencies from agent tools
    const dependencies: string[] = [];
    for (const tool of agent.tools || []) {
      if (tool.requiresPip && tool.pipPackages) {
        dependencies.push(...tool.pipPackages);
      }
    }

    // Build environment variables
    const environmentVariables: Record<string, string> = {
      AGENT_NAME: agent.name,
      AGENT_MODEL: agent.model,
    };

    // Deploy to AgentCore
    const result: any = await ctx.runAction(api.agentcoreDeployment.deployToAgentCore, {
      agentId: args.agentId,
      code: agent.generatedCode,
      dependencies,
      environmentVariables,
    });

    if (!result.success) {
      throw new Error(result.error || "AgentCore deployment failed");
    }

    // Increment usage counter
    await ctx.runMutation(api.deploymentRouter.incrementUsage, {
      userId,
    });

    return {
      success: true,
      tier: "freemium",
      result,
      message: "Agent deployed to AgentCore sandbox",
      upgradePrompt: `You have ${limit - testsThisMonth - 1} free tests remaining. Upgrade to deploy to your own AWS account!`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
      tier: "freemium",
    };
  }
}

// Tier 2: Deploy to USER's Fargate (Personal AWS Account)
async function deployTier2(ctx: any, args: any, _userId: string): Promise<any> {
  try {
    const result: any = await ctx.runAction(
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
      tier: "personal",
      message:
        "Failed to deploy to your AWS account. Check your connection settings.",
    };
  }
}

// Tier 3: Deploy to ENTERPRISE AWS (via SSO)
async function deployTier3(_ctx: any, _args: any, _userId: string): Promise<any> {
  try {
    // TODO: Implement enterprise SSO deployment
    // This would use AWS SSO credentials instead of AssumeRole

    return {
      success: false,
      error: "Enterprise tier not yet implemented",
      tier: "enterprise",
      message: "Enterprise SSO deployment coming soon!",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
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


// Monitor AgentCore sandbox health
export const monitorAgentCoreHealth = action({
  args: {
    deploymentId: v.id("deployments"),
  },
  handler: async (ctx, args): Promise<any> => {
    try {
      // Get deployment details
      const deployment = await ctx.runQuery(api.deployments.get, {
        id: args.deploymentId,
      });

      if (!deployment) {
        throw new Error("Deployment not found");
      }

      if (!deployment.agentCoreRuntimeId) {
        throw new Error("Not an AgentCore deployment");
      }

      // Check sandbox health
      const healthResult = await ctx.runAction(
        api.agentcoreDeployment.getAgentCoreSandboxHealth,
        {
          sandboxId: deployment.agentCoreRuntimeId,
        }
      );

      // Update deployment health status
      if (healthResult.success) {
        await ctx.runMutation(api.deploymentRouter.updateHealthStatus, {
          deploymentId: args.deploymentId,
          healthStatus: healthResult.status,
          lastHealthCheck: Date.now(),
        });
      }

      return healthResult;
    } catch (error: any) {
      return {
        success: false,
        status: "error",
        error: error.message || String(error),
      };
    }
  },
});

// Update deployment health status
export const updateHealthStatus = mutation({
  args: {
    deploymentId: v.id("deployments"),
    healthStatus: v.string(),
    lastHealthCheck: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.deploymentId, {
      healthStatus: args.healthStatus,
      lastHealthCheck: args.lastHealthCheck,
    });
  },
});


// Delete deployment with AgentCore cleanup
export const deleteDeploymentWithCleanup = action({
  args: {
    deploymentId: v.id("deployments"),
  },
  handler: async (ctx, args): Promise<any> => {
    try {
      // Delete deployment record and get metadata
      const deleteResult = await ctx.runMutation(api.deployments.deleteDeployment, {
        deploymentId: args.deploymentId,
      });

      // If it's an AgentCore deployment, clean up the sandbox
      if (deleteResult.tier === "freemium" && deleteResult.agentCoreRuntimeId) {
        const cleanupResult = await ctx.runAction(
          api.agentcoreDeployment.deleteAgentCoreSandbox,
          {
            sandboxId: deleteResult.agentCoreRuntimeId,
          }
        );

        // Log cleanup result but don't fail the deletion
        if (!cleanupResult.success) {
          console.warn(
            `AgentCore sandbox cleanup failed for ${deleteResult.agentCoreRuntimeId}:`,
            cleanupResult.error
          );
        }

        return {
          success: true,
          message: "Deployment deleted",
          cleanupResult,
        };
      }

      return {
        success: true,
        message: "Deployment deleted",
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || String(error),
        message: "Failed to delete deployment",
      };
    }
  },
});
