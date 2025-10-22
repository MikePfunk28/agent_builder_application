/**
 * Interleaved Reasoning with Claude Haiku 4.5
 * Implements conversation management with sliding window and context storage
 */

import { action, mutation, query, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";

const MAX_CONTEXT_SIZE = 100000; // 100KB - store in Convex
const S3_THRESHOLD = 50000; // 50KB - move to S3 if larger
const SLIDING_WINDOW_SIZE = 10; // Keep last 10 messages in active window

/**
 * Create a new conversation with interleaved reasoning
 */
export const createConversation = mutation({
  args: {
    title: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    
    // Generate token for anonymous users
    const conversationToken = userId 
      ? undefined 
      : `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const conversationId = await ctx.db.insert("interleavedConversations", {
      userId: userId || undefined,
      conversationToken,
      title: args.title || "New Agent",
      systemPrompt: args.systemPrompt || `You are an expert AI Agent Architect and Implementation Specialist.

YOUR MISSION: Build the best possible AI agent for the user's requirements.

YOU HAVE UNLIMITED CAPABILITIES to accomplish this:
- Web search and research for best practices
- Code compilation and analysis
- File system operations and context building
- Database creation (JSON, SQLite, etc.)
- API integration and testing
- Custom tool creation with @tool decorator
- Architecture design and optimization
- Performance and cost analysis

YOUR WORKFLOW:
1. Deeply understand requirements through questions
2. Research and analyze best approaches
3. Design optimal agent architecture
4. Create necessary tools and integrations
5. Generate complete, production-ready code
6. Validate implementation quality

AGENT BUILDING PRINCIPLES:
- Build intelligent, workflow-oriented agents (not simple chatbots)
- Create custom tools when needed using @tool decorator
- Include preprocessing/postprocessing hooks for complex logic
- Generate ALL 4 required files: agent.py, mcp.json, Dockerfile, cloudformation.yaml
- Ensure production-ready code with error handling and logging
- Optimize for performance, cost, and scalability

Think deeply, research thoroughly, and build exceptional agents.`,
      messages: [],
      contextSize: 0,
      s3ContextKey: undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: true,
    });

    return { conversationId, conversationToken };
  },
});

/**
 * Send a message with interleaved reasoning
 */
export const sendMessage: any = action({
  args: {
    conversationId: v.id("interleavedConversations"),
    conversationToken: v.optional(v.string()),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    // GUARDRAILS: Validate message content
    const { validateMessage, checkRateLimits, checkCostLimits, calculateMessageCost } = await import("./guardrails");
    
    const messageValidation = validateMessage(args.message);
    if (!messageValidation.allowed) {
      throw new Error(`Message blocked: ${messageValidation.reason}`);
    }

    // Get conversation
    const conversation = await ctx.runQuery(internal.interleavedReasoning.getConversationInternal, {
      conversationId: args.conversationId,
      userId: userId || undefined,
      conversationToken: args.conversationToken,
    });

    if (!conversation) {
      throw new Error("Conversation not found or access denied");
    }

    // GUARDRAILS: Check rate limits
    const userKey = userId || args.conversationToken || "anonymous";
    const messageCount = await ctx.runQuery(internal.interleavedReasoning.getUserMessageCount, {
      userId: userId || undefined,
      conversationToken: args.conversationToken,
      timeWindow: 60 * 60 * 1000, // 1 hour
    });

    const rateLimitCheck = checkRateLimits(userKey, messageCount, 60 * 60 * 1000);
    if (!rateLimitCheck.allowed) {
      throw new Error(rateLimitCheck.reason!);
    }

    // GUARDRAILS: Estimate cost
    const estimatedInputTokens = Math.ceil(args.message.length / 4); // Rough estimation
    const estimatedCost = calculateMessageCost(estimatedInputTokens, 1000, 3000); // Conservative estimate

    const userCostToday = await ctx.runQuery(internal.interleavedReasoning.getUserCostToday, {
      userId: userId || undefined,
      conversationToken: args.conversationToken,
    });

    const costCheck = checkCostLimits(estimatedCost, userCostToday, userCostToday);

    if (!costCheck.allowed) {
      throw new Error(costCheck.reason!);
    }

    // Add user message to conversation
    await ctx.runMutation(internal.interleavedReasoning.addMessage, {
      conversationId: args.conversationId,
      role: "user",
      content: args.message,
    });

    // Get conversation history with sliding window
    const history = await ctx.runQuery(internal.interleavedReasoning.getConversationHistory, {
      conversationId: args.conversationId,
      windowSize: SLIDING_WINDOW_SIZE,
    });

    // If conversation has an associated agent, use strands-agents execution
    // Otherwise, fall back to direct Claude invocation
    let response;
    if (conversation.agentId) {
      // Use strands-agents framework via AgentCore
      const agentResult = await ctx.runAction(api.strandsAgentExecution.executeAgentWithStrandsAgents, {
        agentId: conversation.agentId,
        conversationId: args.conversationId,
        message: args.message,
      });

      if (!agentResult.success) {
        throw new Error(agentResult.error || "Agent execution failed");
      }

      response = {
        content: agentResult.content,
        reasoning: agentResult.reasoning,
        toolCalls: agentResult.toolCalls,
      };
    } else {
      // Fall back to direct Claude Haiku 4.5 with interleaved thinking
      response = await invokeClaudeWithInterleavedThinking(
        conversation.systemPrompt,
        history,
        args.message
      );
    }

    // Add assistant response to conversation
    await ctx.runMutation(internal.interleavedReasoning.addMessage, {
      conversationId: args.conversationId,
      role: "assistant",
      content: response.content,
      reasoning: response.reasoning,
      toolCalls: response.toolCalls,
    });

    // Check if context needs to be moved to S3
    const contextSize = await ctx.runQuery(internal.interleavedReasoning.getContextSize, {
      conversationId: args.conversationId,
    });

    if (contextSize > S3_THRESHOLD) {
      await ctx.runAction(internal.interleavedReasoning.moveContextToS3, {
        conversationId: args.conversationId,
      });
    }

    return {
      response: response.content,
      reasoning: response.reasoning,
      toolCalls: response.toolCalls,
    };
  },
});

/**
 * Internal helper: count user messages within a time window
 */
export const getUserMessageCount = internalQuery({
  args: {
    userId: v.optional(v.id("users")),
    conversationToken: v.optional(v.string()),
    timeWindow: v.number(),
  },
  handler: async (ctx, args) => {
    const since = Date.now() - args.timeWindow;
    let conversations: any[] = [];

    if (args.userId) {
      conversations = await ctx.db
        .query("interleavedConversations")
        .withIndex("by_user", (q) => q.eq("userId", args.userId!))
        .collect();
    } else if (args.conversationToken) {
      const conversation = await ctx.db
        .query("interleavedConversations")
        .withIndex("by_token", (q) => q.eq("conversationToken", args.conversationToken!))
        .first();
      if (conversation) {
        conversations = [conversation];
      }
    }

    if (conversations.length === 0) {
      return 0;
    }

    let count = 0;
    for (const conversation of conversations) {
      const messages: any[] = conversation.messages || [];
      for (const message of messages) {
        if (message.timestamp && message.timestamp >= since) {
          count += 1;
        }
      }
    }

    return count;
  },
});

/**
 * Internal helper: aggregate user cost for current day
 * Currently returns 0 until detailed cost tracking is implemented.
 */
export const getUserCostToday = internalQuery({
  args: {
    userId: v.optional(v.id("users")),
    conversationToken: v.optional(v.string()),
  },
  handler: async () => {
    // Cost tracking is not yet implemented; return 0 so guardrails remain permissive.
    return 0;
  },
});

/**
 * Invoke Claude Haiku 4.5 with interleaved thinking
 */
async function invokeClaudeWithInterleavedThinking(
  systemPrompt: string,
  history: any[],
  userMessage: string
): Promise<{ content: string; reasoning?: string; toolCalls?: any[] }> {
  const { BedrockRuntimeClient, InvokeModelCommand } = await import("@aws-sdk/client-bedrock-runtime");

  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  // Build messages array
  const messages: any[] = [];
  
  // Add conversation history
  for (const msg of history) {
    messages.push({
      role: msg.role,
      content: [{ text: msg.content }],
    });
  }

  // Add current user message
  messages.push({
    role: "user",
    content: [{ text: userMessage }],
  });

  // Prepare request with interleaved thinking enabled
  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 4096,
    system: systemPrompt,
    messages: messages,
    temperature: 1, // Required for interleaved thinking
    // Enable interleaved thinking
    thinking: {
      type: "enabled",
      budget_tokens: 3000,
    },
  };

  const command = new InvokeModelCommand({
    modelId: "us.anthropic.claude-3-5-haiku-20241022-v1:0", // Claude Haiku 4.5
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(payload),
  });

  const response: any = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  // Extract content and reasoning
  let content = "";
  let reasoning = "";
  const toolCalls: any[] = [];

  for (const block of responseBody.content || []) {
    if (block.type === "text") {
      content += block.text;
    } else if (block.type === "thinking") {
      reasoning += block.thinking;
    } else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        name: block.name,
        input: block.input,
      });
    }
  }

  return {
    content: content.trim(),
    reasoning: reasoning.trim() || undefined,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  };
}

/**
 * Add message to conversation (internal)
 */
export const addMessage = internalMutation({
  args: {
    conversationId: v.id("interleavedConversations"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    reasoning: v.optional(v.string()),
    toolCalls: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const message = {
      role: args.role,
      content: args.content,
      reasoning: args.reasoning,
      toolCalls: args.toolCalls,
      timestamp: Date.now(),
    };

    const messages = [...conversation.messages, message];
    const contextSize = JSON.stringify(messages).length;

    await ctx.db.patch(args.conversationId, {
      messages,
      contextSize,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Get conversation history with sliding window (internal)
 */
export const getConversationHistory = internalQuery({
  args: {
    conversationId: v.id("interleavedConversations"),
    windowSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return [];
    }

    const windowSize = args.windowSize || SLIDING_WINDOW_SIZE;
    const messages = conversation.messages || [];

    // Return last N messages (sliding window)
    return messages.slice(-windowSize);
  },
});

/**
 * Get conversation (internal - no auth check)
 */
export const getConversationInternal = internalQuery({
  args: {
    conversationId: v.id("interleavedConversations"),
    userId: v.optional(v.id("users")),
    conversationToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return null;
    }

    // Check access: either user owns it or has the token
    if (args.userId && conversation.userId === args.userId) {
      return conversation;
    }

    if (args.conversationToken && conversation.conversationToken === args.conversationToken) {
      return conversation;
    }

    return null;
  },
});

/**
 * Get context size (internal)
 */
export const getContextSize = internalQuery({
  args: {
    conversationId: v.id("interleavedConversations"),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    return conversation?.contextSize || 0;
  },
});

/**
 * Move large context to S3 (internal)
 */
export const moveContextToS3 = internalAction({
  args: {
    conversationId: v.id("interleavedConversations"),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.runQuery(internal.interleavedReasoning.getConversationById, {
      conversationId: args.conversationId,
    });

    if (!conversation || !conversation.messages || conversation.messages.length === 0) {
      return;
    }

    // Upload to S3
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

    const s3Client = new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const s3Key = `conversations/${args.conversationId}/context_${Date.now()}.json`;

    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: s3Key,
      Body: JSON.stringify(conversation.messages),
      ContentType: "application/json",
      Metadata: {
        conversationId: args.conversationId,
        userId: conversation.userId || "anonymous",
        timestamp: Date.now().toString(),
      },
    }));

    // Update conversation with S3 reference
    await ctx.runMutation(internal.interleavedReasoning.updateS3Reference, {
      conversationId: args.conversationId,
      s3Key,
    });

    // Keep only recent messages in Convex (sliding window)
    await ctx.runMutation(internal.interleavedReasoning.trimMessages, {
      conversationId: args.conversationId,
      keepLast: SLIDING_WINDOW_SIZE,
    });
  },
});

/**
 * Update S3 reference (internal)
 */
export const updateS3Reference = internalMutation({
  args: {
    conversationId: v.id("interleavedConversations"),
    s3Key: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conversationId, {
      s3ContextKey: args.s3Key,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Trim messages to keep only recent ones (internal)
 */
export const trimMessages = internalMutation({
  args: {
    conversationId: v.id("interleavedConversations"),
    keepLast: v.number(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return;
    }

    const messages = conversation.messages || [];
    const trimmedMessages = messages.slice(-args.keepLast);
    const contextSize = JSON.stringify(trimmedMessages).length;

    await ctx.db.patch(args.conversationId, {
      messages: trimmedMessages,
      contextSize,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Get conversation by ID (internal)
 */
export const getConversationById = internalQuery({
  args: {
    conversationId: v.id("interleavedConversations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.conversationId);
  },
});

/**
 * Get user conversations
 */
export const getUserConversations = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const conversations = await ctx.db
      .query("interleavedConversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit || 20);

    return conversations;
  },
});

/**
 * Get conversation (public - for frontend)
 */
export const getConversation = query({
  args: {
    conversationId: v.id("interleavedConversations"),
    conversationToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    
    if (!conversation) {
      return null;
    }

    // Check access: either user owns it or has the token
    if (userId && conversation.userId === userId) {
      return conversation;
    }

    if (args.conversationToken && conversation.conversationToken === args.conversationToken) {
      return conversation;
    }

    return null;
  },
});
