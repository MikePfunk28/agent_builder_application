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

    // Deploy to user's Fargate using their credentials
    const deployment = await deployToFargate({
      credentials,
      region: awsAccount.region!,
      agent,
      accountType: "user",
    });

    // Log deployment
    await ctx.runMutation(api.deployments.create, {
      agentId: args.agentId,
      tier: "personal",
      awsAccountId: awsAccount.awsAccountId,
      region: awsAccount.region!,
      taskArn: deployment.taskArn,
      status: "running",
    });

    return {
      success: true,
      taskArn: deployment.taskArn,
      logStreamUrl: deployment.logStreamUrl,
      message: "Agent deployed to your AWS account!",
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

// Helper: Deploy to Fargate (works for both YOUR account and USER account)
async function deployToFargate(params: {
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
  };
  region: string;
  agent: any;
  accountType: "platform" | "user";
}) {
  const { credentials, region, agent, accountType } = params;

  // Call AWS HTTP action to run ECS task
  const response = await fetch(
    `${process.env.CONVEX_SITE_URL}/aws/runTask`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AWS_API_SECRET}`,
      },
      body: JSON.stringify({
        credentials,
        region,
        cluster:
          accountType === "platform"
            ? process.env.ECS_CLUSTER_NAME
            : "agent-builder-cluster",
        taskDefinition:
          accountType === "platform"
            ? process.env.ECS_TASK_FAMILY
            : "agent-builder-agent-tester",
        subnets: [
          accountType === "platform"
            ? process.env.ECS_SUBNET_ID
            : "subnet-user",
        ],
        securityGroups: [
          accountType === "platform"
            ? process.env.ECS_SECURITY_GROUP_ID
            : "sg-user",
        ],
        containerOverrides: {
          name: "agent-tester",
          environment: [
            { name: "AGENT_ID", value: agent._id },
            { name: "AGENT_NAME", value: agent.name },
            { name: "AGENT_CODE", value: agent.code },
          ],
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to run task: ${response.statusText}`);
  }

  const result = await response.json();

  return {
    taskArn: result.taskArn,
    logStreamUrl: `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#logsV2:log-groups/log-group/${encodeURIComponent(
      "/ecs/agent-builder-agent-tester"
    )}`,
  };
}
