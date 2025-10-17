import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

/**
 * MCP Client for invoking tools from configured MCP servers
 * 
 * This module provides a wrapper for communicating with MCP servers
 * using the Model Context Protocol. It handles connection management,
 * error handling, and retry logic.
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
        return {
          success: false,
          error: `MCP server "${args.serverName}" not found. Please configure the server first.`,
        };
      }

      if (server.disabled) {
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
      }

      return {
        ...result,
        executionTime,
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
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
 * Direct MCP tool invocation (placeholder for actual MCP protocol implementation)
 * 
 * TODO: Implement actual MCP protocol communication
 * This could use:
 * - MCP SDK if available
 * - Direct stdio communication with the MCP server process
 * - HTTP/WebSocket communication depending on server type
 */
async function invokeMCPToolDirect(
  server: any,
  toolName: string,
  _parameters: any,
  _timeout: number
): Promise<any> {
  // This is a placeholder implementation
  // In a real implementation, this would:
  // 1. Spawn the MCP server process (if not already running)
  // 2. Send a tool invocation request using MCP protocol
  // 3. Wait for the response with timeout
  // 4. Parse and return the result

  throw new Error(
    "MCP protocol implementation not yet available. " +
    "This requires integration with MCP SDK or direct protocol implementation. " +
    `Server: ${server.name}, Tool: ${toolName}`
  );
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

      // Try to list tools (this tests the connection)
      // TODO: Implement actual tool listing via MCP protocol
      // For now, return a placeholder response
      
      return {
        success: false,
        status: "error",
        error: "MCP protocol implementation not yet available",
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
