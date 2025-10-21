/**
 * AgentCore Test Execution
 * Executes agent tests in Bedrock AgentCore sandbox (for Bedrock models)
 */

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

/**
 * Execute agent test in AgentCore sandbox
 * Called by queueProcessor for Bedrock models
 */
export const executeAgentCoreTest = internalAction({
  args: {
    testId: v.id("testExecutions"),
    agentId: v.id("agents"),
    input: v.string(),
    conversationHistory: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args): Promise<{ success: boolean; response?: string; error?: string; executionTime?: number }> => {
    const startTime = Date.now();

    try {
      // Get agent
      const agent: any = await ctx.runQuery(internal.agents.getInternal, { id: args.agentId });
      if (!agent) {
        throw new Error("Agent not found");
      }

      // Update test status to running
      await ctx.runMutation(internal.testExecution.updateStatus, {
        testId: args.testId,
        status: "RUNNING",
      });

      // Invoke AgentCore via MCP (using internal action - no auth required)
      const result = await ctx.runAction(internal.mcpClient.invokeMCPToolInternal, {
        serverName: "bedrock-agentcore-mcp-server",
        toolName: "execute_agent",
        parameters: {
          code: agent.generatedCode,
          input: args.input,
          model_id: agent.model,
          system_prompt: agent.systemPrompt,
          conversation_history: args.conversationHistory || [],
        },
      });

      const executionTime = Date.now() - startTime;

      if (!result.success) {
        await ctx.runMutation(internal.testExecution.updateStatus, {
          testId: args.testId,
          status: "FAILED",
          success: false,
          error: result.error || "AgentCore execution failed",
        });
        return { success: false, error: result.error, executionTime };
      }

      // Update test with success
      await ctx.runMutation(internal.testExecution.updateStatus, {
        testId: args.testId,
        status: "COMPLETED",
        success: true,
        response: (result as any).result?.response || "No response",
      });

      return {
        success: true,
        response: (result as any).result?.response,
        executionTime,
      };
    } catch (error: any) {
      await ctx.runMutation(internal.testExecution.updateStatus, {
        testId: args.testId,
        status: "FAILED",
        success: false,
        error: error.message,
      });
      return { success: false, error: error.message, executionTime: Date.now() - startTime };
    }
  },
});
