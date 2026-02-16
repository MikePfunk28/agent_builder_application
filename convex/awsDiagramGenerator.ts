import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * AWS Architecture Diagram Generator
 * 
 * This module generates AWS architecture diagrams for deployments
 * using the AWS Diagram MCP server.
 */

interface AWSResource {
  type: string;
  name: string;
  id?: string;
  properties?: Record<string, any>;
}

/**
 * Generate an architecture diagram for a deployment
 * 
 * This action:
 * 1. Fetches deployment configuration from database
 * 2. Builds AWS resource list based on deployment tier
 * 3. Invokes AWS Diagram MCP server with resource list
 * 4. Stores generated diagram in database
 */
export const generateArchitectureDiagram = action({
  args: {
    deploymentId: v.id("deployments"),
    format: v.optional(v.string()), // "svg" | "png" | "mermaid"
  },
  handler: async (ctx, args): Promise<{ success: boolean; diagramId?: any; format?: string; resourceCount?: number; error?: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    try {
      // 1. Fetch deployment configuration
      const deployment: any = await ctx.runQuery(api.deployments.get, {
        id: args.deploymentId,
      });

      if (!deployment) {
        throw new Error(`Deployment ${args.deploymentId} not found`);
      }

      // Verify user owns this deployment
      if (deployment.userId !== userId) {
        throw new Error("Not authorized to generate diagram for this deployment");
      }

      // 2. Build AWS resource list based on deployment tier
      const resources = buildResourceList(deployment);

      // 3. Invoke AWS Diagram MCP server
      const format = args.format || "svg";
      let diagramResult;
      
      try {
        diagramResult = await ctx.runAction(api.mcpClient.invokeMCPTool, {
          serverName: "aws-diagram",
          toolName: "generate_architecture_diagram",
          parameters: {
            resources,
            format,
            title: `${deployment.agentName || 'Agent'} Architecture`,
            region: deployment.region,
          },
        });
      } catch (mcpError: any) {
        // Handle MCP connection errors
        throw new Error(
          `MCP server connection failed: ${mcpError.message || 'Unable to connect to AWS Diagram MCP server'}. ` +
          `Please ensure the server is configured and running in your MCP settings.`
        );
      }

      if (!diagramResult.success) {
        // Provide detailed error message based on error type
        const errorMsg = diagramResult.error || 'Unknown error';
        
        if (errorMsg.includes('not found')) {
          throw new Error(
            `AWS Diagram MCP server not found. Please configure it in Settings > MCP Servers.`
          );
        } else if (errorMsg.includes('disabled')) {
          throw new Error(
            `AWS Diagram MCP server is disabled. Please enable it in Settings > MCP Servers.`
          );
        } else if (errorMsg.includes('timeout')) {
          throw new Error(
            `Diagram generation timed out. The deployment may have too many resources. Try again or contact support.`
          );
        } else if (errorMsg.includes('protocol')) {
          throw new Error(
            `MCP protocol error: ${errorMsg}. The AWS Diagram MCP server may need to be updated.`
          );
        } else {
          throw new Error(
            `Failed to generate diagram: ${errorMsg}`
          );
        }
      }

      // 4. Store diagram in database
      const diagramContent = (diagramResult as any).result?.diagram || (diagramResult as any).result || "";
      const diagramId: any = await ctx.runMutation(api.awsDiagramGenerator.storeDiagram, {
        deploymentId: args.deploymentId,
        format,
        content: diagramContent,
        resourceCount: resources.length,
      });

      return {
        success: true,
        diagramId,
        format,
        resourceCount: resources.length,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || String(error),
      };
    }
  },
});

/**
 * Build AWS resource list based on deployment configuration
 */
function buildResourceList(deployment: any): AWSResource[] {
  const resources: AWSResource[] = [];

  // Add region as context
  const region = deployment.region || "us-east-1";

  if (deployment.tier === "freemium") {
    // Freemium: AgentCore (Bedrock)
    resources.push({
      type: "bedrock-agentcore",
      name: deployment.agentName || "Agent",
      id: deployment.agentCoreRuntimeId,
      properties: {
        endpoint: deployment.agentCoreEndpoint,
        region,
      },
    });

    // Add Lambda if used for invocation
    if (deployment.agentCoreEndpoint) {
      resources.push({
        type: "lambda",
        name: `${deployment.agentName}-invoker`,
        properties: {
          runtime: "python3.11",
          region,
        },
      });
    }
  } else if (deployment.tier === "personal") {
    // Personal: AWS (Bedrock AgentCore in user's account)

    // AgentCore Runtime
    resources.push({
      type: "bedrock-agentcore",
      name: `${deployment.agentName}-runtime`,
      properties: {
        region,
      },
    });

    // Lambda (AgentCore entry point)
    resources.push({
      type: "lambda",
      name: `${deployment.agentName}-invoker`,
      properties: {
        runtime: "python3.11",
        region,
      },
    });

    // CloudWatch Logs
    resources.push({
      type: "cloudwatch-logs",
      name: `/agentcore/${deployment.agentName}`,
      properties: {
        retentionDays: deployment.logRetentionDays || 7,
        region,
      },
    });

    // S3 Bucket (if configured)
    if (deployment.s3BucketName) {
      resources.push({
        type: "s3",
        name: deployment.s3BucketName,
        properties: {
          region,
        },
      });
    }

    // CloudFormation Stack
    if (deployment.cloudFormationStackId) {
      resources.push({
        type: "cloudformation",
        name: deployment.cloudFormationStackId.split("/").pop() || "agent-stack",
        id: deployment.cloudFormationStackId,
        properties: {
          region,
        },
      });
    }

    // Add monitoring resources if enabled
    if (deployment.enableMonitoring) {
      resources.push({
        type: "cloudwatch-dashboard",
        name: `${deployment.agentName}-dashboard`,
        properties: {
          region,
        },
      });
    }

    // Add X-Ray if enabled
    if (deployment.enableXRay) {
      resources.push({
        type: "xray",
        name: `${deployment.agentName}-tracing`,
        properties: {
          region,
        },
      });
    }
  } else if (deployment.tier === "enterprise") {
    // Enterprise: includes everything from Personal tier plus SSO

    // Include all Personal tier resources
    const personalDeployment = { ...deployment, tier: "personal" };
    resources.push(...buildResourceList(personalDeployment));

    // Add SSO/Identity Center
    resources.push({
      type: "sso",
      name: "AWS SSO",
      properties: {
        organizationId: deployment.awsAccountId,
        region: "us-east-1", // SSO is global but managed in us-east-1
      },
    });

    // Add Organizations
    resources.push({
      type: "organizations",
      name: "AWS Organization",
      properties: {
        organizationId: deployment.awsAccountId,
      },
    });

    // Add additional security resources
    resources.push({
      type: "iam-role",
      name: `${deployment.agentName}-execution-role`,
      properties: {
        region,
      },
    });

    resources.push({
      type: "secrets-manager",
      name: `${deployment.agentName}-secrets`,
      properties: {
        region,
      },
    });
  }

  return resources;
}

/**
 * Store diagram in database
 */
export const storeDiagram = mutation({
  args: {
    deploymentId: v.id("deployments"),
    format: v.string(),
    content: v.string(),
    resourceCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if diagram already exists for this deployment and format
    const existing = await ctx.db
      .query("diagrams")
      .withIndex("by_deployment_and_format", (q) =>
        q.eq("deploymentId", args.deploymentId).eq("format", args.format)
      )
      .first();

    if (existing) {
      // Update existing diagram
      await ctx.db.patch(existing._id, {
        content: args.content,
        generatedAt: Date.now(),
        resourceCount: args.resourceCount,
      });
      return existing._id;
    } else {
      // Create new diagram
      return await ctx.db.insert("diagrams", {
        deploymentId: args.deploymentId,
        userId: userId,
        format: args.format,
        content: args.content,
        generatedAt: Date.now(),
        resourceCount: args.resourceCount,
        diagramType: "architecture",
      });
    }
  },
});

/**
 * Get diagram by deployment ID and format
 */
export const getDiagram = query({
  args: {
    deploymentId: v.id("deployments"),
    format: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const format = args.format || "svg";

    return await ctx.db
      .query("diagrams")
      .withIndex("by_deployment_and_format", (q) =>
        q.eq("deploymentId", args.deploymentId).eq("format", format)
      )
      .first();
  },
});

/**
 * List all diagrams for a deployment
 */
export const listDiagramsForDeployment = query({
  args: {
    deploymentId: v.id("deployments"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    return await ctx.db
      .query("diagrams")
      .withIndex("by_deployment", (q) => q.eq("deploymentId", args.deploymentId))
      .collect();
  },
});

/**
 * Delete diagram
 */
export const deleteDiagram = mutation({
  args: {
    diagramId: v.id("diagrams"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const diagram = await ctx.db.get(args.diagramId);
    if (!diagram) {
      throw new Error("Diagram not found");
    }

    if (diagram.userId !== userId) {
      throw new Error("Not authorized to delete this diagram");
    }

    await ctx.db.delete(args.diagramId);
  },
});
