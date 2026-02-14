/**
 * Bedrock AgentCore Deployment Module
 * 
 * This module handles deployment and management of agents in AWS Bedrock AgentCore sandboxes.
 * AgentCore provides serverless agent execution environments for Tier 1 (Freemium) deployments.
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

/**
 * Deploy an agent to AWS Bedrock AgentCore sandbox
 * 
 * This action creates a new AgentCore sandbox with the agent's code,
 * dependencies, and environment variables. The sandbox ID is stored
 * in the deployments table for future invocations.
 * 
 * Requirements: 3.1, 3.2, 3.3
 */
export const deployToAgentCore = action({
  args: {
    agentId: v.id("agents"),
    code: v.string(),
    dependencies: v.array(v.string()),
    environmentVariables: v.object({}),
  },
  handler: async (ctx, args): Promise<any> => {
    const startTime = Date.now();

    try {
      // Get authenticated user
      const userId = await ctx.runQuery(api.deploymentRouter.getUserTier);
      if (!userId) {
        await ctx.runMutation(api.errorLogging.logError, {
          category: "deployment",
          severity: "error",
          message: "AgentCore deployment attempted without authentication",
          details: {
            agentId: args.agentId,
          },
          metadata: {
            agentId: args.agentId,
          },
        });

        throw new Error("Not authenticated");
      }

      // Invoke Bedrock AgentCore MCP server to create sandbox
      const sandboxResult = await ctx.runAction(api.mcpClient.invokeMCPTool, {
        serverName: "bedrock-agentcore-mcp-server",
        toolName: "create_sandbox",
        parameters: {
          code: args.code,
          dependencies: args.dependencies,
          environment: args.environmentVariables,
          runtime: "python3.11", // Default runtime
        },
      });

      if (!sandboxResult.success) {
        await ctx.runMutation(api.errorLogging.logError, {
          category: "deployment",
          severity: "error",
          message: "Failed to create AgentCore sandbox",
          details: {
            agentId: args.agentId,
            error: sandboxResult.error,
            executionTime: Date.now() - startTime,
          },
          metadata: {
            agentId: args.agentId,
          },
        });

        throw new Error(
          `Failed to create AgentCore sandbox: ${sandboxResult.error}`
        );
      }

      const sandbox = (sandboxResult as any).result;
      if (!sandbox) {
        await ctx.runMutation(api.errorLogging.logError, {
          category: "deployment",
          severity: "error",
          message: "AgentCore sandbox creation returned no result",
          details: {
            agentId: args.agentId,
            sandboxResult,
          },
          metadata: {
            agentId: args.agentId,
          },
        });

        throw new Error("Failed to get sandbox from result");
      }

      // Store deployment record in database
      const deploymentId = await ctx.runMutation(api.deployments.create, {
        agentId: args.agentId,
        tier: "freemium",
        region: "us-east-1", // AgentCore default region
        status: "ACTIVE",
      });

      // Update deployment with AgentCore-specific metadata
      await updateAgentCoreMetadataInternal(
        ctx,
        deploymentId,
        sandbox.sandboxId || sandbox.id,
        sandbox.endpoint,
        sandbox.runtimeId
      );

      // Log successful deployment
      await ctx.runMutation(api.errorLogging.logAuditEvent, {
        eventType: "deployment_created",
        action: "deploy_agentcore",
        resource: "deployment",
        resourceId: deploymentId,
        success: true,
        details: {
          agentId: args.agentId,
          sandboxId: sandbox.sandboxId || sandbox.id,
          executionTime: Date.now() - startTime,
        },
        metadata: {
          agentId: args.agentId,
        },
      });

      return {
        success: true,
        deploymentId,
        sandboxId: sandbox.sandboxId || sandbox.id,
        endpoint: sandbox.endpoint,
        message: "Agent deployed to AgentCore sandbox successfully",
      };
    } catch (error: any) {
      // Log deployment failure
      await ctx.runMutation(api.errorLogging.logError, {
        category: "deployment",
        severity: "critical",
        message: "AgentCore deployment failed with exception",
        details: {
          agentId: args.agentId,
          error: error.message || String(error),
          executionTime: Date.now() - startTime,
        },
        stackTrace: error.stack,
        metadata: {
          agentId: args.agentId,
        },
      });

      return {
        success: false,
        error: error.message || String(error),
        message: "Failed to deploy agent to AgentCore",
      };
    }
  },
});

/**
 * Update deployment record with AgentCore-specific metadata
 * Internal helper - called from deployToAgentCore
 */
const updateAgentCoreMetadataInternal = async (
  ctx: any,
  deploymentId: string,
  sandboxId: string,
  endpoint?: string,
  runtimeId?: string
) => {
  await ctx.runMutation(api.deployments.updateAgentCoreMetadata, {
    deploymentId,
    agentCoreRuntimeId: runtimeId || sandboxId,
    agentCoreEndpoint: endpoint,
  });

  await ctx.runMutation(api.deployments.updateStatus, {
    deploymentId,
    status: "ACTIVE",
  });
};


/**
 * Invoke an agent in an AgentCore sandbox
 * 
 * This action sends input to an existing AgentCore sandbox and
 * returns the execution result. The sandbox must have been created
 * via deployToAgentCore.
 * 
 * Requirements: 3.4
 */
export const invokeAgentCoreSandbox = action({
  args: {
    sandboxId: v.string(),
    input: v.any(), // v.any(): accepts dynamic user-provided sandbox input (string, object, etc.)
  },
  handler: async (ctx, args): Promise<any> => {
    try {
      // Auth check — only authenticated users can invoke sandboxes
      const userProfile = await ctx.runQuery(api.deploymentRouter.getUserTier);
      if ( !userProfile ) {
        throw new Error( "Not authenticated — sign in to invoke agent sandboxes" );
      }

      // Invoke agent in AgentCore sandbox via MCP (pass userId for billing readiness)
      const invocationResult = await ctx.runAction(api.mcpClient.invokeMCPTool, {
        serverName: "bedrock-agentcore-mcp-server",
        toolName: "invoke_sandbox",
        userId: userProfile._id,
        parameters: {
          sandboxId: args.sandboxId,
          input: args.input,
        },
      });

      if (!invocationResult.success) {
        throw new Error(
          `Failed to invoke AgentCore sandbox: ${invocationResult.error}`
        );
      }

      return {
        success: true,
        result: (invocationResult as any).result,
        executionTime: (invocationResult as any).executionTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || String(error),
        message: "Failed to invoke agent in AgentCore sandbox",
      };
    }
  },
});

/**
 * Get AgentCore sandbox health status
 * 
 * This action checks the health of an AgentCore sandbox.
 * Used for monitoring deployment status.
 * 
 * Requirements: 3.5
 */
export const getAgentCoreSandboxHealth = action({
  args: {
    sandboxId: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    try {
      // Check sandbox health via MCP
      const healthResult = await ctx.runAction(api.mcpClient.invokeMCPTool, {
        serverName: "bedrock-agentcore-mcp-server",
        toolName: "get_sandbox_status",
        parameters: {
          sandboxId: args.sandboxId,
        },
      });

      if (!healthResult.success) {
        return {
          success: false,
          status: "error",
          error: healthResult.error,
        };
      }

      const result = (healthResult as any).result;
      return {
        success: true,
        status: result?.status || "unknown",
        details: result,
      };
    } catch (error: any) {
      return {
        success: false,
        status: "error",
        error: error.message || String(error),
      };
    }
  },
});

/**
 * Delete an AgentCore sandbox
 * 
 * This action cleans up an AgentCore sandbox when a deployment is deleted.
 * Handles cleanup errors gracefully to avoid blocking deployment deletion.
 * 
 * Requirements: 3.6
 */
export const deleteAgentCoreSandbox = action({
  args: {
    sandboxId: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    try {
      // Delete sandbox via MCP
      const deleteResult = await ctx.runAction(api.mcpClient.invokeMCPTool, {
        serverName: "bedrock-agentcore-mcp-server",
        toolName: "delete_sandbox",
        parameters: {
          sandboxId: args.sandboxId,
        },
      });

      if (!deleteResult.success) {
        // Log error but don't throw - we want to allow deployment deletion to proceed
        console.error(
          `Failed to delete AgentCore sandbox ${args.sandboxId}: ${deleteResult.error}`
        );
        return {
          success: false,
          error: deleteResult.error,
          message: "Sandbox deletion failed but deployment record will be removed",
        };
      }

      return {
        success: true,
        message: "AgentCore sandbox deleted successfully",
      };
    } catch (error: any) {
      // Log error but don't throw - graceful degradation
      console.error(
        `Exception deleting AgentCore sandbox ${args.sandboxId}:`,
        error
      );
      return {
        success: false,
        error: error.message || String(error),
        message: "Sandbox deletion failed but deployment record will be removed",
      };
    }
  },
});
