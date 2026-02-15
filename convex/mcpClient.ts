"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { isDbMcpServer } from "./mcpConfig";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * MCP Client for invoking tools from configured MCP servers
 *
 * This module provides a wrapper for communicating with MCP servers
 * using the Model Context Protocol. It handles connection management,
 * error handling, and retry logic.
 */

/**
 * MCP Tool Invocation Result using discriminated unions for type safety
 *
 * Success case always includes result and executionTime
 * Failure case always includes error message
 */
export type MCPToolResult =
  | {
    success: true;
    result: any;
    executionTime: number;
  }
  | {
    success: false;
    error: string;
  };

/**
 * @deprecated Use MCPToolResult instead
 */
interface MCPToolInvocationResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTime?: number;
}

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Sleep utility for retry delays
 */
async function sleep( ms: number ): Promise<void> {
  return new Promise( resolve => setTimeout( resolve, ms ) );
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig
): number {
  const delay = config.initialDelayMs * Math.pow( config.backoffMultiplier, attempt );
  return Math.min( delay, config.maxDelayMs );
}

/**
 * Invoke an MCP tool with retry logic and error handling
 *
 * This action communicates with MCP servers to invoke tools.
 * It includes:
 * - Connection management
 * - Timeout handling
 * - Exponential backoff retry logic
 * - Comprehensive error handling
 */
/**
 * Internal MCP tool invocation (no auth required)
 * Used by system actions like queue processor
 */
export const invokeMCPToolInternal = internalAction( {
  args: {
    serverName: v.string(),
    toolName: v.string(),
    parameters: v.record( v.string(), v.any() ), // v.any(): tool parameter values are heterogeneous (strings, numbers, objects)
    userId: v.optional( v.id( "users" ) ),
    timeout: v.optional( v.number() ),
  },
  handler: async ( ctx, args ) => {
    const startTime = Date.now();

    try {
      // Get MCP server configuration from database (internal query)
      const server = await ctx.runQuery( internal.mcpConfig.getMCPServerByNameInternal, {
        serverName: args.serverName,
        userId: args.userId,
      } );

      if ( !server ) {
        return {
          success: false,
          error: `MCP server "${args.serverName}" not found.`,
        };
      }

      if ( server.disabled ) {
        return {
          success: false,
          error: `MCP server "${args.serverName}" is disabled.`,
        };
      }

      // Use server-specific timeout or provided timeout
      const timeout = args.timeout || server.timeout || 30000;

      // Invoke tool with retry logic
      const result = await invokeMCPToolWithRetry(
        server,
        args.toolName,
        args.parameters,
        timeout,
        DEFAULT_RETRY_CONFIG
      );

      const executionTime = Date.now() - startTime;

      // Meter Bedrock usage if this was a direct Bedrock invocation with token data (non-fatal)
      if (
        result.success &&
        args.userId &&
        result.result?.tokenUsage &&
        ( result.result.tokenUsage.inputTokens > 0 || result.result.tokenUsage.outputTokens > 0 )
      ) {
        try {
          await ctx.runMutation( internal.stripeMutations.incrementUsageAndReportOverage, {
            userId: args.userId,
            modelId: result.result.model_id,
            inputTokens: result.result.tokenUsage.inputTokens,
            outputTokens: result.result.tokenUsage.outputTokens,
          } );
        } catch ( billingErr ) {
          console.error( "mcpClient: billing failed (non-fatal)", {
            userId: args.userId, modelId: result.result.model_id,
            inputTokens: result.result.tokenUsage.inputTokens,
            outputTokens: result.result.tokenUsage.outputTokens,
            error: billingErr instanceof Error ? billingErr.message : billingErr,
          } );
        }
      }

      // Return properly typed result
      if ( result.success ) {
        return {
          success: true,
          result: result.result,
          executionTime,
        };
      } else {
        return {
          success: false,
          error: result.error,
        };
      }
    } catch ( error: any ) {
      return {
        success: false,
        error: `Failed to invoke MCP tool: ${error.message || String( error )}`,
      };
    }
  },
} );

export const invokeMCPTool = action( {
  args: {
    serverName: v.string(),
    toolName: v.string(),
    parameters: v.record( v.string(), v.any() ), // v.any(): tool parameter values are heterogeneous (strings, numbers, objects)
    userId: v.optional( v.id( "users" ) ), // Pass userId to enable billing for callers
    timeout: v.optional( v.number() ), // Override timeout in milliseconds
  },
  handler: async ( ctx, args ) => {
    const startTime = Date.now();

    // Resolve billing user from auth (prevents spoofing via args.userId)
    // Public action: NEVER trust client-supplied userId — only use auth-resolved identity
    let billingUserId: Id<"users"> | undefined = undefined;
    try {
      const authUserId = await getAuthUserId( ctx );
      if ( authUserId ) billingUserId = authUserId;
    } catch ( authErr ) {
      console.error( "mcpClient invokeMCPTool: auth resolution failed", {
        error: authErr instanceof Error ? authErr.message : String( authErr ),
      } );
      // billingUserId stays undefined — billing will be skipped for unauthenticated callers
    }

    try {
      // Get MCP server configuration from database
      const server = await ctx.runQuery( api.mcpConfig.getMCPServerByName, {
        serverName: args.serverName,
      } );

      if ( !server ) {
        // Log error
        await ctx.runMutation( api.errorLogging.logError, {
          category: "mcp",
          severity: "error",
          message: `MCP server "${args.serverName}" not found`,
          details: {
            serverName: args.serverName,
            toolName: args.toolName,
          },
          metadata: {
            serverName: args.serverName,
          },
        } );

        return {
          success: false,
          error: `MCP server "${args.serverName}" not found. Please configure the server first.`,
        };
      }

      if ( server.disabled ) {
        // Log warning
        await ctx.runMutation( api.errorLogging.logError, {
          category: "mcp",
          severity: "warning",
          message: `Attempted to invoke disabled MCP server "${args.serverName}"`,
          details: {
            serverName: args.serverName,
            toolName: args.toolName,
          },
          metadata: {
            serverName: args.serverName,
          },
        } );

        return {
          success: false,
          error: `MCP server "${args.serverName}" is disabled. Enable it in the MCP management panel.`,
        };
      }

      // Use server-specific timeout or provided timeout
      const timeout = args.timeout || server.timeout || 30000;

      // Gate: If this server routes to Bedrock (AgentCore), enforce tier access
      const isBedrockServer = server.name === "bedrock-agentcore-mcp-server" || args.toolName === "execute_agent";
      if ( isBedrockServer && billingUserId ) {
        const { requireBedrockAccessForUser } = await import( "./lib/bedrockGate" );
        const userDoc = await ctx.runQuery( internal.users.getInternal, { id: billingUserId } );
        const gateResult = await requireBedrockAccessForUser( userDoc, undefined );
        if ( !gateResult.allowed ) {
          return {
            success: false,
            error: gateResult.reason,
          };
        }
      } else if ( isBedrockServer && !billingUserId ) {
        // Unauthenticated caller trying to invoke Bedrock — block
        return {
          success: false,
          error: "Authentication required to use cloud AI models. Please sign in.",
        };
      }

      // Invoke tool with retry logic
      const result = await invokeMCPToolWithRetry(
        server,
        args.toolName,
        args.parameters,
        timeout,
        DEFAULT_RETRY_CONFIG
      );

      const executionTime = Date.now() - startTime;

      // Only update status for DB-backed servers — use the type guard exported from mcpConfig.
      if ( result.success ) {
        // Update server status on successful invocation
        if ( isDbMcpServer( server as any ) ) {
          await ctx.runMutation( api.mcpConfig.updateMCPServerStatus, {
            serverId: server._id as Id<"mcpServers">,
            status: "connected",
            lastConnected: Date.now(),
          } );
        }

        // Log successful invocation
        await ctx.runMutation( api.errorLogging.logAuditEvent, {
          eventType: "mcp_invocation",
          action: `invoke_${args.toolName}`,
          resource: "mcp_tool",
          resourceId: `${args.serverName}/${args.toolName}`,
          success: true,
          details: {
            serverName: args.serverName,
            toolName: args.toolName,
            executionTime,
          },
          metadata: {
            serverName: args.serverName,
            toolName: args.toolName,
          },
        } );

        // Meter Bedrock usage if billing user resolved and token data available (non-fatal)
        if (
          billingUserId &&
          result.result?.tokenUsage &&
          ( result.result.tokenUsage.inputTokens > 0 || result.result.tokenUsage.outputTokens > 0 )
        ) {
          try {
            await ctx.runMutation( internal.stripeMutations.incrementUsageAndReportOverage, {
              userId: billingUserId,
              modelId: result.result.model_id,
              inputTokens: result.result.tokenUsage.inputTokens,
              outputTokens: result.result.tokenUsage.outputTokens,
            } );
          } catch ( billingErr ) {
            console.error( "mcpClient invokeMCPTool: billing failed (non-fatal)", {
              userId: billingUserId, modelId: result.result.model_id,
              inputTokens: result.result.tokenUsage.inputTokens,
              outputTokens: result.result.tokenUsage.outputTokens,
              error: billingErr instanceof Error ? billingErr.message : billingErr,
            } );
          }
        }
      } else {
        // Log failed invocation
        await ctx.runMutation( api.errorLogging.logError, {
          category: "mcp",
          severity: "error",
          message: `MCP tool invocation failed: ${args.serverName}/${args.toolName}`,
          details: {
            serverName: args.serverName,
            toolName: args.toolName,
            error: result.error,
            executionTime,
          },
          metadata: {
            serverName: args.serverName,
          },
        } );

        // Update server status on failure (only for DB-backed servers)
        if ( isDbMcpServer( server as any ) ) {
          await ctx.runMutation( api.mcpConfig.updateMCPServerStatus, {
            serverId: server._id as Id<"mcpServers">,
            status: "error",
            lastError: result.error,
          } );
        }
      }

      // Return properly typed result with discriminated union
      if ( result.success ) {
        return {
          success: true,
          result: result.result,
          executionTime,
        };
      } else {
        return {
          success: false,
          error: result.error,
        };
      }
    } catch ( error: any ) {
      const executionTime = Date.now() - startTime;

      // Log exception
      await ctx.runMutation( api.errorLogging.logError, {
        category: "mcp",
        severity: "critical",
        message: `MCP tool invocation exception: ${args.serverName}/${args.toolName}`,
        details: {
          serverName: args.serverName,
          toolName: args.toolName,
          error: error.message || String( error ),
          executionTime,
        },
        stackTrace: error.stack,
        metadata: {
          serverName: args.serverName,
        },
      } );

      return {
        success: false,
        error: `Failed to invoke MCP tool: ${error.message || String( error )}`,
        executionTime,
      };
    }
  },
} );

/**
 * Internal function to invoke MCP tool with retry logic
 */
async function invokeMCPToolWithRetry(
  server: any,
  toolName: string,
  parameters: any,
  timeout: number,
  retryConfig: RetryConfig
): Promise<MCPToolResult> {
  let lastError: Error | null = null;
  const startTime = Date.now();

  for ( let attempt = 0; attempt <= retryConfig.maxRetries; attempt++ ) {
    try {
      // Add delay for retry attempts (not on first attempt)
      if ( attempt > 0 ) {
        const delay = calculateBackoffDelay( attempt - 1, retryConfig );
        await sleep( delay );
      }

      // Invoke the MCP tool
      const result = await invokeMCPToolDirect(
        server,
        toolName,
        parameters,
        timeout
      );

      return {
        success: true,
        result,
        executionTime: Date.now() - startTime,
      };
    } catch ( error: any ) {
      lastError = error;

      // Check if error is retryable
      if ( !isRetryableError( error ) ) {
        return {
          success: false,
          error: `Non-retryable error: ${error.message || String( error )}`,
        };
      }

      // If this was the last attempt, return the error
      if ( attempt === retryConfig.maxRetries ) {
        return {
          success: false,
          error: `Failed after ${retryConfig.maxRetries + 1} attempts: ${error.message || String( error )}`,
        };
      }
    }
  }

  return {
    success: false,
    error: `Failed after ${retryConfig.maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`,
  };
}

/**
 * Direct MCP tool invocation
 *
 * Transport routing:
 * - "direct" or Bedrock AgentCore → Direct API calls (no MCP protocol overhead)
 * - "sse" or "http" → MCP SDK with SSE/HTTP transport (cloud-compatible)
 * - "stdio" or undefined → MCP SDK with stdio transport (local dev only)
 */
async function invokeMCPToolDirect(
  server: any,
  toolName: string,
  parameters: any,
  timeout: number
): Promise<any> {
  // Special handling for Bedrock AgentCore (always direct)
  if ( server.name === "bedrock-agentcore-mcp-server" || toolName === "execute_agent" ) {
    return await invokeBedrockAgentCore( parameters, timeout );
  }

  const transportType: string = server.transportType || "stdio";

  // Direct API calls — bypass MCP protocol entirely for built-in servers
  if ( transportType === "direct" ) {
    return await invokeDirectAPI( server, toolName, parameters, timeout );
  }

  // SSE/HTTP transport — cloud-compatible, no subprocess spawning
  if ( transportType === "sse" || transportType === "http" ) {
    return await invokeMCPViaHTTP( server, toolName, parameters, timeout );
  }

  // Stdio transport — spawns subprocess, local dev only
  return await invokeMCPViaStdio( server, toolName, parameters, timeout );
}

/**
 * Invoke a built-in MCP server via direct HTTP/API calls (no MCP protocol)
 */
async function invokeDirectAPI(
  server: any,
  toolName: string,
  parameters: any,
  timeout: number
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout( () => controller.abort(), timeout );

  try {
    // Ollama: Direct REST API
    if ( server.name === "ollama-mcp-server" ) {
      const ollamaHost = server.env?.OLLAMA_HOST || "http://127.0.0.1:11434";
      if ( toolName === "chat_completion" ) {
        const resp = await fetch( `${ollamaHost}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify( { model: parameters.model, messages: parameters.messages, stream: false } ),
          signal: controller.signal,
        } );
        if ( !resp.ok ) throw new Error( `Ollama API error: ${resp.status} ${resp.statusText}` );
        return await resp.json();
      }
      if ( toolName === "list" ) {
        const resp = await fetch( `${ollamaHost}/api/tags`, { signal: controller.signal } );
        if ( !resp.ok ) throw new Error( `Ollama API error: ${resp.status} ${resp.statusText}` );
        return await resp.json();
      }
      if ( toolName === "show" ) {
        const resp = await fetch( `${ollamaHost}/api/show`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify( { name: parameters.name || parameters.model } ),
          signal: controller.signal,
        } );
        if ( !resp.ok ) throw new Error( `Ollama API error: ${resp.status} ${resp.statusText}` );
        return await resp.json();
      }
      throw new Error( `Unsupported Ollama tool: ${toolName}` );
    }

    // Document Fetcher: Direct fetch + HTML cleanup
    if ( server.name === "document-fetcher-mcp-server" ) {
      if ( toolName === "fetch_url" ) {
        const resp = await fetch( parameters.url, { signal: controller.signal } );
        if ( !resp.ok ) throw new Error( `Fetch error: ${resp.status} ${resp.statusText}` );
        const html = await resp.text();
        // Basic HTML → text cleanup (strip tags)
        const text = html.replace( /<script[^>]*>[\s\S]*?<\/script>/gi, "" )
          .replace( /<style[^>]*>[\s\S]*?<\/style>/gi, "" )
          .replace( /<[^>]+>/g, " " )
          .replace( /\s+/g, " " )
          .trim();
        return { content: text.slice( 0, 50000 ) }; // Cap at 50KB
      }
      throw new Error( `Unsupported document-fetcher tool: ${toolName}` );
    }

    throw new Error( `No direct API handler for server "${server.name}" tool "${toolName}"` );
  } finally {
    clearTimeout( timer );
  }
}

/**
 * Invoke MCP server via SSE/HTTP transport (cloud-compatible, no subprocess)
 */
async function invokeMCPViaHTTP(
  server: any,
  toolName: string,
  parameters: any,
  timeout: number
): Promise<any> {
  if ( !server.url ) {
    throw new Error( `MCP server "${server.name}" has transport "${server.transportType}" but no url configured` );
  }

  const { Client } = await import( "@modelcontextprotocol/sdk/client/index.js" );
  const { SSEClientTransport } = await import( "@modelcontextprotocol/sdk/client/sse.js" );

  let client: any = null;

  try {
    const transport = new SSEClientTransport( new URL( server.url ) );

    client = new Client(
      { name: "agent-builder-convex", version: "1.0.0" },
      { capabilities: {} },
    );

    await Promise.race( [
      client.connect( transport ),
      new Promise( ( _, reject ) =>
        setTimeout( () => reject( new Error( "MCP SSE connection timeout" ) ), timeout )
      ),
    ] );

    const result = await Promise.race( [
      client.callTool( { name: toolName, arguments: parameters } ),
      new Promise( ( _, reject ) =>
        setTimeout( () => reject( new Error( "MCP tool invocation timeout" ) ), timeout )
      ),
    ] );

    return result.content?.[0]?.text || result;
  } catch ( error: any ) {
    console.error( `MCP SSE invocation error (${server.name}/${toolName}):`, error );
    throw error;
  } finally {
    if ( client ) {
      try { await client.close(); } catch { /* ignore close errors */ }
    }
  }
}

/**
 * Invoke MCP server via stdio transport (local dev only — spawns subprocess)
 */
async function invokeMCPViaStdio(
  server: any,
  toolName: string,
  parameters: any,
  timeout: number
): Promise<any> {
  const { Client } = await import( "@modelcontextprotocol/sdk/client/index.js" );
  const { StdioClientTransport } = await import( "@modelcontextprotocol/sdk/client/stdio.js" );

  let client: any = null;

  try {
    const transport = new StdioClientTransport( {
      command: server.command,
      args: server.args || [],
      env: Object.fromEntries(
        Object.entries( { ...process.env, ...( server.env || {} ) } )
          .filter( ( entry ): entry is [string, string] => entry[1] !== undefined ),
      ),
    } );

    client = new Client(
      { name: "agent-builder-convex", version: "1.0.0" },
      { capabilities: {} },
    );

    await Promise.race( [
      client.connect( transport ),
      new Promise( ( _, reject ) =>
        setTimeout( () => reject( new Error( "MCP server connection timeout" ) ), timeout )
      ),
    ] );

    const toolsList = await client.listTools();
    const tool = toolsList.tools.find( ( t: any ) => t.name === toolName );
    if ( !tool ) {
      throw new Error(
        `Tool "${toolName}" not found. Available tools: ${toolsList.tools.map( ( t: any ) => t.name ).join( ", " )}`
      );
    }

    const result = await Promise.race( [
      client.callTool( { name: toolName, arguments: parameters } ),
      new Promise( ( _, reject ) =>
        setTimeout( () => reject( new Error( "MCP tool invocation timeout" ) ), timeout )
      ),
    ] );

    return result.content?.[0]?.text || result;
  } catch ( error: any ) {
    console.error( `MCP stdio invocation error (${server.name}/${toolName}):`, error );
    throw error;
  } finally {
    if ( client ) {
      try { await client.close(); } catch { /* ignore close errors */ }
    }
  }
}

/**
 * Invoke Bedrock AgentCore directly using AWS SDK
 */
/**
 * Invoke Bedrock AgentCore MCP Runtime with Cognito JWT authentication
 * This calls the actual MCP Runtime HTTP endpoint deployed via CloudFormation
 */
async function invokeBedrockAgentCore( parameters: any, timeout: number ): Promise<any> {
  try {
    // Get MCP Runtime endpoint from environment
    const runtimeEndpoint = process.env.AGENTCORE_MCP_RUNTIME_ENDPOINT;

    if ( !runtimeEndpoint ) {
      console.warn( "AGENTCORE_MCP_RUNTIME_ENDPOINT not set, falling back to direct Bedrock API" );
      return await invokeBedrockDirect( parameters, timeout );
    }

    // Get Cognito JWT token
    // Note: previously imported { api } here but it was unused — removed to avoid shadowing module-level api
    // In production, you'd inject the ctx or use a proper service
    const tokenResult = await fetch( `${process.env.CONVEX_SITE_URL}/api/cognitoAuth/getCachedCognitoToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    } ).then( r => r.json() ).catch( () => ( { success: false } ) );

    if ( !tokenResult.success || !tokenResult.token ) {
      throw new Error( "Failed to get Cognito JWT token" );
    }

    // Make HTTP request to MCP Runtime endpoint
    const response = await Promise.race( [
      fetch( `${runtimeEndpoint}/mcp/invoke`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${tokenResult.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify( {
          tool: "execute_agent",
          parameters: {
            code: parameters.code,
            input: parameters.input,
            model_id: parameters.model_id,
            system_prompt: parameters.system_prompt,
            conversation_history: parameters.conversation_history || [],
          },
        } ),
      } ),
      new Promise<never>( ( _, reject ) =>
        setTimeout( () => reject( new Error( "MCP Runtime invocation timeout" ) ), timeout )
      ),
    ] );

    if ( !response.ok ) {
      const errorText = await response.text();
      throw new Error( `MCP Runtime returned ${response.status}: ${errorText}` );
    }

    const result = await response.json();

    return result;
  } catch ( error: any ) {
    console.error( "Bedrock AgentCore MCP invocation failed:", error );
    throw new Error( `MCP Runtime invocation failed: ${error.message}` );
  }
}

/**
 * Fallback: Direct Bedrock API invocation (for when MCP Runtime is not configured)
 * @deprecated Use MCP Runtime instead
 */
async function invokeBedrockDirect( parameters: any, timeout: number ): Promise<any> {
  try {
    const { BedrockRuntimeClient, InvokeModelCommand } = await import( "@aws-sdk/client-bedrock-runtime" );

    const creds = (await import("./lib/aws/credentials")).validateAwsCredentials();

    const client = new BedrockRuntimeClient( {
      region: process.env.AWS_REGION || "us-east-1",
      credentials: creds || undefined,
    } );

    const modelId = parameters.model_id || process.env.AGENT_BUILDER_MODEL_ID || "deepseek.v3-v1:0";
    const input = parameters.input || "";
    const systemPrompt = parameters.system_prompt || "You are a helpful AI assistant.";
    const conversationHistory = parameters.conversation_history || [];

    // Build messages array from conversation history
    const messages: any[] = [];

    // Add conversation history
    for ( const msg of conversationHistory ) {
      messages.push( {
        role: msg.role === "assistant" ? "assistant" : "user",
        content: [{ text: msg.content }],
      } );
    }

    // Add current input
    messages.push( {
      role: "user",
      content: [{ text: input }],
    } );

    // Prepare request payload — anthropic_version header is only valid for Claude models
    const isClaudeModel = modelId.toLowerCase().startsWith( "anthropic." );
    const payload: Record<string, any> = {
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages,
      temperature: 0.7,
    };
    if ( isClaudeModel ) {
      payload.anthropic_version = "bedrock-2023-05-31";
    }

    const command = new InvokeModelCommand( {
      modelId: modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify( payload ),
    } );

    // Invoke with timeout
    const response: any = await Promise.race( [
      client.send( command ),
      new Promise( ( _, reject ) =>
        setTimeout( () => reject( new Error( "Bedrock invocation timeout" ) ), timeout )
      ),
    ] );

    // Parse response
    const responseBody = JSON.parse( new TextDecoder().decode( response.body ) );

    // Extract text from response
    const responseText = responseBody.content?.[0]?.text || JSON.stringify( responseBody );

    // Extract token usage for metering
    const { extractTokenUsage, estimateTokenUsage } = await import( "./lib/tokenBilling" );
    let tokenUsage = extractTokenUsage( responseBody, modelId );
    if ( tokenUsage.totalTokens === 0 ) {
      // Include full payload (system prompt + history + current input) for accurate estimate
      const fullInputText = [
        systemPrompt,
        ...conversationHistory.map( ( msg: any ) => `${msg.role}: ${msg.content}` ),
        input,
      ].filter( Boolean ).join( "\n" );
      tokenUsage = estimateTokenUsage( fullInputText, responseText );
    }

    return {
      response: responseText,
      model_id: modelId,
      usage: responseBody.usage || {},
      tokenUsage,
      stop_reason: responseBody.stop_reason,
    };
  } catch ( error: any ) {
    console.error( "Bedrock direct invocation failed:", error );
    throw new Error( `Bedrock invocation failed: ${error.message}` );
  }
}

/**
 * Determine if an error is retryable
 */
function isRetryableError( error: any ): boolean {
  const errorMessage = error.message?.toLowerCase() || '';

  // Network errors are retryable
  if (
    errorMessage.includes( 'timeout' ) ||
    errorMessage.includes( 'connection' ) ||
    errorMessage.includes( 'econnrefused' ) ||
    errorMessage.includes( 'enotfound' ) ||
    errorMessage.includes( 'network' )
  ) {
    return true;
  }

  // Server errors (5xx) are retryable
  if ( error.statusCode && error.statusCode >= 500 ) {
    return true;
  }

  // Rate limiting errors are retryable
  if ( error.statusCode === 429 ) {
    return true;
  }

  // Default: not retryable
  return false;
}

/**
 * Test MCP server connection
 *
 * This action attempts to connect to an MCP server and list its available tools.
 * It's useful for validating server configuration.
 */
export const testMCPServerConnection = action( {
  args: {
    serverName: v.string(),
  },
  handler: async ( ctx, args ) => {
    try {
      // Get server configuration
      const server = await ctx.runQuery( api.mcpConfig.getMCPServerByName, {
        serverName: args.serverName,
      } );

      if ( !server ) {
        return {
          success: false,
          status: "error",
          error: `MCP server "${args.serverName}" not found`,
        };
      }

      if ( server.disabled ) {
        return {
          success: false,
          status: "disabled",
          error: "Server is disabled",
        };
      }

      // Special case for Bedrock AgentCore - it's always available if AWS creds are set
      if ( server.name === "bedrock-agentcore-mcp-server" ) {
        if ( !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY ) {
          return {
            success: false,
            status: "error",
            error: "AWS credentials not configured",
          };
        }
        return {
          success: true,
          status: "connected",
          tools: [
            {
              name: "execute_agent",
              description: "Execute an agent in Bedrock AgentCore sandbox",
              inputSchema: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  input: { type: "string" },
                  model_id: { type: "string" },
                  system_prompt: { type: "string" },
                  conversation_history: { type: "array" },
                },
                required: ["code", "input"],
              },
            },
          ],
        };
      }

      // For other MCP servers, connect and list tools
      const transportType: string = server.transportType || "stdio";

      // Direct API servers — return their hardcoded tool list
      if ( transportType === "direct" ) {
        return {
          success: true,
          status: "connected",
          tools: server.availableTools || [],
        };
      }

      const { Client } = await import( "@modelcontextprotocol/sdk/client/index.js" );
      let client: any = null;
      let transport: any = null;

      try {
        if ( transportType === "sse" || transportType === "http" ) {
          if ( !server.url ) throw new Error( "SSE/HTTP server missing url" );
          const { SSEClientTransport } = await import( "@modelcontextprotocol/sdk/client/sse.js" );
          transport = new SSEClientTransport( new URL( server.url ) );
        } else {
          // stdio transport
          const { StdioClientTransport } = await import( "@modelcontextprotocol/sdk/client/stdio.js" );
          transport = new StdioClientTransport( {
            command: server.command,
            args: server.args || [],
            env: Object.fromEntries(
              Object.entries( { ...process.env, ...( server.env || {} ) } )
                .filter( ( entry ): entry is [string, string] => entry[1] !== undefined ),
            ),
          } );
        }

        client = new Client(
          { name: "agent-builder-convex", version: "1.0.0" },
          { capabilities: {} },
        );

        // Connect with 10 second timeout
        await Promise.race( [
          client.connect( transport ),
          new Promise( ( _, reject ) =>
            setTimeout( () => reject( new Error( "Connection timeout" ) ), 10000 )
          ),
        ] );

        const toolsList = await client.listTools();

        return {
          success: true,
          status: "connected",
          tools: toolsList.tools.map( ( tool: any ) => ( {
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          } ) ),
        };
      } finally {
        if ( client ) {
          try { await client.close(); } catch { /* ignore close errors */ }
        }
      }
    } catch ( error: any ) {
      return {
        success: false,
        status: "error",
        error: error.message || String( error ),
      };
    }
  },
} );
