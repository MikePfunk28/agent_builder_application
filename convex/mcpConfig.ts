import { mutation, query, action, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

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
 * Built-in MCP servers available to all users.
 * These are in-memory objects (not from DB) with synthetic IDs and "system" userId.
 */
interface BuiltInMcpServer {
  source: "system";
  _id: string; // synthetic id (e.g. "system_ollama") — not a DB id
  _creationTime: number;
  name: string;
  userId: string; // "system" — not a real user ID
  command?: string; // Required for stdio transport; omit for sse/http/direct
  args?: string[]; // Required for stdio transport; omit for sse/http/direct
  env?: Record<string, string>;
  disabled: boolean;
  timeout: number;
  status: string;
  url?: string; // Required for sse/http transport
  transportType: "stdio" | "sse" | "http" | "direct"; // How to connect to this server
  availableTools: Array<{ name: string; description: string }>;
  createdAt: number;
  updatedAt: number;
}

interface DbMcpServer {
  source: "user";
  _id: Id<"mcpServers">;
  _creationTime: number;
  name: string;
  userId: Id<"users">;
  command?: string; // Required for stdio transport; omit for sse/http
  args?: string[]; // Required for stdio transport; omit for sse/http
  env?: Record<string, string>;
  disabled: boolean;
  timeout?: number;
  status: string;
  url?: string; // Required for sse/http transport
  transportType?: string; // "stdio" | "sse" | "http" — defaults to "stdio"
  availableTools?: Array<{ name: string; description?: string; inputSchema?: unknown }>;
  createdAt: number;
  updatedAt: number;
}

export type MCPServerEntry = BuiltInMcpServer | DbMcpServer;

const BUILT_IN_MCP_SERVERS: BuiltInMcpServer[] = [
  {
    source: "system" as const,
    _id: "system_bedrock_agentcore",
    _creationTime: Date.now(),
    name: "bedrock-agentcore-mcp-server",
    userId: "system",
    disabled: false,
    timeout: 60000,
    status: "connected",
    transportType: "direct", // Calls Bedrock API directly — no MCP protocol
    availableTools: [
      { name: "execute_agent", description: "Execute a strands-agents agent" },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    source: "system" as const,
    _id: "system_document_fetcher",
    _creationTime: Date.now(),
    name: "document-fetcher-mcp-server",
    userId: "system",
    disabled: false,
    timeout: 30000,
    status: "connected",
    transportType: "direct", // Direct fetch() calls — no MCP subprocess
    availableTools: [
      { name: "fetch_url", description: "Fetch and clean a web page" },
      { name: "parse_llms_txt", description: "Parse an llms.txt file and extract links" },
      { name: "fetch_documentation", description: "Fetch multiple documentation pages from llms.txt" },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    source: "system" as const,
    _id: "system_aws_diagram",
    _creationTime: Date.now(),
    name: "aws-diagram-mcp-server",
    userId: "system",
    disabled: true, // Disabled: requires subprocess (uvx) — needs SSE server or reimplementation
    timeout: 30000,
    status: "disconnected",
    transportType: "direct",
    availableTools: [
      { name: "create_diagram", description: "Create AWS architecture diagram" },
      { name: "get_resources", description: "Get AWS resources from a region" },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    source: "system" as const,
    _id: "system_ollama",
    _creationTime: Date.now(),
    name: "ollama-mcp-server",
    userId: "system",
    env: {
      OLLAMA_HOST: "http://127.0.0.1:11434",
    },
    disabled: false,
    timeout: 60000,
    status: "connected",
    transportType: "direct", // Direct Ollama REST API — no MCP subprocess
    availableTools: [
      { name: "chat_completion", description: "Chat with Ollama models" },
      { name: "list", description: "List available Ollama models" },
      { name: "show", description: "Show model information" },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    source: "system" as const,
    _id: "system_taskmaster",
    _creationTime: Date.now(),
    name: "task-master-ai",
    userId: "system",
    disabled: true, // Disabled: requires subprocess (npx) — needs SSE server or reimplementation
    timeout: 30000,
    status: "disconnected",
    transportType: "direct",
    availableTools: [
      { name: "parse_prd", description: "Parse a PRD document into structured tasks" },
      { name: "next_task", description: "Get the next task to work on based on priority and dependencies" },
      { name: "list_tasks", description: "List all tasks with their current status" },
      { name: "set_task_status", description: "Update the status of a task" },
      { name: "expand_task", description: "Expand a task into detailed subtasks with AI research" },
      { name: "generate_task_files", description: "Generate individual task files from the task list" },
      { name: "analyze_complexity", description: "Analyze task complexity and effort estimates" },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

/**
 * List all MCP servers for the current user
 * Includes built-in system servers + user's custom servers
 */
export const listMCPServers = query( {
  args: {},
  handler: async ( ctx ) => {
    // Get Convex user document ID
    const userId = await getAuthUserId( ctx );

    // Always return built-in servers (available to everyone, including anonymous)
    const builtInServers = [...BUILT_IN_MCP_SERVERS];

    // If not authenticated, only return built-in servers
    if ( !userId ) {
      return builtInServers;
    }

    // Get user's custom MCP servers and tag them as `source: 'user'` so
    // callers can reliably discriminate between DB-backed vs built-in servers.
    const userServersRaw = await ctx.db
      .query( "mcpServers" )
      .withIndex( "by_user", ( q ) => q.eq( "userId", userId ) )
      .collect();

    const userServers = userServersRaw.map( ( s ) => ( {
      ...s,
      source: "user" as const,
    } ) );

    // Combine built-in + user servers
    return [
      ...builtInServers,
      ...userServers,
    ];
  },
} );

/**
 * Type guard — narrow MCP server entries to DB-backed servers.
 * Use this before calling mutations that require Id<"mcpServers"> (e.g. updateMCPServerStatus).
 */
export function isDbMcpServer( server: MCPServerEntry | null | undefined ): server is DbMcpServer {
  return !!server && server.source === "user";
}

/**
 * Get a specific MCP server by name
 */
export const getMCPServerByName = query( {
  args: {
    serverName: v.string(),
  },
  handler: async ( ctx, args ) => {
    // Check if it's a built-in server first
    const builtInServer = BUILT_IN_MCP_SERVERS.find( s => s.name === args.serverName );
    if ( builtInServer ) {
      return builtInServer;
    }

    // For user-specific MCP servers, require authentication
    const userId = await getAuthUserId( ctx );

    if ( !userId ) {
      throw new Error( "Not authenticated" );
    }

    // Get server by name for this user
    const serverRaw = await ctx.db
      .query( "mcpServers" )
      .withIndex( "by_user_and_name", ( q ) =>
        q.eq( "userId", userId ).eq( "name", args.serverName )
      )
      .first();

    if ( !serverRaw ) return null;
    return { ...serverRaw, source: "user" as const };
  },
} );

/**
 * Get a specific MCP server by name (internal - no auth required)
 * Used by system actions like queue processor
 */
export const getMCPServerByNameInternal = internalQuery( {
  args: {
    serverName: v.string(),
    userId: v.optional( v.id( "users" ) ),
  },
  handler: async ( ctx, args ) => {
    // Check if it's a built-in server first
    const builtInServer = BUILT_IN_MCP_SERVERS.find( s => s.name === args.serverName );
    if ( builtInServer ) {
      return builtInServer;
    }

    if ( args.userId ) {
      // Get server by name for specific user
      const userId = args.userId; // Type narrowing
      const serverRaw = await ctx.db
        .query( "mcpServers" )
        .withIndex( "by_user_and_name", ( q ) =>
          q.eq( "userId", userId ).eq( "name", args.serverName )
        )
        .first();
      if ( !serverRaw ) return null;
      return { ...serverRaw, source: "user" } as DbMcpServer;
    } else {
      // No userId provided — cannot query across users (would leak another user's server)
      return null;
    }
  },
} );

/**
 * Add a new MCP server
 */
export const addMCPServer = mutation( {
  args: {
    name: v.string(),
    command: v.optional( v.string() ),    // Required for stdio transport
    args: v.optional( v.array( v.string() ) ), // Required for stdio transport
    env: v.optional( v.object( {} ) ),
    disabled: v.optional( v.boolean() ),
    timeout: v.optional( v.number() ),
    url: v.optional( v.string() ),        // Required for sse/http transport
    transportType: v.optional( v.string() ), // "stdio" | "sse" | "http" — defaults to "stdio"
  },
  handler: async ( ctx, args ) => {
    // Get Convex user document ID
    const userId = await getAuthUserId( ctx );

    if ( !userId ) {
      throw new Error( "Not authenticated" );
    }

    // Check if server with this name already exists for this user
    const existingServer = await ctx.db
      .query( "mcpServers" )
      .withIndex( "by_user_and_name", ( q ) =>
        q.eq( "userId", userId ).eq( "name", args.name )
      )
      .first();

    if ( existingServer ) {
      throw new Error( `MCP server with name "${args.name}" already exists` );
    }

    // Validate server name (alphanumeric, hyphens, underscores only)
    if ( !/^[a-zA-Z0-9_-]+$/.test( args.name ) ) {
      throw new Error(
        "Server name must contain only alphanumeric characters, hyphens, and underscores"
      );
    }

    // Validate transport-specific required fields
    const transport = args.transportType || "stdio";
    if ( transport === "sse" || transport === "http" ) {
      if ( !args.url ) {
        throw new Error( `Transport "${transport}" requires a url field` );
      }
    } else if ( transport === "stdio" ) {
      if ( !args.command ) {
        throw new Error( "Transport \"stdio\" requires a command field" );
      }
    }

    // Create new MCP server
    const serverId = await ctx.db.insert( "mcpServers", {
      name: args.name,
      userId: userId,
      command: args.command,
      args: args.args,
      env: args.env,
      disabled: args.disabled ?? false,
      timeout: args.timeout,
      url: args.url,
      transportType: args.transportType,
      status: "unknown",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } );

    return serverId;
  },
} );

/**
 * Update an existing MCP server
 */
export const updateMCPServer = mutation( {
  args: {
    serverId: v.id( "mcpServers" ),
    updates: v.object( {
      name: v.optional( v.string() ),
      command: v.optional( v.string() ),
      args: v.optional( v.array( v.string() ) ),
      env: v.optional( v.object( {} ) ),
      disabled: v.optional( v.boolean() ),
      timeout: v.optional( v.number() ),
      url: v.optional( v.string() ),
      transportType: v.optional( v.string() ),
    } ),
  },
  handler: async ( ctx, args ) => {
    // Get Convex user document ID
    const userId = await getAuthUserId( ctx );

    if ( !userId ) {
      throw new Error( "Not authenticated" );
    }

    // Get the server
    const server = await ctx.db.get( args.serverId );

    if ( !server ) {
      throw new Error( "MCP server not found" );
    }

    // Verify ownership
    if ( server.userId !== userId ) {
      throw new Error( "Not authorized to update this MCP server" );
    }

    // If updating name, check for conflicts
    if ( args.updates.name && args.updates.name !== server.name ) {
      const existingServer = await ctx.db
        .query( "mcpServers" )
        .withIndex( "by_user_and_name", ( q ) =>
          q.eq( "userId", userId ).eq( "name", args.updates.name! )
        )
        .first();

      if ( existingServer ) {
        throw new Error( `MCP server with name "${args.updates.name}" already exists` );
      }

      // Validate new server name
      if ( !/^[a-zA-Z0-9_-]+$/.test( args.updates.name ) ) {
        throw new Error(
          "Server name must contain only alphanumeric characters, hyphens, and underscores"
        );
      }
    }

    // Update the server
    await ctx.db.patch( args.serverId, {
      ...args.updates,
      updatedAt: Date.now(),
    } );

    return args.serverId;
  },
} );

/**
 * Delete an MCP server
 */
export const deleteMCPServer = mutation( {
  args: {
    serverId: v.id( "mcpServers" ),
  },
  handler: async ( ctx, args ) => {
    // Get Convex user document ID
    const userId = await getAuthUserId( ctx );

    if ( !userId ) {
      throw new Error( "Not authenticated" );
    }

    // Get the server
    const server = await ctx.db.get( args.serverId );

    if ( !server ) {
      throw new Error( "MCP server not found" );
    }

    // Verify ownership
    if ( server.userId !== userId ) {
      throw new Error( "Not authorized to delete this MCP server" );
    }

    // Delete the server
    await ctx.db.delete( args.serverId );

    return { success: true };
  },
} );

/**
 * Update MCP server status (internal use)
 */
export const updateMCPServerStatus = mutation( {
  args: {
    serverId: v.id( "mcpServers" ),
    status: v.string(),
    lastConnected: v.optional( v.number() ),
    lastError: v.optional( v.string() ),
    availableTools: v.optional( v.array( v.object( {
      name: v.string(),
      description: v.optional( v.string() ),
      inputSchema: v.optional( v.any() ), // v.any(): JSON Schema object for tool input — shape defined by MCP protocol
    } ) ) ),
  },
  handler: async ( ctx, args ) => {
    const server = await ctx.db.get( args.serverId );

    if ( !server ) {
      throw new Error( "MCP server not found" );
    }

    await ctx.db.patch( args.serverId, {
      status: args.status,
      lastConnected: args.lastConnected,
      lastError: args.lastError,
      availableTools: args.availableTools,
      updatedAt: Date.now(),
    } );

    return { success: true };
  },
} );

/**
 * Test MCP server connection
 */
export const testMCPConnection = action( {
  args: {
    serverId: v.id( "mcpServers" ),
  },
  handler: async ( ctx, args ): Promise<{
    success: boolean;
    status: string;
    tools?: any[];
    error?: string;
  }> => {
    // Get the server
    const server: any = await ctx.runQuery( api.mcpConfig.getMCPServerById, {
      serverId: args.serverId,
    } );

    if ( !server ) {
      return {
        success: false,
        status: "error",
        error: "MCP server not found",
      };
    }

    // Use the MCP client to test connection
    const result: any = await ctx.runAction( api.mcpClient.testMCPServerConnection, {
      serverName: server.name,
    } );

    // Update server status based on test result
    await ctx.runMutation( api.mcpConfig.updateMCPServerStatus, {
      serverId: args.serverId,
      status: result.status,
      lastConnected: result.success ? Date.now() : undefined,
      lastError: result.error,
      availableTools: result.tools?.map( ( tool: any ) => ( {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      } ) ),
    } );

    return result;
  },
} );

/**
 * Get MCP server by ID (public query — requires auth + ownership check)
 */
export const getMCPServerById = query( {
  args: {
    serverId: v.id( "mcpServers" ),
  },
  handler: async ( ctx, args ) => {
    // Get Convex user document ID
    const userId = await getAuthUserId( ctx );

    if ( !userId ) {
      throw new Error( "Not authenticated" );
    }

    const server = await ctx.db.get( args.serverId );

    if ( !server ) {
      return null;
    }

    // Verify ownership
    if ( server.userId !== userId ) {
      throw new Error( "Not authorized to access this MCP server" );
    }

    return server;
  },
} );
