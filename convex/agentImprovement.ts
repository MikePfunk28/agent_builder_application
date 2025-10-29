/**
 * Agent Improvement & Auto-Update System
 *
 * Handles automatic agent improvements based on conversation analysis.
 * UPDATES existing agents (does not create new ones).
 */

import { v } from "convex/values";
import { mutation, action, query, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

/**
 * Apply improvement plan to an existing agent
 * CRITICAL: This UPDATES the agent, does not create a new one
 */
export const applyImprovementPlan = action({
  args: {
    agentId: v.id("agents"),
    conversationId: v.id("conversations"),
    improvementPlan: v.any(),
  },
  handler: async (ctx: any, args: { agentId: Id<"agents">; conversationId: Id<"conversations">; improvementPlan: any }): Promise<{ success: boolean; agentId: Id<"agents">; changes: string[]; message: string }> => {
    // Get current agent
    const agent: any = await ctx.runQuery(api.agents.get, { id: args.agentId });
    if (!agent) {
      throw new Error(`Agent ${args.agentId} not found`);
    }

    // Get conversation to verify it belongs to this agent
    const conversation: any = await ctx.runQuery(api.conversations.get, { conversationId: args.conversationId });
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.agentId !== args.agentId) {
      throw new Error(
        `CRITICAL ERROR: Conversation belongs to agent ${conversation.agentId}, but trying to improve agent ${args.agentId}`
      );
    }

    console.log(`✅ Verified: Improving agent ${args.agentId} using conversation ${args.conversationId}`);

    // Generate updated agent configuration
    const updatedConfig = generateUpdatedAgentConfig(agent, args.improvementPlan);

    // Update the agent (NOT create new)
    await ctx.runMutation(api.agents.update, {
      id: args.agentId,
      name: agent.name, // Keep same name
      description: updatedConfig.description,
      systemPrompt: updatedConfig.systemPrompt,
      tools: agent.tools, // Keep tools as-is for now (tools is complex object)
      model: updatedConfig.model,
      // Note: lastImprovedAt and improvementSource would need to be added to schema
    });

    // Log improvement history
    await ctx.runMutation(internal.agentImprovement.logImprovement, {
      agentId: args.agentId,
      conversationId: args.conversationId,
      improvementPlan: args.improvementPlan,
      changes: updatedConfig.changes,
    });

    return {
      success: true,
      agentId: args.agentId, // Same agent ID (updated, not created)
      changes: updatedConfig.changes,
      message: `Agent "${agent.name}" has been improved based on conversation analysis`,
    };
  },
});

/**
 * Generate updated agent configuration based on improvement plan
 */
function generateUpdatedAgentConfig(agent: any, improvementPlan: any) {
  const changes: string[] = [];
  let systemPrompt = agent.systemPrompt || "";
  let description = agent.description || "";
  let tools = agent.tools || [];
  let model = agent.model;

  // Apply improvements based on type
  for (const improvement of improvementPlan.recommendedChanges || []) {
    switch (improvement.type) {
      case "add_tool":
        // Extract tool name from description
        const toolMatch = improvement.description.match(/Add capability: (.+)/i);
        if (toolMatch) {
          const toolName = toolMatch[1].trim();
          if (!tools.includes(toolName)) {
            tools.push(toolName);
            changes.push(`Added tool: ${toolName}`);
          }
        }
        break;

      case "modify_prompt":
        // Improve system prompt clarity
        if (improvement.description.includes("clearer instructions")) {
          systemPrompt += "\n\n# Additional Instructions\n";
          systemPrompt += "- Be clear and specific in responses\n";
          systemPrompt += "- Confirm understanding before proceeding\n";
          systemPrompt += "- Ask for clarification if user request is ambiguous\n";
          changes.push("Enhanced system prompt with clearer instructions");
        }
        break;

      case "improve_error_handling":
        // Add error handling instructions
        systemPrompt += "\n\n# Error Handling\n";
        systemPrompt += "- Provide user-friendly error messages\n";
        systemPrompt += "- Suggest alternatives when operations fail\n";
        systemPrompt += "- Never expose technical error details to users\n";
        changes.push("Improved error handling in system prompt");
        break;

      case "change_model":
        // Extract recommended model
        const modelMatch = improvement.implementation.match(/(claude-[^\s]+)/i);
        if (modelMatch) {
          const newModel = modelMatch[1];
          if (newModel !== model) {
            model = newModel;
            changes.push(`Changed model from ${agent.model} to ${newModel}`);
          }
        }
        break;

      case "add_memory":
        // Add memory tool
        if (!tools.includes("memory")) {
          tools.push("memory");
          changes.push("Added memory capability");
        }
        break;
    }
  }

  // Update description with improvements
  if (changes.length > 0) {
    description += `\n\n[Auto-improved based on conversation analysis]`;
  }

  return {
    systemPrompt,
    description,
    tools,
    model,
    changes,
  };
}

/**
 * Log improvement history (internal mutation)
 */
export const logImprovement = internalMutation({
  args: {
    agentId: v.id("agents"),
    conversationId: v.id("conversations"),
    improvementPlan: v.any(),
    changes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("agentImprovementHistory", {
      agentId: args.agentId,
      conversationId: args.conversationId,
      improvementPlan: args.improvementPlan,
      changes: args.changes,
      appliedAt: Date.now(),
    });
  },
});

/**
 * Get improvement history for an agent
 */
export const getImprovementHistory = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx: any, args: { agentId: Id<"agents"> }): Promise<any[]> => {
    return await ctx.db
      .query("agentImprovementHistory")
      .withIndex("by_agent", (q: any) => q.eq("agentId", args.agentId))
      .order("desc")
      .collect();
  },
});

/**
 * Automatic improvement workflow
 * Analyzes conversation and applies improvements in one step
 */
export const autoImproveAgent = action({
  args: {
    agentId: v.id("agents"),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx: any, args: { agentId: Id<"agents">; conversationId: Id<"conversations"> }): Promise<any> => {
    // Verify conversation belongs to agent
    const conversation: any = await ctx.runQuery(api.conversations.get, { conversationId: args.conversationId });
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.agentId !== args.agentId) {
      throw new Error(
        `Cannot improve agent ${args.agentId} using conversation from agent ${conversation.agentId}`
      );
    }

    console.log(`🤖 Auto-improving agent ${args.agentId} from conversation ${args.conversationId}`);

    // Generate improvement plan
    const improvementPlan: any = await ctx.runAction(
      api.conversationAnalysis.generateImprovementPlan,
      { conversationId: args.conversationId }
    );

    // Apply improvements
    const result: any = await ctx.runAction(api.agentImprovement.applyImprovementPlan, {
      agentId: args.agentId,
      conversationId: args.conversationId,
      improvementPlan,
    });

    return {
      ...result,
      improvementPlan,
    };
  },
});

/**
 * Preview improvements without applying them
 */
export const previewImprovements = action({
  args: {
    agentId: v.id("agents"),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx: any, args: { agentId: Id<"agents">; conversationId: Id<"conversations"> }): Promise<any> => {
    // Verify conversation belongs to agent
    const conversation: any = await ctx.runQuery(api.conversations.get, { conversationId: args.conversationId });
    if (!conversation || conversation.agentId !== args.agentId) {
      throw new Error("Invalid conversation or agent mismatch");
    }

    // Get agent
    const agent: any = await ctx.runQuery(api.agents.get, { id: args.agentId });
    if (!agent) {
      throw new Error("Agent not found");
    }

    // Generate improvement plan
    const improvementPlan: any = await ctx.runAction(
      api.conversationAnalysis.generateImprovementPlan,
      { conversationId: args.conversationId }
    );

    // Generate preview (don't apply)
    const updatedConfig = generateUpdatedAgentConfig(agent, improvementPlan);

    return {
      currentAgent: {
        systemPrompt: agent.systemPrompt,
        tools: agent.tools,
        model: agent.model,
      },
      proposedChanges: updatedConfig,
      improvementPlan,
    };
  },
});
