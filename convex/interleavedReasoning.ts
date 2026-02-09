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
export const createConversation = mutation( {
  args: {
    title: v.optional( v.string() ),
    systemPrompt: v.optional( v.string() ),
  },
  handler: async ( ctx: any, args: { title?: string; systemPrompt?: string } ): Promise<{ conversationId: string; conversationToken?: string }> => {
    const userId = await getAuthUserId( ctx );

    // Generate token for anonymous users
    const conversationToken = userId
      ? undefined
      : `anon_${Date.now()}_${Math.random().toString( 36 ).substr( 2, 9 )}`;

    const conversationId = await ctx.db.insert( "interleavedConversations", {
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
- Test agents by simulating real-world scenarios and edge cases
- Provide detailed feedback on agent performance and behavior
- Suggest specific improvements when agents fail or underperform
- Help users understand agent capabilities and limitations
- Analyze conversation patterns to identify optimization opportunities

AGENT TESTING PRINCIPLES:
- Thoroughly test all agent capabilities and tools
- Document unexpected behaviors and edge cases
- Provide actionable recommendations for improvements
- Help users iterate and refine their agents
- Consider cost, performance, and accuracy tradeoffs

Think deeply about agent behavior and provide thoughtful testing insights.`,
      messageCount: 0,
      contextSize: 0,
      s3ContextKey: undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: true,
    } );

    return { conversationId, conversationToken };
  },
} );

/**
 * Send a message with interleaved reasoning
 */
export const sendMessage: any = action( {
  args: {
    conversationId: v.id( "interleavedConversations" ),
    conversationToken: v.optional( v.string() ),
    message: v.string(),
  },
  handler: async ( ctx: any, args: any ): Promise<any> => {
    const userId = await getAuthUserId( ctx );

    // Get conversation
    const conversation = await ctx.runQuery( internal.interleavedReasoning.getConversationInternal, {
      conversationId: args.conversationId,
      userId: userId || undefined,
      conversationToken: args.conversationToken,
    } );

    if ( !conversation ) {
      throw new Error( "Conversation not found or access denied" );
    }

    // NO GUARDRAILS - removed all validation/rate-limiting queries
    // Trust the user, minimize database operations

    // Get conversation history BEFORE adding new message
    const history = await ctx.runQuery( internal.interleavedReasoning.getConversationHistory, {
      conversationId: args.conversationId,
      windowSize: SLIDING_WINDOW_SIZE,
    } );

    // If conversation has an associated agent, use strands-agents execution
    // Otherwise, fall back to direct Claude invocation
    let response;
    if ( conversation.agentId ) {
      // Use strands-agents framework via AgentCore
      const agentResult = await ctx.runAction( api.strandsAgentExecution.executeAgentWithStrandsAgents, {
        agentId: conversation.agentId,
        conversationId: args.conversationId,
        message: args.message,
      } );

      if ( !agentResult.success ) {
        throw new Error( agentResult.error || "Agent execution failed" );
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

    // Batch insert BOTH messages in a single mutation (1 WRITE PER TURN)
    await ctx.runMutation( internal.interleavedReasoning.addMessageBatch, {
      conversationId: args.conversationId,
      messages: [
        {
          role: "user",
          content: args.message,
        },
        {
          role: "assistant",
          content: response.content,
          reasoning: response.reasoning,
          toolCalls: response.toolCalls,
        },
      ],
    } );

    // NO automatic S3 offload - let it be triggered manually or by separate process
    // This keeps sendMessage purely event-driven with zero scheduled tasks

    return {
      response: response.content,
      reasoning: response.reasoning,
      toolCalls: response.toolCalls,
    };
  },
} );

/**
 * Internal helper: count user messages within a time window
 */
export const getUserMessageCount = internalQuery( {
  args: {
    userId: v.optional( v.id( "users" ) ),
    conversationToken: v.optional( v.string() ),
    timeWindow: v.number(),
  },
  handler: async ( ctx, args ) => {
    const since = Date.now() - args.timeWindow;
    let conversations: any[] = [];

    if ( args.userId ) {
      conversations = await ctx.db
        .query( "interleavedConversations" )
        .withIndex( "by_user", ( q ) => q.eq( "userId", args.userId ) )
        .collect();
    } else if ( args.conversationToken ) {
      const conversation = await ctx.db
        .query( "interleavedConversations" )
        .withIndex( "by_token", ( q ) => q.eq( "conversationToken", args.conversationToken ) )
        .first();
      if ( conversation ) {
        conversations = [conversation];
      }
    }

    if ( conversations.length === 0 ) {
      return 0;
    }

    let count = 0;
    for ( const conversation of conversations ) {
      const messages: any[] = conversation.messages || [];
      for ( const message of messages ) {
        if ( message.timestamp && message.timestamp >= since ) {
          count += 1;
        }
      }
    }

    return count;
  },
} );

/**
 * Internal helper: aggregate user cost for current day
 * Currently returns 0 until detailed cost tracking is implemented.
 */
export const getUserCostToday = internalQuery( {
  args: {
    userId: v.optional( v.id( "users" ) ),
    conversationToken: v.optional( v.string() ),
  },
  handler: async () => {
    // Cost tracking is not yet implemented; return 0 so guardrails remain permissive.
    return 0;
  },
} );

/**
 * Invoke Claude Haiku 4.5 with interleaved thinking
 */
async function invokeClaudeWithInterleavedThinking(
  systemPrompt: string,
  history: any[],
  userMessage: string
): Promise<{ content: string; reasoning?: string; toolCalls?: any[] }> {
  const { BedrockRuntimeClient, InvokeModelCommand } = await import( "@aws-sdk/client-bedrock-runtime" );

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if ( !accessKeyId || !secretAccessKey ) {
    throw new Error( "Missing AWS credentials: ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set in the environment" );
  }

  const client = new BedrockRuntimeClient( {
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  } );

  // Build messages array
  const messages: any[] = [];

  // Add conversation history
  for ( const msg of history ) {
    messages.push( {
      role: msg.role,
      content: [{ text: msg.content }],
    } );
  }

  // Add current user message
  messages.push( {
    role: "user",
    content: [{ text: userMessage }],
  } );

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

  const modelId = process.env.AGENT_BUILDER_MODEL_ID || "us.anthropic.claude-haiku-4-5-20250514-v1:0";

  const command = new InvokeModelCommand( {
    modelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify( payload ),
  } );

  const response: any = await client.send( command );
  const responseBody = JSON.parse( new TextDecoder().decode( response.body ) );

  // Extract content and reasoning
  let content = "";
  let reasoning = "";
  const toolCalls: any[] = [];

  for ( const block of responseBody.content || [] ) {
    if ( block.type === "text" ) {
      content += block.text;
    } else if ( block.type === "thinking" ) {
      reasoning += block.thinking;
    } else if ( block.type === "tool_use" ) {
      toolCalls.push( {
        id: block.id,
        name: block.name,
        input: block.input,
      } );
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
 * Now inserts individual message documents instead of rewriting entire array
 */
export const addMessage = internalMutation( {
  args: {
    conversationId: v.id( "interleavedConversations" ),
    role: v.union( v.literal( "user" ), v.literal( "assistant" ) ),
    content: v.string(),
    reasoning: v.optional( v.string() ),
    toolCalls: v.optional( v.any() ),
  },
  handler: async ( ctx, args ) => {
    const conversation = await ctx.db.get( args.conversationId );
    if ( !conversation ) {
      throw new Error( "Conversation not found" );
    }

    const timestamp = Date.now();

    await ctx.db.insert( "interleavedMessages", {
      conversationId: args.conversationId,
      role: args.role,
      content: args.content,
      reasoning: args.reasoning,
      toolCalls: args.toolCalls,
      timestamp,
      sequenceNumber: timestamp, // Use timestamp as sequence for ordering
    } );

    await ctx.db.patch( args.conversationId, {
      messageCount: ( conversation.messageCount ?? 0 ) + 1,
      updatedAt: timestamp,
    } );
  },
} );

/**
 * Add multiple messages in a single transaction (BATCH INSERT)
 * Used to add user + assistant messages together = 1 WRITE PER TURN
 */
export const addMessageBatch = internalMutation( {
  args: {
    conversationId: v.id( "interleavedConversations" ),
    messages: v.array( v.object( {
      role: v.union( v.literal( "user" ), v.literal( "assistant" ) ),
      content: v.string(),
      reasoning: v.optional( v.string() ),
      toolCalls: v.optional( v.any() ),
    } ) ),
  },
  handler: async ( ctx, args ) => {
    const conversation = await ctx.db.get( args.conversationId );
    if ( !conversation ) {
      throw new Error( "Conversation not found" );
    }

    const timestamp = Date.now();

    for ( const msg of args.messages ) {
      await ctx.db.insert( "interleavedMessages", {
        conversationId: args.conversationId,
        role: msg.role,
        content: msg.content,
        reasoning: msg.reasoning,
        toolCalls: msg.toolCalls,
        timestamp,
        sequenceNumber: timestamp, // Use timestamp as sequence for ordering
      } );
    }

    await ctx.db.patch( args.conversationId, {
      messageCount: ( conversation.messageCount ?? 0 ) + args.messages.length,
      updatedAt: timestamp,
    } );
  },
} );

/**
 * Get conversation history with sliding window (internal)
 * Now fetches from interleavedMessages table instead of embedded array
 */
export const getConversationHistory = internalQuery( {
  args: {
    conversationId: v.id( "interleavedConversations" ),
    windowSize: v.optional( v.number() ),
  },
  handler: async ( ctx, args ) => {
    const windowSize = args.windowSize || SLIDING_WINDOW_SIZE;

    // Fetch all messages and take last N (sliding window)
    const allMessages = await ctx.db
      .query( "interleavedMessages" )
      .withIndex( "by_timestamp", ( q ) => q.eq( "conversationId", args.conversationId ) )
      .order( "desc" )
      .take( windowSize );

    // Return in chronological order
    return allMessages.reverse();
  },
} );

/**
 * Get conversation (internal - no auth check)
 */
export const getConversationInternal = internalQuery( {
  args: {
    conversationId: v.id( "interleavedConversations" ),
    userId: v.optional( v.id( "users" ) ),
    conversationToken: v.optional( v.string() ),
  },
  handler: async ( ctx, args ) => {
    const conversation = await ctx.db.get( args.conversationId );
    if ( !conversation ) {
      return null;
    }

    // Check access: either user owns it or has the token
    if ( args.userId && conversation.userId === args.userId ) {
      return conversation;
    }

    if ( args.conversationToken && conversation.conversationToken === args.conversationToken ) {
      return conversation;
    }

    return null;
  },
} );

/**
 * Get context size (internal) - computed on-demand from messages
 */
export const getContextSize = internalQuery( {
  args: {
    conversationId: v.id( "interleavedConversations" ),
  },
  handler: async ( ctx, args ) => {
    // Compute context size by summing message lengths
    const messages = await ctx.db
      .query( "interleavedMessages" )
      .withIndex( "by_conversation", ( q ) => q.eq( "conversationId", args.conversationId ) )
      .collect();

    return messages.reduce(
      ( sum, msg ) => sum + msg.content.length + ( msg.reasoning?.length || 0 ),
      0
    );
  },
} );

/**
 * Get all messages for S3 archival (internal)
 */
export const getAllMessages = internalQuery( {
  args: {
    conversationId: v.id( "interleavedConversations" ),
  },
  handler: async ( ctx, args ) => {
    const messages = await ctx.db
      .query( "interleavedMessages" )
      .withIndex( "by_conversation", ( q ) => q.eq( "conversationId", args.conversationId ) )
      .collect();

    return messages.sort( ( a, b ) => a.sequenceNumber - b.sequenceNumber );
  },
} );

/**
 * Check context size and offload to S3 if needed (background task)
 */
export const checkAndOffloadToS3 = internalAction( {
  args: {
    conversationId: v.id( "interleavedConversations" ),
  },
  handler: async ( ctx, args ) => {
    const contextSize = await ctx.runQuery( internal.interleavedReasoning.getContextSize, {
      conversationId: args.conversationId,
    } );

    if ( contextSize > S3_THRESHOLD ) {
      await ctx.runAction( internal.interleavedReasoning.moveContextToS3, {
        conversationId: args.conversationId,
      } );
    }
  },
} );

/**
 * Move large context to S3 (internal)
 * Now fetches messages from interleavedMessages table
 */
export const moveContextToS3 = internalAction( {
  args: {
    conversationId: v.id( "interleavedConversations" ),
  },
  handler: async ( ctx, args ) => {
    // Fetch conversation metadata
    const conversation = await ctx.runQuery( internal.interleavedReasoning.getConversationById, {
      conversationId: args.conversationId,
    } );

    if ( !conversation ) {
      return;
    }

    // Fetch all messages from interleavedMessages table
    const messages = await ctx.runQuery( internal.interleavedReasoning.getAllMessages, {
      conversationId: args.conversationId,
    } );

    if ( !messages || messages.length === 0 ) {
      return;
    }

    // Upload to S3
    const { S3Client, PutObjectCommand } = await import( "@aws-sdk/client-s3" );

    const s3AccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const s3SecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if ( !s3AccessKeyId || !s3SecretAccessKey ) {
      throw new Error( "Missing AWS credentials for S3: ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set" );
    }

    const s3Client = new S3Client( {
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: s3AccessKeyId,
        secretAccessKey: s3SecretAccessKey,
      },
    } );

    const s3Key = `conversations/${args.conversationId}/context_${Date.now()}.json`;

    await s3Client.send( new PutObjectCommand( {
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: s3Key,
      Body: JSON.stringify( messages ),
      ContentType: "application/json",
      Metadata: {
        conversationId: args.conversationId,
        userId: conversation.userId || "anonymous",
        timestamp: Date.now().toString(),
      },
    } ) );

    // Update conversation with S3 reference
    await ctx.runMutation( internal.interleavedReasoning.updateS3Reference, {
      conversationId: args.conversationId,
      s3Key,
    } );

    // Keep only recent messages in Convex (sliding window)
    await ctx.runMutation( internal.interleavedReasoning.trimMessages, {
      conversationId: args.conversationId,
      keepLast: SLIDING_WINDOW_SIZE,
    } );
  },
} );

/**
 * Update S3 reference (internal)
 */
export const updateS3Reference = internalMutation( {
  args: {
    conversationId: v.id( "interleavedConversations" ),
    s3Key: v.string(),
  },
  handler: async ( ctx, args ) => {
    await ctx.db.patch( args.conversationId, {
      s3ContextKey: args.s3Key,
      updatedAt: Date.now(),
    } );
  },
} );

/**
 * Trim messages to keep only recent ones (internal)
 * Now deletes old message documents from interleavedMessages table
 */
export const trimMessages = internalMutation( {
  args: {
    conversationId: v.id( "interleavedConversations" ),
    keepLast: v.number(),
  },
  handler: async ( ctx, args ) => {
    // Get all messages sorted by timestamp (desc)
    const allMessages = await ctx.db
      .query( "interleavedMessages" )
      .withIndex( "by_timestamp", ( q ) => q.eq( "conversationId", args.conversationId ) )
      .order( "desc" )
      .collect();

    // Keep last N, delete the rest
    const toDelete = allMessages.slice( args.keepLast );

    // Delete old messages
    for ( const msg of toDelete ) {
      await ctx.db.delete( msg._id );
    }

    // NO conversation patch - contextSize computed on-demand
    // This is a pure cleanup operation with minimal writes
  },
} );

/**
 * Get conversation by ID (internal)
 */
export const getConversationById = internalQuery( {
  args: {
    conversationId: v.id( "interleavedConversations" ),
  },
  handler: async ( ctx, args ) => {
    return await ctx.db.get( args.conversationId );
  },
} );

/**
 * Get user conversations
 */
export const getUserConversations = query( {
  args: {
    limit: v.optional( v.number() ),
  },
  handler: async ( ctx, args ) => {
    const userId = await getAuthUserId( ctx );
    if ( !userId ) {
      return [];
    }

    const conversations = await ctx.db
      .query( "interleavedConversations" )
      .withIndex( "by_user", ( q ) => q.eq( "userId", userId ) )
      .order( "desc" )
      .take( args.limit || 20 );

    return conversations;
  },
} );

/**
 * Get conversation (public - for frontend)
 * Now fetches messages from interleavedMessages table
 */
export const getConversation = query( {
  args: {
    conversationId: v.id( "interleavedConversations" ),
    conversationToken: v.optional( v.string() ),
  },
  handler: async ( ctx, args ) => {
    const userId = await getAuthUserId( ctx );
    const conversation = await ctx.db.get( args.conversationId );

    if ( !conversation ) {
      return null;
    }

    // Check access: either user owns it or has the token
    const hasAccess = ( userId && conversation.userId === userId ) ||
      ( args.conversationToken && conversation.conversationToken === args.conversationToken );

    if ( !hasAccess ) {
      return null;
    }

    // Fetch all messages for this conversation (reactive query)
    const messages = await ctx.db
      .query( "interleavedMessages" )
      .withIndex( "by_conversation", ( q ) => q.eq( "conversationId", args.conversationId ) )
      .collect();

    // Sort by sequence number
    const sortedMessages = messages.sort( ( a, b ) => a.sequenceNumber - b.sequenceNumber );

    // Return conversation with messages (for compatibility with existing UI)
    return {
      ...conversation,
      messages: sortedMessages.map( ( m ) => ( {
        role: m.role,
        content: m.content,
        reasoning: m.reasoning,
        toolCalls: m.toolCalls,
        timestamp: m.timestamp,
      } ) ),
    };
  },
} );
