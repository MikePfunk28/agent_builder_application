/**
 * Strands Agents Execution with Dynamic Model Switching
 * Automatically selects the best model based on conversation complexity
 */

import { action, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  analyzeComplexity,
  calculateComplexityScore,
  selectModel,
  decideModelSwitch,
  type ModelSwitchDecision,
} from "./lib/dynamicModelSwitching";

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
  modelSwitchDecision?: ModelSwitchDecision;
  originalModel?: string;
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

type BedrockContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | { type: "tool_use"; id?: string; name?: string; input?: unknown }
  | { type: string; [key: string]: unknown };

type BedrockInvokeResponse = {
  content?: BedrockContentBlock[];
};

/**
 * Execute agent with dynamic model switching
 */
export const executeAgentWithDynamicModel = action({
  args: {
    agentId: v.id("agents"),
    conversationId: v.optional(v.id("interleavedConversations")),
    message: v.string(),
    enableModelSwitching: v.optional(v.boolean()),
    preferCost: v.optional(v.boolean()),
    preferSpeed: v.optional(v.boolean()),
    preferCapability: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<AgentExecutionResult> => {
    try {
      const agent = (await ctx.runQuery(internal.strandsAgentExecution.getAgentInternal, {
        agentId: args.agentId,
      })) as AgentDoc | null;

      if (!agent) {
        throw new Error("Agent not found");
      }

      // Get conversation history
      let history: ConversationMessage[] = [];
      if (args.conversationId) {
        history = (await ctx.runQuery(internal.interleavedReasoning.getConversationHistory, {
          conversationId: args.conversationId,
          windowSize: 10,
        })) as ConversationMessage[];
      }

      // Get user tier for model switching decisions
      const user = await ctx.runQuery(internal.users.getInternal, { id: agent.createdBy });
      const userTier = (user?.tier as "freemium" | "personal" | "enterprise") || "freemium";

      // Execute with or without dynamic model switching
      if (args.enableModelSwitching !== false) {
        return await executeWithModelSwitching(ctx, agent, args.message, history, {
          preferCost: args.preferCost,
          preferSpeed: args.preferSpeed,
          preferCapability: args.preferCapability,
          userTier,
        });
      } else {
        return await executeDirectBedrock(ctx, agent, args.message, history, undefined);
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
 * Execute with dynamic model switching
 */
async function executeWithModelSwitching(
  ctx: ActionCtx,
  agent: AgentDoc,
  message: string,
  history: ConversationMessage[],
  options: {
    preferCost?: boolean;
    preferSpeed?: boolean;
    preferCapability?: boolean;
    userTier: "freemium" | "personal" | "enterprise";
  }
): Promise<AgentExecutionResult> {
  // Convert conversation history to simple format for analysis
  const historyForAnalysis = history.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  // Make model switching decision
  const decision = decideModelSwitch(message, historyForAnalysis, agent, options);

  console.log(`[ModelSwitcher] Complexity: ${decision.complexityScore}/100`);
  console.log(`[ModelSwitcher] Selected: ${decision.selectedModel.name}`);
  console.log(`[ModelSwitcher] Reasoning: ${decision.reasoning}`);
  console.log(`[ModelSwitcher] Estimated cost: $${decision.estimatedCost.toFixed(4)}`);

  // Execute with selected model
  const result = await executeDirectBedrock(
    ctx,
    agent,
    message,
    history,
    decision.selectedModel.modelId
  );

  // Add decision metadata to result
  if (result.success && result.metadata) {
    result.metadata.modelSwitchDecision = decision;
    result.metadata.originalModel = agent.model;
  }

  return result;
}

/**
 * Execute via direct Bedrock API
 */
async function executeDirectBedrock(
  ctx: ActionCtx,
  agent: AgentDoc,
  message: string,
  history: ConversationMessage[],
  overrideModelId?: string
): Promise<AgentExecutionResult> {
  const { BedrockRuntimeClient, InvokeModelCommand } = await import(
    "@aws-sdk/client-bedrock-runtime"
  );

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

  // Use override model if provided, otherwise use agent's model
  let modelId = overrideModelId || agent.model;

  // Normalize model ID
  if (!modelId.includes(":") && !modelId.startsWith("us.") && !modelId.startsWith("anthropic.")) {
    const modelMap: Record<string, string> = {
      "claude-3-5-sonnet-20241022": "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
      "claude-3-5-haiku-20241022": "us.anthropic.claude-3-5-haiku-20241022-v1:0",
      "claude-3-opus-20240229": "anthropic.claude-3-opus-20240229-v1:0",
    };
    modelId = modelMap[modelId] || process.env.AGENT_BUILDER_MODEL_ID || "us.anthropic.claude-haiku-4-5-20250514-v1:0";
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
  const responseBody = JSON.parse(new TextDecoder().decode(response.body)) as BedrockInvokeResponse;

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
