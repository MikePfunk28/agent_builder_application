/**
 * Multi-Agent Runtime Handler
 *
 * Handles execution when user agents use swarm, graph, or workflow tools
 * that spawn multiple agents simultaneously or sequentially.
 *
 * INTEGRATION: Now works with swarmTestingOrchestrator for testing
 */

import { action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

/**
 * Execute multi-agent pattern (swarm/graph/workflow)
 * Called when user's agent invokes swarm, graph, or workflow tools
 *
 * NOTE: Multi-agent sessions and results tables are not yet defined in schema.
 * This is a placeholder implementation.
 */
export const executeMultiAgentPattern = action({
  args: {
    parentAgentId: v.id("agents"),
    parentConversationId: v.optional(v.id("interleavedConversations")),
    pattern: v.union(v.literal("swarm"), v.literal("graph"), v.literal("workflow")),
    agents: v.array(v.object({
      agentId: v.id("agents"),
      role: v.optional(v.string()),
    })),
    executionMode: v.union(v.literal("parallel"), v.literal("sequential")),
    sharedContext: v.optional(v.any()),
  },
  handler: async (ctx: any, args: any): Promise<any> => {
    // Auth check: verify caller identity before executing multi-agent patterns
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: authentication required to execute multi-agent patterns");
    }

    // Verify caller has access to the parent agent
    const parentAgent = await ctx.runQuery(api.agents.get, { id: args.parentAgentId });
    if (!parentAgent) {
      throw new Error(`Forbidden: parent agent ${args.parentAgentId} not found or access denied`);
    }

    console.log(`Multi-agent execution requested: ${args.pattern} mode with ${args.agents.length} agents`);

    try {
      // INTEGRATION: Use swarmTestingOrchestrator for actual execution
      if (args.pattern === "swarm") {
        // Create swarm from tool invocation
        const swarmCreation = await ctx.runAction(internal.swarmTestingOrchestrator.createSwarmFromToolInvocation, {
          parentAgentId: args.parentAgentId,
          toolInvocation: {
            toolName: "swarm",
            parameters: {
              agents: args.agents,
              strategy: args.executionMode,
              sharedContext: args.sharedContext,
            },
            conversationId: args.parentConversationId,
          },
        });

        if (!swarmCreation.success || !swarmCreation.swarmId) {
          throw new Error(`Failed to create swarm: ${swarmCreation.message}`);
        }

        // Execute the swarm
        const swarmExecution = await ctx.runAction(internal.swarmTestingOrchestrator.executeSwarmFromTool, {
          swarmId: swarmCreation.swarmId,
          toolInvocation: {
            toolName: "swarm",
            parameters: {
              message: args.sharedContext?.task || "Execute swarm operation",
              strategy: args.executionMode,
            },
            executionMode: args.executionMode === "parallel" ? "parallel" :
                          args.executionMode === "sequential" ? "sequential" : "orchestrated",
          },
          parentConversationId: args.parentConversationId,
        });

        return {
          success: swarmExecution.success,
          pattern: args.pattern,
          executionMode: args.executionMode,
          results: swarmExecution.results,
          swarmId: swarmCreation.swarmId,
          coordinationLog: swarmExecution.coordinationLog,
          executionSummary: swarmExecution.executionSummary,
          message: swarmExecution.executionSummary,
        };
      }

      // For graph and workflow patterns, use similar approach
      if (args.pattern === "graph" || args.pattern === "workflow") {
        // Create swarm for graph/workflow execution
        const swarmCreation = await ctx.runAction(internal.swarmTestingOrchestrator.createSwarmFromToolInvocation, {
          parentAgentId: args.parentAgentId,
          toolInvocation: {
            toolName: args.pattern,
            parameters: {
              agents: args.agents,
              executionMode: args.executionMode,
              sharedContext: args.sharedContext,
            },
            conversationId: args.parentConversationId,
          },
        });

        if (!swarmCreation.success || !swarmCreation.swarmId) {
          throw new Error(`Failed to create ${args.pattern}: ${swarmCreation.message}`);
        }

        // Execute the graph/workflow
        const execution = await ctx.runAction(internal.swarmTestingOrchestrator.executeSwarmFromTool, {
          swarmId: swarmCreation.swarmId,
          toolInvocation: {
            toolName: args.pattern,
            parameters: args.sharedContext || {},
            executionMode: args.executionMode === "parallel" ? "parallel" :
                          args.executionMode === "sequential" ? "sequential" : "orchestrated",
          },
          parentConversationId: args.parentConversationId,
        });

        return {
          success: execution.success,
          pattern: args.pattern,
          executionMode: args.executionMode,
          results: execution.results,
          swarmId: swarmCreation.swarmId,
          coordinationLog: execution.coordinationLog,
          executionSummary: execution.executionSummary,
          message: execution.executionSummary,
        };
      }

      // Fallback for unsupported patterns
      const results = await Promise.all(
        args.agents.map(async (agent: any) => ({
          agentId: agent.agentId,
          role: agent.role || "agent",
          success: true,
          result: { message: `${args.pattern} pattern not yet fully implemented` },
        }))
      );

      return {
        success: true,
        pattern: args.pattern,
        executionMode: args.executionMode,
        results,
        message: `${args.pattern} execution completed with basic implementation`,
      };

    } catch (error: any) {
      console.error("Multi-agent execution error:", error);

      // Fallback response
      const results = args.agents.map((agent: any) => ({
        agentId: agent.agentId,
        role: agent.role || "agent",
        success: false,
        result: { error: error.message },
      }));

      return {
        success: false,
        pattern: args.pattern,
        executionMode: args.executionMode,
        results,
        error: error.message,
        message: `Multi-agent execution failed: ${error.message}`,
      };
    }
  },
});

/*
// TODO: Implement when multiAgentSessions and multiAgentResults tables are added to schema
async function executeParallel(
  ctx: any,
  sessionId: Id<"multiAgentSessions">,
  agents: Array<{ agentId: Id<"agents">; role?: string }>,
  sharedContext?: any
) {
  // Implementation commented out until tables exist
  return { success: false, message: "Not implemented" };
}
*/

/*
// TODO: Implement when multiAgentSessions and multiAgentResults tables are added to schema
async function executeSequential(
  ctx: any,
  sessionId: Id<"multiAgentSessions">,
  agents: Array<{ agentId: Id<"agents">; role?: string }>,
  sharedContext?: any
) {
  // Implementation commented out until tables exist
  return { success: false, message: "Not implemented" };
}
*/

// Multi-agent session management mutations (NOW ENABLED with schema tables)

export const createSession = internalMutation({
  args: {
    parentAgentId: v.id("agents"),
    parentConversationId: v.optional(v.id("interleavedConversations")),
    pattern: v.string(),
    executionMode: v.string(),
    agentIds: v.array(v.id("agents")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("multiAgentSessions", {
      parentAgentId: args.parentAgentId,
      parentConversationId: args.parentConversationId,
      pattern: args.pattern,
      executionMode: args.executionMode,
      agentIds: args.agentIds,
      status: "running",
      startedAt: Date.now(),
    });
  },
});

export const createAgentConversation = internalMutation({
  args: {
    sessionId: v.id("multiAgentSessions"),
    agentId: v.id("agents"),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("interleavedConversations", {
      agentId: args.agentId,
      title: `Multi-Agent Session - ${args.role || "Agent"}`,
      systemPrompt: "",
      contextSize: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: true,
    });
  },
});

export const recordAgentResult = internalMutation({
  args: {
    sessionId: v.id("multiAgentSessions"),
    agentId: v.id("agents"),
    conversationId: v.id("interleavedConversations"),
    result: v.any(),
    status: v.string(),
    startedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("multiAgentResults", {
      sessionId: args.sessionId,
      agentId: args.agentId,
      conversationId: args.conversationId,
      result: args.result,
      status: args.status,
      startedAt: args.startedAt ?? now,
      completedAt: args.status === "running" ? undefined : now,
    });
  },
});

export const completeSession = internalMutation({
  args: {
    sessionId: v.id("multiAgentSessions"),
    results: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      status: "completed",
      completedAt: Date.now(),
      result: args.results,
    });
  },
});
