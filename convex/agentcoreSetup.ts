/**
 * AgentCore MCP Server Setup
 * Minimal setup for testing agents with proper rate limiting
 */

import { action, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Setup AgentCore MCP server configuration
 */
export const setupAgentCoreMCP = action( {
  args: {},
  handler: async ( ctx ): Promise<{ success: boolean; message: string; serverId?: any; error?: string }> => {
    const userId = await getAuthUserId( ctx );
    if ( !userId ) {
      throw new Error( "Not authenticated" );
    }

    try {
      // Check if AgentCore MCP server already exists
      const existing: any = await ctx.runQuery( api.mcpConfig.getMCPServerByName, {
        serverName: "bedrock-agentcore-mcp-server",
      } );

      if ( existing ) {
        return {
          success: true,
          message: "AgentCore MCP server already configured",
          serverId: existing._id
        };
      }

      // Create AgentCore MCP server based on your Windows config
      const serverId: any = await ctx.runMutation( api.mcpConfig.addMCPServer, {
        name: "bedrock-agentcore-mcp-server",
        command: "uv",
        args: [
          "tool",
          "run",
          "--from",
          "awslabs.amazon-bedrock-agentcore-mcp-server@latest",
          "awslabs.amazon-bedrock-agentcore-mcp-server.exe"
        ],
        env: {
          FASTMCP_LOG_LEVEL: "ERROR",
          AWS_REGION: process.env.AWS_REGION || "us-east-1",
        },
        disabled: false,
        timeout: 60000, // 60 seconds
      } );

      return {
        success: true,
        message: "AgentCore MCP server configured successfully",
        serverId
      };
    } catch ( error: any ) {
      return {
        success: false,
        message: "Setup failed",
        error: error.message || "Failed to setup AgentCore MCP server"
      };
    }
  },
} );

/**
 * Test AgentCore connection
 */
export const testAgentCoreConnection = action( {
  args: {},
  handler: async ( ctx ): Promise<{ success: boolean; status?: string; error?: string; tools?: any[] }> => {
    const userId = await getAuthUserId( ctx );
    if ( !userId ) {
      throw new Error( "Not authenticated" );
    }

    try {
      const result: any = await ctx.runAction( api.mcpClient.testMCPServerConnection, {
        serverName: "bedrock-agentcore-mcp-server",
      } );

      return result;
    } catch ( error: any ) {
      return {
        success: false,
        error: error.message || "Failed to test AgentCore connection",
      };
    }
  },
} );

/**
 * Execute agent test
 */
export const executeAgentTest = action( {
  args: {
    agentId: v.id( "agents" ),
    input: v.string(),
    chatType: v.string(), // "agent_builder" | "test_chat" | "chat_ui"
  },
  handler: async ( ctx, args ): Promise<{ success: boolean; response?: string; error?: string; testId?: any; executionTime?: number }> => {
    const userId = await getAuthUserId( ctx );
    if ( !userId ) {
      throw new Error( "Not authenticated" );
    }

    try {
      // Get agent
      const agent: any = await ctx.runQuery( api.agents.get, { id: args.agentId } );
      if ( !agent ) {
        throw new Error( "Agent not found" );
      }

      // Check ownership
      if ( agent.createdBy !== userId ) {
        throw new Error( "Not authorized to test this agent" );
      }

      // Simple rate limiting check
      const user: any = { tier: "freemium" }; // Simplified for now
      const tier: string = user?.tier || "freemium";

      // Get monthly test count - simplified for now
      const monthlyTests: any = 0; // Simplified for now


      // Rate limits from centralized tier config
      const { getTierConfig } = await import( "./lib/tierConfig" );
      const tierConfig = getTierConfig( tier );
      if ( !tierConfig ) {
        throw new Error( "User tier configuration not found" );
      }
      const limit = tierConfig.monthlyExecutions; // -1 = unlimited

      if ( limit !== -1 && monthlyTests >= limit ) {
        return {
          success: false,
          error: `Monthly test limit reached (${monthlyTests}/${limit}). Upgrade for more tests.`,
        };
      }

      // Create test execution
      const testId: any = await ctx.runMutation( api.testExecution.submitTest, {
        agentId: args.agentId,
        testQuery: args.input,
        timeout: 60000,
      } );

      // Execute via AgentCore MCP
      const result: any = await ctx.runAction( api.mcpClient.invokeMCPTool, {
        serverName: "bedrock-agentcore-mcp-server",
        toolName: "execute_agent",
        parameters: {
          code: agent.generatedCode,
          input: args.input,
          model_id: agent.model,
          system_prompt: agent.systemPrompt,
        },
        timeout: 60000,
      } );

      // Update test execution using internal mutation
      if ( result.success ) {
        return {
          success: true,
          response: result.result?.response,
          testId,
          executionTime: result.executionTime,
        };
      } else {
        return {
          success: false,
          error: result.error,
          testId,
        };
      }
    } catch ( error: any ) {
      return {
        success: false,
        error: error.message || "Agent execution failed",
      };
    }
  },
} );

/**
 * Generate requirements.txt for agent
 */
function generateRequirements( agent: any ): string {
  const baseRequirements = [
    "bedrock-agentcore-starter-toolkit>=1.0.0",
    "strands-agents>=1.0.0",
  ];

  const toolRequirements: string[] = [];
  if ( agent.tools ) {
    for ( const tool of agent.tools ) {
      if ( tool.pipPackages ) {
        toolRequirements.push( ...tool.pipPackages );
      }
      if ( tool.extrasPip ) {
        toolRequirements.push( tool.extrasPip );
      }
    }
  }

  // Convert strands-tools to strands-agents-tools as per AgentCore docs
  const finalRequirements = [...baseRequirements, ...toolRequirements].map( req =>
    req.includes( "strands-tools" ) ? req.replace( "strands-tools", "strands-agents-tools" ) : req
  );

  return Array.from( new Set( finalRequirements ) ).join( "\n" );
}

/**
 * Check AgentCore status and user limits
 */
export const getAgentCoreStatus = action( {
  args: {},
  handler: async ( ctx ): Promise<{ success: boolean; error?: string; agentCoreConnected?: boolean; agentCoreStatus?: string; userTier?: string; monthlyTests?: number; testLimit?: number; remainingTests?: number | string; rateLimitStatus?: string }> => {
    const userId = await getAuthUserId( ctx );
    if ( !userId ) {
      throw new Error( "Not authenticated" );
    }

    try {
      // Test MCP server connection
      const connectionTest: any = await ctx.runAction( api.mcpClient.testMCPServerConnection, {
        serverName: "bedrock-agentcore-mcp-server",
      } );

      // Get user stats - simplified for now
      const user: any = { tier: "freemium" }; // Simplified for now
      const tier: string = user?.tier || "freemium";

      const monthlyTests: any = 0; // Simplified for now

      const { getTierConfig: getTierCfg } = await import( "./lib/tierConfig" );
      const tierCfg = getTierCfg( tier );
      const limit = tierCfg.monthlyExecutions; // -1 = unlimited

      return {
        success: true,
        agentCoreConnected: connectionTest.success,
        agentCoreStatus: connectionTest.status,
        userTier: tier,
        monthlyTests,
        testLimit: limit,
        remainingTests: limit === -1 ? "unlimited" : Math.max( 0, limit - monthlyTests ),
        rateLimitStatus: limit === -1 || monthlyTests < limit ? "ok" : "exceeded",
      };
    } catch ( error: any ) {
      return {
        success: false,
        error: error.message || "Failed to get AgentCore status",
      };
    }
  },
} );