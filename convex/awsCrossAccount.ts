// AWS Cross-Account Deployment Logic (Tier 2)
// Handles STS AssumeRole and deployment to user's AWS account

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

// Assume role in user's AWS account and get temporary credentials
export const assumeUserRole = action({
  args: {
    roleArn: v.string(),
    externalId: v.string(),
    sessionName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sessionName =
      args.sessionName || `agent-deployment-${Date.now()}`;

    try {
      // Call AWS STS AssumeRole
      const response = await fetch(
        `${process.env.CONVEX_SITE_URL}/aws/assumeRole`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.AWS_API_SECRET}`,
          },
          body: JSON.stringify({
            roleArn: args.roleArn,
            externalId: args.externalId,
            sessionName,
            durationSeconds: 3600, // 1 hour
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to assume role: ${response.statusText}`);
      }

      const credentials = await response.json();

      return {
        accessKeyId: credentials.AccessKeyId,
        secretAccessKey: credentials.SecretAccessKey,
        sessionToken: credentials.SessionToken,
        expiration: credentials.Expiration,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("AssumeRole failed:", error);
      throw new Error(
        `Cannot assume role in user's AWS account: ${errorMessage}`
      );
    }
  },
});

// Deploy agent to user's AWS account (Tier 2)
export const deployToUserAccount = action({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    // Get user's AWS account info
    const awsAccount = await ctx.runQuery(
      api.userAWSAccounts.getUserAWSAccount
    );

    if (!awsAccount) {
      throw new Error(
        "No AWS account connected. Please connect your AWS account first."
      );
    }

    // Assume role in user's account
    const credentials = await ctx.runAction(api.awsCrossAccount.assumeUserRole, {
      roleArn: awsAccount.roleArn!,
      externalId: awsAccount.externalId,
      sessionName: `agent-${args.agentId}-${Date.now()}`,
    });

    // Get agent details
    const agent = await ctx.runQuery(api.agents.get, { id: args.agentId });
    if (!agent) throw new Error("Agent not found");

    // Deploy to user's AgentCore using their credentials
    // Extract dependencies from agent tools
    const dependencies: string[] = [];
    for (const tool of agent.tools || []) {
      if (tool.requiresPip && tool.pipPackages) {
        dependencies.push(...tool.pipPackages);
      }
    }

    const environmentVariables: Record<string, string> = {
      AGENT_NAME: agent.name,
      AGENT_MODEL: agent.model,
    };

    const deployment: any = await ctx.runAction(api.agentcoreDeployment.deployToAgentCore, {
      agentId: args.agentId,
      code: agent.generatedCode,
      dependencies,
      environmentVariables,
    });

    if (!deployment.success) {
      throw new Error(deployment.error || "AgentCore deployment failed");
    }

    // Log deployment
    await ctx.runMutation(api.deployments.create, {
      agentId: args.agentId,
      tier: "personal",
      awsAccountId: awsAccount.awsAccountId,
      region: awsAccount.region!,
      taskArn: deployment.runtimeId || "agentcore",
      status: "running",
    });

    return {
      success: true,
      runtimeId: deployment.runtimeId,
      message: "Agent deployed to your AWS account via Bedrock AgentCore!",
    };
  },
});

// Validate cross-account role (called during connection)
export const validateRole = action({
  args: {
    roleArn: v.string(),
    externalId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Try to assume the role
      const credentials = await ctx.runAction(
        api.awsCrossAccount.assumeUserRole,
        {
          roleArn: args.roleArn,
          externalId: args.externalId,
          sessionName: "validation-test",
        }
      );

      // If we got credentials, the role is valid
      return { valid: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Role validation failed:", error);
      return {
        valid: false,
        error: errorMessage,
      };
    }
  },
});

// Fargate helper removed — all cross-account deployments now go through Bedrock AgentCore.
// See agentcoreDeployment.ts for the AgentCore deployment path.
