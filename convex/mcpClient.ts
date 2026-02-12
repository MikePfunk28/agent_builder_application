"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

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
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig
): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelayMs);
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
export const invokeMCPToolInternal = internalAction({
  args: {
    serverName: v.string(),
    toolName: v.string(),
    parameters: v.any(),
    userId: v.optional(v.id("users")),
    timeout: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    try {
      // Get MCP server configuration from database (internal query)
      const server = await ctx.runQuery(internal.mcpConfig.getMCPServerByNameInternal, {
        serverName: args.serverName,
        userId: args.userId,
      });

      if (!server) {
        return {
          success: false,
          error: `MCP server "${args.serverName}" not found.`,
        };
      }

      if (server.disabled) {
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

      // Meter Bedrock usage if this was a direct Bedrock invocation with token data
      if (
        result.success &&
        args.userId &&
        result.result?.tokenUsage &&
        ( result.result.tokenUsage.inputTokens > 0 || result.result.tokenUsage.outputTokens > 0 )
      ) {
        await ctx.runMutation( internal.stripeMutations.incrementUsageAndReportOverage, {
          userId: args.userId,
          modelId: result.result.model_id,
          inputTokens: result.result.tokenUsage.inputTokens,
          outputTokens: result.result.tokenUsage.outputTokens,
        } );
      }

      // Return properly typed result
      if (result.success) {
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
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to invoke MCP tool: ${error.message || String(error)}`,
      };
    }
  },
});

export const invokeMCPTool = action({
  args: {
    serverName: v.string(),
    toolName: v.string(),
    parameters: v.any(),
    timeout: v.optional(v.number()), // Override timeout in milliseconds
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    try {
      // Get MCP server configuration from database
      const server = await ctx.runQuery(api.mcpConfig.getMCPServerByName, {
        serverName: args.serverName,
      });

      if (!server) {
        // Log error
        await ctx.runMutation(api.errorLogging.logError, {
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
        });

        return {
          success: false,
          error: `MCP server "${args.serverName}" not found. Please configure the server first.`,
        };
      }

      if (server.disabled) {
        // Log warning
        await ctx.runMutation(api.errorLogging.logError, {
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
        });

        return {
          success: false,
          error: `MCP server "${args.serverName}" is disabled. Enable it in the MCP management panel.`,
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

      if (result.success) {
        // Update server status on successful invocation
        await ctx.runMutation(api.mcpConfig.updateMCPServerStatus, {
          serverId: server._id,
          status: "connected",
          lastConnected: Date.now(),
        });

        // Log successful invocation
        await ctx.runMutation(api.errorLogging.logAuditEvent, {
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
        });
      } else {
        // Log failed invocation
        await ctx.runMutation(api.errorLogging.logError, {
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
        });

        // Update server status on failure
        await ctx.runMutation(api.mcpConfig.updateMCPServerStatus, {
          serverId: server._id,
          status: "error",
          lastError: result.error,
        });
      }

      // Return properly typed result with discriminated union
      if (result.success) {
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
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      // Log exception
      await ctx.runMutation(api.errorLogging.logError, {
        category: "mcp",
        severity: "critical",
        message: `MCP tool invocation exception: ${args.serverName}/${args.toolName}`,
        details: {
          serverName: args.serverName,
          toolName: args.toolName,
          error: error.message || String(error),
          executionTime,
        },
        stackTrace: error.stack,
        metadata: {
          serverName: args.serverName,
        },
      });

      return {
        success: false,
        error: `Failed to invoke MCP tool: ${error.message || String(error)}`,
        executionTime,
      };
    }
  },
});

/**
 * Internal function to invoke MCP tool with retry logic
 */
async function invokeMCPToolWithRetry(
  server: any,
  toolName: string,
  parameters: any,
  timeout: number,
  retryConfig: RetryConfig
): Promise<MCPToolInvocationResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      // Add delay for retry attempts (not on first attempt)
      if (attempt > 0) {
        const delay = calculateBackoffDelay(attempt - 1, retryConfig);
        await sleep(delay);
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
      };
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable
      if (!isRetryableError(error)) {
        return {
          success: false,
          error: `Non-retryable error: ${error.message || String(error)}`,
        };
      }

      // If this was the last attempt, return the error
      if (attempt === retryConfig.maxRetries) {
        return {
          success: false,
          error: `Failed after ${retryConfig.maxRetries + 1} attempts: ${error.message || String(error)}`,
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
 * For Bedrock AgentCore: Uses Bedrock Runtime API directly
 * For other MCP servers: Uses MCP SDK with stdio transport
 */
async function invokeMCPToolDirect(
  server: any,
  toolName: string,
  parameters: any,
  timeout: number
): Promise<any> {
  // Special handling for Bedrock AgentCore
  if (server.name === "bedrock-agentcore-mcp-server" || toolName === "execute_agent") {
    return await invokeBedrockAgentCore(parameters, timeout);
  }

  // For other MCP servers, use MCP SDK
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");

  let client: any = null;

  try {
    // Create stdio transport for the MCP server
    const transport = new StdioClientTransport({
      command: server.command,
      args: server.args || [],
      env: {
        ...process.env,
        ...(server.env || {}),
      },
    });

    // Create MCP client
    client = new Client(
      {
        name: "agent-builder-convex",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    // Connect to the server with timeout
    await Promise.race([
      client.connect(transport),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("MCP server connection timeout")), timeout)
      ),
    ]);

    // List available tools
    const toolsList = await client.listTools();

    // Find the requested tool
    const tool = toolsList.tools.find((t: any) => t.name === toolName);
    if (!tool) {
      throw new Error(
        `Tool "${toolName}" not found. Available tools: ${toolsList.tools.map((t: any) => t.name).join(", ")}`
      );
    }

    // Call the tool with timeout
    const result = await Promise.race([
      client.callTool({
        name: toolName,
        arguments: parameters,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("MCP tool invocation timeout")), timeout)
      ),
    ]);

    // Return the result content
    return result.content?.[0]?.text || result;
  } catch (error: any) {
    console.error(`MCP invocation error (${server.name}/${toolName}):`, error);
    throw error;
  } finally {
    // Clean up: close the client connection
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        console.error("Error closing MCP client:", closeError);
      }
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
async function invokeBedrockAgentCore(parameters: any, timeout: number): Promise<any> {
  try {
    // Get MCP Runtime endpoint from environment
    const runtimeEndpoint = process.env.AGENTCORE_MCP_RUNTIME_ENDPOINT;

    if (!runtimeEndpoint) {
      console.warn("AGENTCORE_MCP_RUNTIME_ENDPOINT not set, falling back to direct Bedrock API");
      return await invokeBedrockDirect(parameters, timeout);
    }

    // Get Cognito JWT token
    const { api } = await import("./_generated/api.js");

    // Import action runner - this is a workaround since we're in a non-Convex context
    // In production, you'd inject the ctx or use a proper service
    const tokenResult = await fetch(`${process.env.CONVEX_SITE_URL}/api/cognitoAuth/getCachedCognitoToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).then(r => r.json()).catch(() => ({ success: false }));

    if (!tokenResult.success || !tokenResult.token) {
      throw new Error("Failed to get Cognito JWT token");
    }

    // Make HTTP request to MCP Runtime endpoint
    const response = await Promise.race([
      fetch(`${runtimeEndpoint}/mcp/invoke`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${tokenResult.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool: "execute_agent",
          parameters: {
            code: parameters.code,
            input: parameters.input,
            model_id: parameters.model_id,
            system_prompt: parameters.system_prompt,
            conversation_history: parameters.conversation_history || [],
          },
        }),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("MCP Runtime invocation timeout")), timeout)
      ),
    ]);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MCP Runtime returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    return result;
  } catch (error: any) {
    console.error("Bedrock AgentCore MCP invocation failed:", error);
    throw new Error(`MCP Runtime invocation failed: ${error.message}`);
  }
}

/**
 * Fallback: Direct Bedrock API invocation (for when MCP Runtime is not configured)
 * @deprecated Use MCP Runtime instead
 */
async function invokeBedrockDirect(parameters: any, timeout: number): Promise<any> {
  try {
    const { BedrockRuntimeClient, InvokeModelCommand } = await import("@aws-sdk/client-bedrock-runtime");

    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    if ( ( accessKeyId && !secretAccessKey ) || ( secretAccessKey && !accessKeyId ) ) {
      throw new Error( "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must both be set or both be unset" );
    }

    const client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: accessKeyId && secretAccessKey
        ? { accessKeyId, secretAccessKey }
        : undefined,
    });

    const modelId = parameters.model_id || process.env.AGENT_BUILDER_MODEL_ID || "deepseek.v3-v1:0";
    const input = parameters.input || "";
    const systemPrompt = parameters.system_prompt || "You are a helpful AI assistant.";
    const conversationHistory = parameters.conversation_history || [];

    // Build messages array from conversation history
    const messages: any[] = [];

    // Add conversation history
    for (const msg of conversationHistory) {
      messages.push({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: [{ text: msg.content }],
      });
    }

    // Add current input
    messages.push({
      role: "user",
      content: [{ text: input }],
    });

    // Prepare request payload
    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages,
      temperature: 0.7,
    };

    const command = new InvokeModelCommand({
      modelId: modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    // Invoke with timeout
    const response: any = await Promise.race([
      client.send(command),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Bedrock invocation timeout")), timeout)
      ),
    ]);

    // Parse response
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Extract text from response
    const responseText = responseBody.content?.[0]?.text || JSON.stringify(responseBody);

    // Extract token usage for metering
    const { extractTokenUsage, estimateTokenUsage } = await import( "./lib/tokenBilling" );
    let tokenUsage = extractTokenUsage( responseBody, modelId );
    if ( tokenUsage.totalTokens === 0 ) {
      tokenUsage = estimateTokenUsage( input, responseText );
    }

    return {
      response: responseText,
      model_id: modelId,
      usage: responseBody.usage || {},
      tokenUsage,
      stop_reason: responseBody.stop_reason,
    };
  } catch (error: any) {
    console.error("Bedrock direct invocation failed:", error);
    throw new Error(`Bedrock invocation failed: ${error.message}`);
  }
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: any): boolean {
  const errorMessage = error.message?.toLowerCase() || '';
  
  // Network errors are retryable
  if (
    errorMessage.includes('timeout') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('enotfound') ||
    errorMessage.includes('network')
  ) {
    return true;
  }

  // Server errors (5xx) are retryable
  if (error.statusCode && error.statusCode >= 500) {
    return true;
  }

  // Rate limiting errors are retryable
  if (error.statusCode === 429) {
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
export const testMCPServerConnection = action({
  args: {
    serverName: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Get server configuration
      const server = await ctx.runQuery(api.mcpConfig.getMCPServerByName, {
        serverName: args.serverName,
      });

      if (!server) {
        return {
          success: false,
          status: "error",
          error: `MCP server "${args.serverName}" not found`,
        };
      }

      if (server.disabled) {
        return {
          success: false,
          status: "disabled",
          error: "Server is disabled",
        };
      }

      // Special case for Bedrock AgentCore - it's always available if AWS creds are set
      if (server.name === "bedrock-agentcore-mcp-server") {
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
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
      const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
      const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");

      let client: any = null;

      try {
        const transport = new StdioClientTransport({
          command: server.command,
          args: server.args || [],
          env: {
            ...process.env,
            ...(server.env || {}),
          },
        });

        client = new Client(
          {
            name: "agent-builder-convex",
            version: "1.0.0",
          },
          {
            capabilities: {},
          }
        );

        // Connect with 10 second timeout
        await Promise.race([
          client.connect(transport),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Connection timeout")), 10000)
          ),
        ]);

        // List available tools
        const toolsList = await client.listTools();

        return {
          success: true,
          status: "connected",
          tools: toolsList.tools.map((tool: any) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          })),
        };
      } finally {
        if (client) {
          try {
            await client.close();
          } catch (closeError) {
            console.error("Error closing test client:", closeError);
          }
        }
      }
    } catch (error: any) {
      return {
        success: false,
        status: "error",
        error: error.message || String(error),
      };
    }
  },
});
