/**
 * AWS Deployment Setup
 * Minimal setup for deploying agents to AWS (Tier 2/3)
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Deploy agent to AWS (Tier 2 - User's AWS Account)
 */
export const deployToUserAWS = action({
  args: {
    agentId: v.id("agents"),
    region: v.string(),
    agentName: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; deploymentId?: any; message?: string; error?: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    try {
      // Get agent
      const agent: any = await ctx.runQuery(api.agents.get, { id: args.agentId });
      if (!agent) {
        throw new Error("Agent not found");
      }

      // Check ownership
      if (agent.createdBy !== userId) {
        throw new Error("Not authorized to deploy this agent");
      }

      // Create deployment record
      const deploymentId: any = await ctx.runMutation(internal.awsDeployment.createDeploymentInternal, {
        agentId: args.agentId,
        userId,
        tier: "personal",
        deploymentConfig: {
          region: args.region,
          agentName: args.agentName,
          description: agent.description,
          enableMonitoring: true,
          enableAutoScaling: false,
        },
      });

      // Start deployment process
      await ctx.scheduler.runAfter(0, internal.awsDeployment.executeWebIdentityDeploymentInternal, {
        deploymentId,
        agentId: args.agentId,
        userId,
        roleArn: process.env.AWS_CROSS_ACCOUNT_ROLE_ARN || "",
        region: args.region,
      });

      return {
        success: true,
        deploymentId,
        message: "Deployment started. Check deployment status for progress.",
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to start AWS deployment",
      };
    }
  },
});

/**
 * Get deployment status
 */
export const getDeploymentStatus = action({
  args: {
    deploymentId: v.id("deployments"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; deployment?: any; error?: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    try {
      const deployment: any = await ctx.runQuery(api.awsDeployment.getDeploymentWithLogs, {
        deploymentId: args.deploymentId,
      });

      if (!deployment) {
        return {
          success: false,
          error: "Deployment not found or not authorized",
        };
      }

      return {
        success: true,
        deployment,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to get deployment status",
      };
    }
  },
});

/**
 * List user deployments
 */
export const listDeployments = action({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; deployments?: any[]; error?: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    try {
      const deployments: any = await ctx.runQuery(api.awsDeployment.listUserDeployments, {
        limit: args.limit || 10,
      });

      return {
        success: true,
        deployments,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to list deployments",
      };
    }
  },
});

/**
 * Cancel deployment
 */
export const cancelDeployment = action({
  args: {
    deploymentId: v.id("deployments"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message?: string; error?: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    try {
      const result: any = await ctx.runMutation(api.awsDeployment.cancelDeployment, {
        deploymentId: args.deploymentId,
      });

      return {
        success: true,
        message: "Deployment cancelled successfully",
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to cancel deployment",
      };
    }
  },
});