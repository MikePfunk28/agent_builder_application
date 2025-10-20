/**
 * MCP File Upload
 * Parse and attach MCP configuration files to agents
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Parse MCP JSON file and attach to agent
 */
export const uploadMCPConfig = mutation({
  args: {
    agentId: v.id("agents"),
    mcpConfigJson: v.string(), // JSON string of mcp.json file
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be authenticated");
    }

    // Get agent
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.createdBy !== userId) {
      throw new Error("Agent not found or access denied");
    }

    // Parse MCP config
    let mcpConfig;
    try {
      mcpConfig = JSON.parse(args.mcpConfigJson);
    } catch (error) {
      throw new Error("Invalid MCP JSON format");
    }

    // Validate structure
    if (!mcpConfig.mcpServers || typeof mcpConfig.mcpServers !== "object") {
      throw new Error("MCP config must have 'mcpServers' object");
    }

    // Convert to array format
    const mcpServers = Object.entries(mcpConfig.mcpServers).map(
      ([name, config]: [string, any]) => ({
        name,
        command: config.command || "",
        args: config.args || [],
        env: config.env || {},
        disabled: config.disabled || false,
      })
    );

    // Update agent
    await ctx.db.patch(args.agentId, {
      mcpServers,
    });

    return { success: true, serversCount: mcpServers.length };
  },
});

/**
 * Add single MCP server to agent
 */
export const addMCPServer = mutation({
  args: {
    agentId: v.id("agents"),
    name: v.string(),
    command: v.string(),
    args: v.array(v.string()),
    env: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be authenticated");
    }

    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.createdBy !== userId) {
      throw new Error("Agent not found or access denied");
    }

    const mcpServers = agent.mcpServers || [];
    mcpServers.push({
      name: args.name,
      command: args.command,
      args: args.args,
      env: args.env || {},
      disabled: false,
    });

    await ctx.db.patch(args.agentId, { mcpServers });

    return { success: true };
  },
});

/**
 * Remove MCP server from agent
 */
export const removeMCPServer = mutation({
  args: {
    agentId: v.id("agents"),
    serverName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be authenticated");
    }

    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.createdBy !== userId) {
      throw new Error("Agent not found or access denied");
    }

    const mcpServers = (agent.mcpServers || []).filter(
      (s) => s.name !== args.serverName
    );

    await ctx.db.patch(args.agentId, { mcpServers });

    return { success: true };
  },
});
