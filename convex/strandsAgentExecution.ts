/**
 * Strands Agents Execution - Proper Integration with AgentCore
 *
 * This module executes agents using the strands-agents framework via AgentCore MCP Runtime.
 * It supports both Bedrock and Ollama models through the bedrock-agentcore-mcp-server.
 */

import { action, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

type AgentDoc = Doc<"agents">;

type ConversationMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: number;
  reasoning?: string;
  toolCalls?: unknown;
};

type ToolCall = {
  id?: string;
  name?: string;
  input?: unknown;
};

type AgentExecutionMetadata = {
  model: string;
  modelProvider: string;
  executionMethod: "agentcore" | "direct-bedrock-api";
  mcpServersUsed?: number;
  warning?: string;
};

interface AgentExecutionBase {
  success: boolean;
  metadata?: AgentExecutionMetadata;
  content?: string;
  error?: string;
  reasoning?: string;
  toolCalls?: ToolCall[];
}

type AgentExecutionSuccess = AgentExecutionBase & {
  success: true;
  content: string;
  reasoning?: string;
  toolCalls?: ToolCall[];
};

type AgentExecutionFailure = AgentExecutionBase & {
  success: false;
  error: string;
};

type AgentExecutionResult = AgentExecutionSuccess | AgentExecutionFailure;

type CognitoTokenResult = {
  success: boolean;
  token?: string;
  expiresAt?: number;
  error?: string;
};

type ConversationCreateResult = {
  conversationId: Id<"interleavedConversations">;
  conversationToken?: string;
};

type AgentCoreInvokeResponse = {
  response?: string;
  content?: string;
  reasoning?: string;
  tool_calls?: ToolCall[];
  metadata?: Partial<AgentExecutionMetadata>;
};

type BedrockContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | { type: "tool_use"; id?: string; name?: string; input?: unknown }
  | { type: string; [key: string]: unknown };

type BedrockInvokeResponse = {
  content?: BedrockContentBlock[];
};

function normalizeToolCalls(toolCalls: unknown): ToolCall[] | undefined {
  if (!Array.isArray(toolCalls)) {
    return undefined;
  }

  const normalized: ToolCall[] = [];
  for (const call of toolCalls) {
    if (call && typeof call === "object") {
      const castCall = call as Record<string, unknown>;
      normalized.push({
        id: typeof castCall.id === "string" ? castCall.id : undefined,
        name: typeof castCall.name === "string" ? castCall.name : undefined,
        input: castCall.input,
      });
    }
  }
  return normalized.length > 0 ? normalized : undefined;
}

/**
 * Execute an agent using strands-agents framework via AgentCore
 *
 * This properly:
 * 1. Loads the agent's generated code (which uses @agent decorator)
 * 2. Calls MCP Runtime endpoint with Cognito JWT auth
 * 3. Uses execute_agent tool from bedrock-agentcore-mcp-server
 * 4. Handles conversation history and context
 * 5. Supports both Bedrock and Ollama models
 */
export const executeAgentWithStrandsAgents = action({
  args: {
    agentId: v.id("agents"),
    conversationId: v.optional(v.id("interleavedConversations")),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<AgentExecutionResult> => {
    try {
      // 1. Load agent configuration
      const agent = (await ctx.runQuery(internal.strandsAgentExecution.getAgentInternal, {
        agentId: args.agentId,
      })) as AgentDoc | null;

      if (!agent) {
        throw new Error("Agent not found");
      }

      // 2. Get conversation history (sliding window)
      // If no conversationId provided, use empty history
      let history: ConversationMessage[] = [];
      if (args.conversationId) {
        history = (await ctx.runQuery(internal.interleavedReasoning.getConversationHistory, {
          conversationId: args.conversationId,
          windowSize: 10, // Last 10 messages
        })) as ConversationMessage[];
      }

      // 3. Determine execution method based on deployment type and tier
      const useAgentCore = shouldUseAgentCore(agent);

      if (useAgentCore) {
        // Use AgentCore MCP Runtime (proper strands-agents execution)
        return await executeViaAgentCore(ctx, agent, args.message, history);
      } else {
        // Fallback to direct Bedrock API (for testing without AgentCore)
        return await executeDirectBedrock(ctx, agent, args.message, history);
      }
    } catch (error: unknown) {
      console.error("Agent execution error:", error);
      const message = error instanceof Error ? error.message : "Agent execution failed";
      return {
        success: false,
        error: message,
      };
    }
  },
});

/**
 * Execute agent via AgentCore MCP Runtime
 * This is the CORRECT way - actually uses strands-agents and @agent decorator
 */
async function executeViaAgentCore(
  ctx: ActionCtx,
  agent: AgentDoc,
  message: string,
  history: ConversationMessage[]
): Promise<AgentExecutionResult> {
  // Get MCP Runtime endpoint
  const runtimeEndpoint = process.env.AGENTCORE_MCP_RUNTIME_ENDPOINT;

  if (!runtimeEndpoint) {
    console.warn("AGENTCORE_MCP_RUNTIME_ENDPOINT not configured, falling back to direct Bedrock");
    return await executeDirectBedrock(ctx, agent, message, history);
  }

  // Get Cognito JWT token for authentication
  const tokenResult = (await ctx.runAction(api.cognitoAuth.getCachedCognitoToken, {})) as CognitoTokenResult;

  if (!tokenResult.success || !tokenResult.token) {
    throw new Error("Failed to get Cognito authentication token");
  }

  // Format conversation history for strands-agents
  const conversationHistory = history.map((msg) => ({
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp,
  }));

  // Prepare MCP servers configuration from agent
  const mcpServers = agent.mcpServers || [];

  // Call AgentCore with the @app.entrypoint pattern
  // AgentCore deploys the Python code and invokes the entrypoint function
  const response = await fetch(`${runtimeEndpoint}/invoke`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${tokenResult.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // Payload passed to @app.entrypoint function
      payload: {
        prompt: message,
        conversation_history: conversationHistory,
        context: {
          agent_id: agent._id,
          model: agent.model,
          model_provider: agent.modelProvider || "bedrock",
        },
      },

      // Agent deployment info (AgentCore needs to know which agent to run)
      agent_code: agent.generatedCode, // The code with @app.entrypoint
      mcp_servers: mcpServers, // MCP servers available to the agent
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AgentCore execution failed: ${response.status} ${errorText}`);
  }

  const result = (await response.json()) as AgentCoreInvokeResponse;

  const metadata: AgentExecutionMetadata = {
    model: agent.model,
    modelProvider: agent.modelProvider || "bedrock",
    executionMethod: "agentcore",
    mcpServersUsed: mcpServers.length,
  };

  if (result.metadata) {
    metadata.mcpServersUsed ??= result.metadata.mcpServersUsed;
    metadata.warning ??= result.metadata.warning;
  }

  return {
    success: true,
    content: result.response || result.content || "",
    reasoning: result.reasoning,
    toolCalls: result.tool_calls,
    metadata,
  };
}

/**
 * Fallback: Execute directly via Bedrock API (bypasses strands-agents)
 * This is NOT ideal but works when AgentCore is not available
 */
async function executeDirectBedrock(
  ctx: ActionCtx,
  agent: AgentDoc,
  message: string,
  history: ConversationMessage[]
): Promise<AgentExecutionResult> {
  const { BedrockRuntimeClient, InvokeModelCommand } =
    await import("@aws-sdk/client-bedrock-runtime");

  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  // Build messages array
  const messages: Array<{ role: string; content: Array<{ text: string }> }> = [];

  for (const msg of history) {
    messages.push({
      role: msg.role,
      content: [{ text: msg.content }],
    });
  }

  messages.push({
    role: "user",
    content: [{ text: message }],
  });

  // Determine model ID based on agent configuration
  let modelId = agent.model;
  if (!modelId.includes(":") && !modelId.startsWith("us.") && !modelId.startsWith("anthropic.")) {
    // Map common model names to Bedrock model IDs
    const modelMap: Record<string, string> = {
      "claude-3-5-sonnet-20241022": "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
      "claude-3-5-haiku-20241022": "us.anthropic.claude-3-5-haiku-20241022-v1:0",
      "claude-3-opus-20240229": "anthropic.claude-3-opus-20240229-v1:0",
    };
    modelId = modelMap[agent.model] || "us.anthropic.claude-3-5-haiku-20241022-v1:0";
  }

  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 4096,
    system: agent.systemPrompt,
    messages: messages,
    temperature: 1,
    thinking: {
      type: "enabled",
      budget_tokens: 3000,
    },
  };

  const command = new InvokeModelCommand({
    modelId: modelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(payload),
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(
    new TextDecoder().decode(response.body)
  ) as BedrockInvokeResponse;

  let content = "";
  let reasoning = "";
  const toolCalls: ToolCall[] = [];

  for (const block of responseBody.content || []) {
    if (block.type === "text") {
      content += block.text;
    } else if (block.type === "thinking") {
      reasoning += block.thinking;
    } else if (block.type === "tool_use") {
      const id = typeof block.id === "string" ? block.id : undefined;
      const name = typeof block.name === "string" ? block.name : undefined;
      toolCalls.push({
        id,
        name,
        input: block.input,
      });
    }
  }

  return {
    success: true,
    content: content.trim(),
    reasoning: reasoning.trim() || undefined,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    metadata: {
      model: modelId,
      modelProvider: "bedrock",
      executionMethod: "direct-bedrock-api",
      warning: "Not using strands-agents framework - MCP servers ignored",
    },
  };
}

/**
 * Determine if we should use AgentCore for execution
 */
function shouldUseAgentCore(agent: AgentDoc): boolean {
  // Check if runtime endpoint is configured
  if (!process.env.AGENTCORE_MCP_RUNTIME_ENDPOINT) {
    return false;
  }

  // Always prefer AgentCore when available
  // It properly executes the @agent decorated code
  return true;
}

/**
 * Internal query to get agent (for use within actions)
 */
export const getAgentInternal = internalQuery({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args): Promise<AgentDoc | null> => {
    const agent = (await ctx.db.get(args.agentId)) as AgentDoc | null;
    return agent;
  },
});

/**
 * Test agent execution with sample input
 * Useful for verifying both Bedrock and Ollama models work
 */
export const testAgentExecution = action({
  args: {
    agentId: v.id("agents"),
    testMessage: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<
    AgentExecutionResult & {
      testMessage: string;
      conversationId: Id<"interleavedConversations">;
    }
  > => {
    const testMessage = args.testMessage || "Hello! Please introduce yourself and list your available tools.";

    // Create temporary conversation for testing
    const conversation = (await ctx.runMutation(api.interleavedReasoning.createConversation, {
      title: "Agent Test",
      systemPrompt: "Test conversation",
    })) as ConversationCreateResult;

    // Execute agent
    const result = (await ctx.runAction(api.strandsAgentExecution.executeAgentWithStrandsAgents, {
      agentId: args.agentId,
      conversationId: conversation.conversationId,
      message: testMessage,
    })) as AgentExecutionResult;

    return {
      ...result,
      testMessage,
      conversationId: conversation.conversationId,
    };
  },
});
