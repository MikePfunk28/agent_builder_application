import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * MCP Configuration Management
 *
 * This module provides CRUD operations for managing MCP server configurations.
 * It handles:
 * - Listing MCP servers
 * - Adding new MCP servers
 * - Updating existing MCP servers
 * - Deleting MCP servers
 * - Testing MCP server connections
 */

/**
 * List all MCP servers for the current user
 */
export const listMCPServers = query({
  args: {},
  handler: async (ctx) => {
    // Get Convex user document ID
    const userId = await getAuthUserId(ctx);

    // Return empty array if not authenticated (instead of throwing error)
    if (!userId) {
      return [];
    }

    // Get all MCP servers for this user
    const servers = await ctx.db
      .query("mcpServers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return servers;
  },
});

/**
 * Get a specific MCP server by name
 */
export const getMCPServerByName = query({
  args: {
    serverName: v.string(),
  },
  handler: async (ctx, args) => {
    // Get Convex user document ID
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get server by name for this user
    const server = await ctx.db
      .query("mcpServers")
      .withIndex("by_user_and_name", (q) =>
        q.eq("userId", userId).eq("name", args.serverName)
      )
      .first();

    return server;
  },
});

/**
 * Add a new MCP server
 */
export const addMCPServer = mutation({
  args: {
    name: v.string(),
    command: v.string(),
    args: v.array(v.string()),
    env: v.optional(v.object({})),
    disabled: v.optional(v.boolean()),
    timeout: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get Convex user document ID
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if server with this name already exists for this user
    const existingServer = await ctx.db
      .query("mcpServers")
      .withIndex("by_user_and_name", (q) =>
        q.eq("userId", userId).eq("name", args.name)
      )
      .first();

    if (existingServer) {
      throw new Error(`MCP server with name "${args.name}" already exists`);
    }

    // Validate server name (alphanumeric, hyphens, underscores only)
    if (!/^[a-zA-Z0-9_-]+$/.test(args.name)) {
      throw new Error(
        "Server name must contain only alphanumeric characters, hyphens, and underscores"
      );
    }

    // Create new MCP server
    const serverId = await ctx.db.insert("mcpServers", {
      name: args.name,
      userId: userId,
      command: args.command,
      args: args.args,
      env: args.env,
      disabled: args.disabled ?? false,
      timeout: args.timeout,
      status: "unknown",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return serverId;
  },
});

/**
 * Update an existing MCP server
 */
export const updateMCPServer = mutation({
  args: {
    serverId: v.id("mcpServers"),
    updates: v.object({
      name: v.optional(v.string()),
      command: v.optional(v.string()),
      args: v.optional(v.array(v.string())),
      env: v.optional(v.object({})),
      disabled: v.optional(v.boolean()),
      timeout: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    // Get Convex user document ID
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the server
    const server = await ctx.db.get(args.serverId);

    if (!server) {
      throw new Error("MCP server not found");
    }

    // Verify ownership
    if (server.userId !== userId) {
      throw new Error("Not authorized to update this MCP server");
    }

    // If updating name, check for conflicts
    if (args.updates.name && args.updates.name !== server.name) {
      const existingServer = await ctx.db
        .query("mcpServers")
        .withIndex("by_user_and_name", (q) =>
          q.eq("userId", userId).eq("name", args.updates.name!)
        )
        .first();

      if (existingServer) {
        throw new Error(`MCP server with name "${args.updates.name}" already exists`);
      }

      // Validate new server name
      if (!/^[a-zA-Z0-9_-]+$/.test(args.updates.name)) {
        throw new Error(
          "Server name must contain only alphanumeric characters, hyphens, and underscores"
        );
      }
    }

    // Update the server
    await ctx.db.patch(args.serverId, {
      ...args.updates,
      updatedAt: Date.now(),
    });

    return args.serverId;
  },
});

/**
 * Delete an MCP server
 */
export const deleteMCPServer = mutation({
  args: {
    serverId: v.id("mcpServers"),
  },
  handler: async (ctx, args) => {
    // Get Convex user document ID
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the server
    const server = await ctx.db.get(args.serverId);

    if (!server) {
      throw new Error("MCP server not found");
    }

    // Verify ownership
    if (server.userId !== userId) {
      throw new Error("Not authorized to delete this MCP server");
    }

    // Delete the server
    await ctx.db.delete(args.serverId);

    return { success: true };
  },
});

/**
 * Update MCP server status (internal use)
 */
export const updateMCPServerStatus = mutation({
  args: {
    serverId: v.id("mcpServers"),
    status: v.string(),
    lastConnected: v.optional(v.number()),
    lastError: v.optional(v.string()),
    availableTools: v.optional(v.array(v.object({
      name: v.string(),
      description: v.optional(v.string()),
      inputSchema: v.optional(v.any()),
    }))),
  },
  handler: async (ctx, args) => {
    const server = await ctx.db.get(args.serverId);

    if (!server) {
      throw new Error("MCP server not found");
    }

    await ctx.db.patch(args.serverId, {
      status: args.status,
      lastConnected: args.lastConnected,
      lastError: args.lastError,
      availableTools: args.availableTools,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Test MCP server connection
 */
export const testMCPConnection = action({
  args: {
    serverId: v.id("mcpServers"),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    status: string;
    tools?: any[];
    error?: string;
  }> => {
    // Get the server
    const server: any = await ctx.runQuery(api.mcpConfig.getMCPServerById, {
      serverId: args.serverId,
    });

    if (!server) {
      return {
        success: false,
        status: "error",
        error: "MCP server not found",
      };
    }

    // Use the MCP client to test connection
    const result: any = await ctx.runAction(api.mcpClient.testMCPServerConnection, {
      serverName: server.name,
    });

    // Update server status based on test result
    await ctx.runMutation(api.mcpConfig.updateMCPServerStatus, {
      serverId: args.serverId,
      status: result.status,
      lastConnected: result.success ? Date.now() : undefined,
      lastError: result.error,
      availableTools: result.tools?.map((tool: any) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    });

    return result;
  },
});

/**
 * Get MCP server by ID (internal query)
 */
export const getMCPServerById = query({
  args: {
    serverId: v.id("mcpServers"),
  },
  handler: async (ctx, args) => {
    // Get Convex user document ID
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Not authenticated");
    }

    const server = await ctx.db.get(args.serverId);

    if (!server) {
      return null;
    }

    // Verify ownership
    if (server.userId !== userId) {
      throw new Error("Not authorized to access this MCP server");
    }

    return server;
  },
});
