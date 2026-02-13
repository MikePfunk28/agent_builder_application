// Deployment Router - Routes deployments to correct tier
// Tier 1: Freemium (YOUR AWS)
// Tier 2: Personal (USER's AWS)
// Tier 3: Enterprise (ENTERPRISE AWS via SSO)

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// stripeMutations is generated in internal API — use directly, no cast needed.
// Direct import for mutation handlers (mutations cannot call ctx.runMutation)
import { incrementUsageAndReportOverageImpl } from "./stripeMutations";

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

    // userId from getAuthUserId() is already the Convex user document ID
    const user = await ctx.db.get(userId);

    return user || null;
  },
});

// Tier 1: Deploy to AgentCore (Freemium)
async function deployTier1(ctx: any, args: any, userId: Id<"users">): Promise<any> {
  // Check usage limits
  const user = await ctx.runQuery(api.deploymentRouter.getUserTier);

  if (!user) throw new Error("User not found");

  const executionsThisMonth: number = user.executionsThisMonth || 0;
  // Use centralized tier config for limit
  const { getTierConfig } = await import("./lib/tierConfig");
  const freeTierConfig = getTierConfig("freemium");
  const limit = freeTierConfig.monthlyExecutions;

  if (executionsThisMonth >= limit) {
    return {
      success: false,
      error: "Free tier limit reached",
      message: `You've used ${executionsThisMonth}/${limit} free tests this month. Upgrade to Personal ($5/month) to deploy to your own AWS account!`,
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

    // Validate model for AgentCore (Bedrock only)
    if (!agent.model?.includes(".")) {
      return {
        success: false,
        error: "Invalid model format",
        message: "AgentCore requires AWS Bedrock models (e.g., anthropic.claude-sonnet-4-5). Upgrade to Personal tier for Ollama support.",
        upgradeUrl: "/settings/aws",
      };
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

    // Increment usage counter (non-fatal: don't block deployment)
    try {
      await ctx.runMutation( internal.stripeMutations.incrementUsageAndReportOverage, {
        userId,
        modelId: agent.model,
      } );
    } catch ( billingErr ) {
      console.error( "deploymentRouter.deployTier1: billing failed (non-fatal)", {
        userId, modelId: agent.model,
        error: billingErr instanceof Error ? billingErr.message : billingErr,
      } );
    }

    return {
      success: true,
      tier: "freemium",
      result,
      message: "Agent deployed to AgentCore sandbox",
      upgradePrompt: `You have ${limit - executionsThisMonth - 1} free tests remaining. Upgrade to deploy to your own AWS account!`,
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
// No per-deployment billing — user pays AWS directly for their own runtime.
// We only charge the $5/month subscription for platform access.
async function deployTier2(ctx: any, args: any, _userId: Id<"users">): Promise<any> {
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

// Increment usage counter and report overage — delegates to shared helper
// in stripeMutations.ts (single source of truth for usage + overage logic).
export const incrementUsage = mutation({
  args: {
    userId: v.id("users"),
    modelId: v.optional( v.string() ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if ( !identity ) {
      throw new Error( "Not authenticated" );
    }
    await incrementUsageAndReportOverageImpl( ctx, args.userId, {
      modelId: args.modelId,
    } );
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
        executionsThisMonth: 0,
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
      .withIndex("by_user", (q) => q.eq("userId", userId));

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
