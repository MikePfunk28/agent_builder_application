/**
 * Strands Agents Execution - Proper Integration with AgentCore Sandbox
 * Uses @app.entrypoint pattern like production deployments
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

type ConversationCreateResult = {
  conversationId: Id<"interleavedConversations">;
  conversationToken?: string;
};

type BedrockContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | { type: "tool_use"; id?: string; name?: string; input?: unknown }
  | { type: string; [key: string]: unknown };

type BedrockInvokeResponse = {
  content?: BedrockContentBlock[];
};

export const executeAgentWithStrandsAgents = action({
  args: {
    agentId: v.id("agents"),
    conversationId: v.optional(v.id("interleavedConversations")),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<AgentExecutionResult> => {
    try {
      const agent = (await ctx.runQuery(internal.strandsAgentExecution.getAgentInternal, {
        agentId: args.agentId,
      })) as AgentDoc | null;

      if (!agent) {
        throw new Error("Agent not found");
      }

      // Model gating: Check if user's tier allows the agent's model provider
      const { isProviderAllowedForTier, isBedrockModelAllowedForTier } = await import("./lib/tierConfig");
      const agentOwner = await ctx.runQuery(internal.users.getInternal, { id: agent.createdBy });
      const userTier = agentOwner?.tier || "freemium";
      const isBedrock = agent.deploymentType !== "ollama" && !agent.model.includes(":");
      if (isBedrock && !isProviderAllowedForTier(userTier, "bedrock")) {
        return {
          success: false,
          error: "Bedrock models require a Personal subscription ($5/month). " +
                 "Use local Ollama models for free, or upgrade in Settings → Billing.",
        };
      }
      if (isBedrock && !isBedrockModelAllowedForTier(userTier, agent.model)) {
        return {
          success: false,
          error: `Model ${agent.model} is not available on the ${userTier} tier. ` +
                 "Upgrade your subscription for access to this model.",
        };
      }

      let history: ConversationMessage[] = [];
      if (args.conversationId) {
        history = (await ctx.runQuery(internal.interleavedReasoning.getConversationHistory, {
          conversationId: args.conversationId,
          windowSize: 10,
        })) as ConversationMessage[];
      }

      return await executeViaAgentCore(ctx, agent, args.message, history);
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

async function executeViaAgentCore(
  ctx: ActionCtx,
  agent: AgentDoc,
  message: string,
  history: ConversationMessage[]
): Promise<AgentExecutionResult> {
  return await executeDirectBedrock(ctx, agent, message, history);
}

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

  let modelId = agent.model;
  if (!modelId.includes(":") && !modelId.startsWith("us.") && !modelId.startsWith("anthropic.")) {
    const modelMap: Record<string, string> = {
      "claude-3-5-sonnet-20241022": "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
      "claude-3-5-haiku-20241022": "us.anthropic.claude-3-5-haiku-20241022-v1:0",
      "claude-3-opus-20240229": "anthropic.claude-3-opus-20240229-v1:0",
    };
    modelId = modelMap[agent.model] || process.env.AGENT_BUILDER_MODEL_ID || "us.anthropic.claude-haiku-4-5-20251001-v1:0";
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
    },
  };
}

export const getAgentInternal = internalQuery({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args): Promise<AgentDoc | null> => {
    const agent = (await ctx.db.get(args.agentId)) as AgentDoc | null;
    return agent;
  },
});

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

    const conversation = (await ctx.runMutation(api.interleavedReasoning.createConversation, {
      title: "Agent Test",
      systemPrompt: "Test conversation",
    })) as ConversationCreateResult;

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
