"use node";

/**
 * Ollama Direct API Integration for Agent Testing
 *
 * Calls Ollama HTTP API directly (no MCP server needed)
 * Provides FREE, unlimited testing for local models
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Test agent with Ollama model via MCP
 */
export const testAgentWithOllama = action({
  args: {
    agentId: v.id("agents"),
    modelName: v.string(), // e.g., "llama3.2:3b"
    testMessage: v.string(),
  },
  handler: async (ctx, { agentId, modelName, testMessage }) => {
    // Get agent configuration
    const agent = await ctx.runQuery(internal.agents.getInternal, { id: agentId });

    if (!agent) {
      throw new Error("Agent not found");
    }

    // Call Ollama via MCP
    const ollamaResponse = await callOllamaMCP({
      model: modelName,
      prompt: testMessage,
      systemPrompt: agent.systemPrompt || "",
    });

    return {
      success: true,
      model: modelName,
      response: ollamaResponse,
      agentId,
    };
  },
});

/**
 * List available Ollama models via MCP
 */
export const listOllamaModels = action({
  args: {},
  handler: async (ctx) => {
    try {
      // Call Ollama MCP to list models
      const response = await fetch("http://127.0.0.1:11434/api/tags");

      if (!response.ok) {
        return {
          success: false,
          error: "Ollama not running or not accessible",
          models: [],
        };
      }

      const data = await response.json();

      return {
        success: true,
        models: data.models || [],
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        models: [],
      };
    }
  },
});

/**
 * Check if Ollama is running
 */
export const checkOllamaStatus = action({
  args: {},
  handler: async (ctx) => {
    try {
      const response = await fetch("http://127.0.0.1:11434/api/tags");

      return {
        running: response.ok,
        endpoint: "http://127.0.0.1:11434",
      };
    } catch (error) {
      return {
        running: false,
        endpoint: "http://127.0.0.1:11434",
        error: "Ollama not accessible",
      };
    }
  },
});

/**
 * Execute chat completion with Ollama model
 */
export const chatWithOllama = action({
  args: {
    model: v.string(),
    messages: v.array(v.object({
      role: v.string(),
      content: v.string(),
    })),
    stream: v.optional(v.boolean()),
  },
  handler: async (ctx, { model, messages, stream = false }) => {
    try {
      const response = await fetch("http://127.0.0.1:11434/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          stream,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        message: data.message,
        model,
        done: data.done,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * Execute test with Ollama model - Main entry point for test execution
 * This is called by testExecution.ts when an Ollama model is detected
 */
export const executeOllamaTest = action({
  args: {
    testId: v.id("testExecutions"),
    agentCode: v.string(),
    testQuery: v.string(),
    model: v.string(),
    systemPrompt: v.optional(v.string()),
    timeout: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    try {
      // Update test status to RUNNING
      await ctx.runMutation(internal.testExecution.updateStatus, {
        testId: args.testId,
        status: "RUNNING",
      });

      // Add log
      await ctx.runMutation(internal.testExecution.appendLogs, {
        testId: args.testId,
        logs: [
          `[${new Date().toISOString()}] Starting Ollama test with model: ${args.model}`,
          `[${new Date().toISOString()}] Connecting to Ollama at http://127.0.0.1:11434`,
        ],
        timestamp: Date.now(),
      });

      // Build messages
      const messages: Array<{ role: string; content: string }> = [];

      if (args.systemPrompt) {
        messages.push({
          role: "system",
          content: args.systemPrompt,
        });
      }

      messages.push({
        role: "user",
        content: args.testQuery,
      });

      // Call Ollama HTTP API
      const response = await fetch("http://127.0.0.1:11434/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: args.model,
          messages,
          stream: false,
          options: {
            temperature: 0.7,
          },
        }),
        signal: AbortSignal.timeout(args.timeout || 180000),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const executionTime = Date.now() - startTime;

      // Add success log
      await ctx.runMutation(internal.testExecution.appendLogs, {
        testId: args.testId,
        logs: [
          `[${new Date().toISOString()}] Ollama response received`,
          `[${new Date().toISOString()}] Execution time: ${executionTime}ms`,
          `[${new Date().toISOString()}] Tokens - Prompt: ${data.prompt_eval_count || 0}, Completion: ${data.eval_count || 0}`,
        ],
        timestamp: Date.now(),
      });

      // Update test status to COMPLETED
      await ctx.runMutation(internal.testExecution.updateStatus, {
        testId: args.testId,
        status: "COMPLETED",
        success: true,
        response: data.message?.content || "",
      });

      return {
        success: true,
        response: data.message?.content || "",
        model: args.model,
        provider: "ollama",
        cost: 0, // FREE!
        executionTime,
        tokens: {
          prompt: data.prompt_eval_count || 0,
          completion: data.eval_count || 0,
          total: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      // Log error
      await ctx.runMutation(internal.testExecution.appendLogs, {
        testId: args.testId,
        logs: [
          `[${new Date().toISOString()}] ERROR: ${error.message}`,
          `[${new Date().toISOString()}] Execution time: ${executionTime}ms`,
        ],
        timestamp: Date.now(),
      });

      // Update test status to FAILED
      await ctx.runMutation(internal.testExecution.updateStatus, {
        testId: args.testId,
        status: "FAILED",
        success: false,
        error: error.message,
        errorStage: "ollama_execution",
      });

      return {
        success: false,
        error: error.message,
        model: args.model,
        provider: "ollama",
        executionTime,
      };
    }
  },
});

/**
 * Helper function to call Ollama API
 * Used by testAgentWithOllama for backwards compatibility
 */
async function callOllamaMCP(params: {
  model: string;
  prompt: string;
  systemPrompt?: string;
}) {
  const messages = [];

  if (params.systemPrompt) {
    messages.push({
      role: "system",
      content: params.systemPrompt,
    });
  }

  messages.push({
    role: "user",
    content: params.prompt,
  });

  const response = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.message?.content || "";
}
