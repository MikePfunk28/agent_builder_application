/**
 * Automated Agent Builder with Woz-Style Questions
 *
 * Sequential conversational flow:
 * 1. User describes what they want
 * 2. AI uses THINK tool to analyze
 * 3. AI asks first question with suggestions
 * 4. User answers
 * 5. AI uses THINK tool to refine understanding
 * 6. AI asks next question OR generates agent if ready
 *
 * Uses strands-agents framework with interleaved reasoning
 */

import { mutation, action, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Create a new agent building session
 */
export const createBuildSession = mutation( {
  args: {
    initialDescription: v.optional( v.string() ),
  },
  handler: async ( ctx, args ) => {
    const userId = await getAuthUserId( ctx );

    if ( !userId ) {
      throw new Error( "Authentication required to build agents" );
    }

    // Initialize session with agent requirements
    const sessionId = await ctx.db.insert( "agentBuildSessions", {
      userId,
      status: "gathering_requirements",
      currentQuestion: 0,
      agentRequirements: {
        agentType: null,
        targetUsers: null,
        problems: [],
        tools: [],
        tone: null,
        testingPreference: null,
        domainKnowledge: null,
        knowledgeBase: null,
        documentUrls: [],
      },
      conversationHistory: args.initialDescription
        ? [
          {
            role: "user",
            content: args.initialDescription,
            timestamp: Date.now(),
          },
        ]
        : [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } );

    return { sessionId };
  },
} );

/**
 * Get build session
 */
export const getBuildSession = query( {
  args: {
    sessionId: v.id( "agentBuildSessions" ),
  },
  handler: async ( ctx, args ) => {
    const userId = await getAuthUserId( ctx );
    if ( !userId ) return null;

    const session = await ctx.db.get( args.sessionId );
    if ( !session || session.userId !== userId ) {
      return null;
    }

    return session;
  },
} );

/**
 * Get user's build sessions
 */
export const getUserBuildSessions = query( {
  args: {
    limit: v.optional( v.number() ),
  },
  handler: async ( ctx, args ) => {
    const userId = await getAuthUserId( ctx );
    if ( !userId ) return [];

    return await ctx.db
      .query( "agentBuildSessions" )
      .withIndex( "by_user", ( q ) => q.eq( "userId", userId ) )
      .order( "desc" )
      .take( args.limit || 10 );
  },
} );

/**
 * Process user response and ask next question
 * Uses strands-agents THINK tool for interleaved reasoning
 */
export const processResponse = action( {
  args: {
    sessionId: v.id( "agentBuildSessions" ),
    userResponse: v.string(),
  },
  handler: async ( ctx, args ) => {
    // Verify caller owns this session
    const identity = await ctx.auth.getUserIdentity();
    if ( !identity ) {
      throw new Error( "Authentication required" );
    }

    // Get session
    const session = await ctx.runQuery( internal.automatedAgentBuilder.getBuildSessionInternal, {
      sessionId: args.sessionId,
    } );

    if ( !session ) {
      throw new Error( "Build session not found" );
    }

    // Add user message to history
    const updatedHistory = [
      ...session.conversationHistory,
      {
        role: "user" as const,
        content: args.userResponse,
        timestamp: Date.now(),
      },
    ];

    // Gate: enforce tier-based Bedrock access
    const { requireBedrockAccess } = await import( "./lib/bedrockGate" );
    const modelId = process.env.AGENT_BUILDER_MODEL_ID || "anthropic.claude-haiku-4-5-20251001-v1:0";
    const gateResult = await requireBedrockAccess(
      ctx,
      modelId,
      async ( lookupArgs ) => ctx.runQuery( internal.users.getInternal, lookupArgs ),
    );
    if ( !gateResult.allowed ) {
      throw new Error( gateResult.reason );
    }

    // Use Claude Haiku 4.5 with interleaved thinking to analyze and ask next question
    const systemPrompt = buildSystemPrompt( session.agentRequirements );
    const response = await analyzeAndAskNext( systemPrompt, updatedHistory );

    // Meter token usage for billing (non-fatal: don't kill agent generation)
    if ( response.tokenUsage && gateResult.allowed ) {
      try {
        await ctx.runMutation( internal.stripeMutations.incrementUsageAndReportOverage, {
          userId: gateResult.userId,
          modelId,
          inputTokens: response.tokenUsage.inputTokens,
          outputTokens: response.tokenUsage.outputTokens,
        } );
      } catch ( billingErr ) {
        console.error( "automatedAgentBuilder: billing failed (non-fatal)", {
          userId: gateResult.userId, modelId,
          inputTokens: response.tokenUsage.inputTokens,
          outputTokens: response.tokenUsage.outputTokens,
          error: billingErr instanceof Error ? billingErr.message : billingErr,
        } );
      }
    }

    // Parse response to extract:
    // 1. Thinking/reasoning
    // 2. Updated requirements
    // 3. Next question OR ready to generate
    const { thinking, requirements, nextQuestion, readyToGenerate, agentConfig } = response;

    // Update session
    await ctx.runMutation( internal.automatedAgentBuilder.updateBuildSession, {
      sessionId: args.sessionId,
      conversationHistory: [
        ...updatedHistory,
        {
          role: "assistant",
          content: nextQuestion || "Ready to generate your agent!",
          reasoning: thinking,
          timestamp: Date.now(),
        },
      ],
      agentRequirements: requirements ?? session.agentRequirements,
      currentQuestion: session.currentQuestion + 1,
      status: readyToGenerate ? "ready_to_generate" : "gathering_requirements",
      generatedAgentConfig: readyToGenerate ? agentConfig : undefined,
    } );

    return {
      thinking,
      nextQuestion,
      readyToGenerate,
      agentConfig,
      requirements,
    };
  },
} );

/**
 * Internal query to get build session
 */
export const getBuildSessionInternal = internalQuery( {
  args: {
    sessionId: v.id( "agentBuildSessions" ),
  },
  handler: async ( ctx, args ) => {
    return await ctx.db.get( args.sessionId );
  },
} );

/**
 * Internal mutation to update build session
 */
export const updateBuildSession = internalMutation( {
  args: {
    sessionId: v.id( "agentBuildSessions" ),
    conversationHistory: v.any(),
    agentRequirements: v.any(),
    currentQuestion: v.number(),
    status: v.string(),
    generatedAgentConfig: v.optional( v.any() ),
  },
  handler: async ( ctx, args ) => {
    await ctx.db.patch( args.sessionId, {
      conversationHistory: args.conversationHistory,
      agentRequirements: args.agentRequirements,
      currentQuestion: args.currentQuestion,
      status: args.status,
      generatedAgentConfig: args.generatedAgentConfig,
      updatedAt: Date.now(),
    } );
  },
} );

/**
 * Build system prompt for current question
 */
function buildSystemPrompt( requirements: any ): string {
  return `You are an intelligent agent builder assistant. Your goal is to gather requirements to build the perfect agent.

CURRENT REQUIREMENTS:
${JSON.stringify( requirements, null, 2 )}

WOZ-STYLE QUESTIONS (ask in order, skip if already answered):
1. What kind of agent? (Suggest: Customer Support, Code Reviewer, Research Assistant, Data Analyst, Content Creator, Compliance Consultant)
2. Who will use it? (Infer when obvious, e.g., code review → developers)
3. What problems does it solve? (Be specific, provide relevant suggestions)
4. What tools needed? (Suggest: Web search, GitHub, Database, Code execution, File ops, Email, API integrations)
5. What tone/style? (Suggest: Professional, Friendly, Technical, Creative, Formal)
6. How to test? (Suggest: Local Ollama FREE unlimited, Cloud Bedrock 50/month free, or Both)
7. Domain-specific knowledge needed? (Suggest: FedRAMP docs, coding standards, industry regulations, product docs)
8. Need knowledge base? (Suggest: Upload docs, provide URLs, scrape website, use existing sources)

YOUR WORKFLOW:
1. THINK deeply about the user's response
2. Update your understanding of requirements
3. Determine if you have enough info to generate the agent
4. If ready: Provide complete agent config
5. If not ready: Ask the MOST IMPORTANT unanswered question with 3-5 relevant suggestions

INTELLIGENT BEHAVIOR:
✅ Use interleaved reasoning (THINK tool) before each response
✅ Infer answers from context when obvious
✅ Skip questions you can confidently answer yourself
✅ Provide 3-5 specific, relevant suggestions with each question
✅ Know when you have enough information
✅ Be conversational and friendly

OUTPUT FORMAT:
If ready to generate, output JSON:
{
  "readyToGenerate": true,
  "agentConfig": {
    "name": "Agent Name",
    "model": "model-id",
    "systemPrompt": "detailed prompt",
    "tools": [...],
    "deploymentType": "aws" | "ollama",
    "tone": "...",
    "domainKnowledge": "...",
    "knowledgeBase": {...}
  }
}

If not ready, output JSON:
{
  "readyToGenerate": false,
  "nextQuestion": "Your question here?",
  "suggestions": ["Suggestion 1", "Suggestion 2", ...]
}

Think deeply, ask smart questions, and build exceptional agents.`;
}

/**
 * Use Bedrock to analyze and ask next question
 * Model is configurable via AGENT_BUILDER_MODEL_ID env var
 */
async function analyzeAndAskNext(
  systemPrompt: string,
  conversationHistory: any[]
): Promise<{
  thinking: string;
  requirements: any;
  nextQuestion: string | null;
  readyToGenerate: boolean;
  agentConfig: any | null;
  tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number };
}> {
  const { BedrockRuntimeClient, InvokeModelCommand } = await import( "@aws-sdk/client-bedrock-runtime" );

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || "us-east-1";

  if ( !accessKeyId || !secretAccessKey ) {
    throw new Error( "Missing AWS credentials: ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set in the environment" );
  }

  const client = new BedrockRuntimeClient( {
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  } );

  // Build messages in Bedrock format
  const messages = conversationHistory.map( ( msg ) => ( {
    role: msg.role as "user" | "assistant",
    content: [{ type: "text", text: msg.content }],
  } ) );

  const modelId = process.env.AGENT_BUILDER_MODEL_ID || "anthropic.claude-haiku-4-5-20251001-v1:0";

  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 4096,
    // Use lower temperature to produce more stable structured JSON responses
    temperature: 0.5,
    system: systemPrompt,
    messages,
  };

  const command = new InvokeModelCommand( {
    modelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify( payload ),
  } );

  let responseBody: any;
  try {
    const response: any = await client.send( command );
    const decoded = new TextDecoder().decode( response.body );
    try {
      responseBody = JSON.parse( decoded );
    } catch ( parseErr: any ) {
      console.error( "Failed to parse Bedrock response body", { modelId, error: parseErr.message, responseLength: decoded.length, responsePreview: decoded.slice( 0, 100 ) + ( decoded.length > 100 ? "..." : "" ) } );
      throw new Error( `Failed to parse Bedrock response body: ${parseErr.message}` );
    }
  } catch ( err: any ) {
    console.error( "Bedrock model invocation failed", { modelId, err } );
    throw new Error( `Bedrock model invocation failed: ${err.message}` );
  }

  // Extract token usage for billing
  const { extractTokenUsage, estimateTokenUsage } = await import( "./lib/tokenBilling" );
  let tokenUsage = extractTokenUsage( responseBody, modelId );

  // Extract text response
  let textResponse = "";
  for ( const block of responseBody.content || [] ) {
    if ( block.type === "text" ) {
      textResponse += block.text;
    }
  }

  // Fallback to character-based estimation if provider did not return token counts
  if ( tokenUsage.totalTokens === 0 ) {
    const inputText = systemPrompt + conversationHistory.map( ( m ) => m.content ).join( " " );
    tokenUsage = estimateTokenUsage( inputText, textResponse );
  }

  // Parse response - AI should return structured JSON
  try {
    const parsed = JSON.parse( textResponse );

    if ( parsed.readyToGenerate ) {
      return {
        thinking: parsed.reasoning || "Agent requirements gathered successfully",
        requirements: parsed.agentConfig,
        nextQuestion: null,
        readyToGenerate: true,
        agentConfig: parsed.agentConfig,
        tokenUsage,
      };
    } else {
      const suggestions = parsed.suggestions || [];
      const formattedQuestion = suggestions.length > 0
        ? `${parsed.nextQuestion}\n\nSuggestions:\n${suggestions.map( ( s: string, i: number ) => `${i + 1}. ${s}` ).join( "\n" )}`
        : parsed.nextQuestion;

      return {
        thinking: parsed.reasoning || "Analyzing requirements...",
        requirements: parsed.requirements || parsed.partialConfig || {},
        nextQuestion: formattedQuestion,
        readyToGenerate: false,
        agentConfig: null,
        tokenUsage,
      };
    }
  } catch ( error ) {
    // Fallback if JSON parsing fails - treat as next question
    return {
      thinking: "Processing user input...",
      requirements: null,
      nextQuestion: textResponse,
      readyToGenerate: false,
      agentConfig: null,
      tokenUsage,
    };
  }
}

/**
 * Generate agent from build session
 */
export const generateAgentFromSession = action( {
  args: {
    sessionId: v.id( "agentBuildSessions" ),
  },
  handler: async ( ctx, args ): Promise<{
    success: boolean;
    agentId: any;
    generatedCode: string;
    requirementsTxt: string | null;
    mcpConfig: string | null;
  }> => {
    // Verify caller owns this session
    const identity = await ctx.auth.getUserIdentity();
    if ( !identity ) {
      throw new Error( "Authentication required" );
    }

    const session = await ctx.runQuery( internal.automatedAgentBuilder.getBuildSessionInternal, {
      sessionId: args.sessionId,
    } );

    if ( !session || session.status !== "ready_to_generate" || !session.generatedAgentConfig ) {
      throw new Error( "Session not ready to generate agent" );
    }

    const config = session.generatedAgentConfig;

    // Generate agent code using codeGenerator
    const result = await ctx.runAction( api.codeGenerator.generateAgent, {
      name: config.name,
      model: config.model,
      systemPrompt: config.systemPrompt,
      tools: config.tools || [],
      deploymentType: config.deploymentType || "aws",
      mcpServers: config.mcpServers,
      dynamicTools: config.dynamicTools,
    } );

    // Create agent in database
    const agentId: any = await ctx.runMutation( api.agents.create, {
      name: config.name,
      description: `AI-generated agent: ${config.name}`,
      model: config.model,
      systemPrompt: config.systemPrompt,
      tools: config.tools || [],
      generatedCode: result.generatedCode,
      dockerConfig: "", // Will be generated if needed
      deploymentType: config.deploymentType || "aws",
      isPublic: false,
      exposableAsMCPTool: false,
      mcpToolName: "",
      mcpInputSchema: undefined,
    } );

    // Update session as completed
    await ctx.runMutation( internal.automatedAgentBuilder.updateBuildSession, {
      sessionId: args.sessionId,
      conversationHistory: session.conversationHistory,
      agentRequirements: session.agentRequirements,
      currentQuestion: session.currentQuestion,
      status: "completed",
      generatedAgentConfig: { ...config, agentId },
    } );

    return {
      success: true,
      agentId,
      generatedCode: result.generatedCode,
      requirementsTxt: result.requirementsTxt,
      mcpConfig: result.mcpConfig,
    };
  },
} );
