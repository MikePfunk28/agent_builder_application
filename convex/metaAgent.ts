/**
 * Meta-Agent: AI-Powered Agent Builder
 * Uses Claude Haiku 4.5 to automatically design and build optimal agents
 * 
 * Features:
 * - Analyzes user requirements
 * - Selects optimal models based on cost/performance/ability
 * - Creates necessary tools and MCPs
 * - Builds multi-agent systems with A2A communication
 * - Point system (300 max) to prevent over-provisioning
 */

"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { BEDROCK_MODELS } from "./modelRegistry";
import { requireBedrockAccess } from "./lib/bedrockGate";

/**
 * Model scoring system (0-100 each category, 300 max total)
 */
interface ModelScore {
  model: string;
  costScore: number;      // 0-100 (100 = most expensive)
  sizeScore: number;      // 0-100 (100 = largest/newest)
  abilityScore: number;   // 0-100 (100 = most capable/newest)
  totalScore: number;     // Sum of above
  costPerMToken: number;  // Actual cost
  provider: string;       // bedrock, openai, ollama
}

/**
 * Model database with scoring — derived from BEDROCK_MODELS registry (single source of truth).
 * Scores are computed from cost/capability data rather than hardcoded.
 */
function buildModelDatabase(): ModelScore[] {
  const scores: ModelScore[] = [];
  for ( const [id, model] of Object.entries( BEDROCK_MODELS ) ) {
    if ( !model.costPer1MTokens ) continue; // Skip non-text models (image, video, embedding)
    const outputCost = model.costPer1MTokens.output;
    // Score 0-100 based on cost (higher cost = higher score)
    const costScore = Math.min( 100, Math.round( ( outputCost / 25.0 ) * 100 ) );
    // Ability score based on capabilities and category
    const hasReasoning = model.capabilities.includes( "reasoning" );
    const hasCoding = model.capabilities.includes( "coding" );
    const isPremium = model.category === "premium" || model.category === "flagship";
    const abilityScore = Math.min( 100, 50 + ( hasReasoning ? 20 : 0 ) + ( hasCoding ? 15 : 0 ) + ( isPremium ? 15 : 0 ) );
    // Size score approximated from context window
    const sizeScore = Math.min( 100, Math.round( ( model.contextWindow / 300000 ) * 100 ) );
    scores.push( {
      model: id,
      costScore,
      sizeScore,
      abilityScore,
      totalScore: costScore + sizeScore + abilityScore,
      costPerMToken: outputCost,
      provider: "bedrock",
    } );
  }
  return scores;
}

const MODEL_DATABASE: ModelScore[] = buildModelDatabase();

/**
 * Meta-Agent: Analyze requirements and design optimal agent(s)
 */
export const designAgent = action({
  args: {
    userRequirement: v.string(),
    modelId: v.string(), // User selects the model from the UI — required, no defaults
    maxBudgetPoints: v.optional(v.number()), // Default 300
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    agents: any[];
    totalPoints: number;
    reasoning: string;
    error?: string;
  }> => {
    try {
      const modelId = args.modelId;

      // Auth + billing gate
      const gateResult = await requireBedrockAccess(
        ctx, modelId,
        async ( lookupArgs ) => ctx.runQuery( internal.users.getInternal, lookupArgs ),
      );
      if ( !gateResult.allowed ) {
        throw new Error( gateResult.reason );
      }
      const userId = gateResult.userId;

      const maxBudget = args.maxBudgetPoints || 300;

      // Step 1: Analyze requirements using the user's selected model
      const analysis = await analyzeRequirements(ctx, args.userRequirement, userId, modelId);

      // Step 2: Select optimal models within budget
      const selectedModels = selectOptimalModels(analysis, maxBudget);

      // Step 3: Design tools and MCPs
      const tools = designToolsFromAnalysis(analysis);

      // Step 4: Generate agent configurations
      const agents = selectedModels.map((modelSelection: any) => ({
        name: modelSelection.agentName,
        model: modelSelection.model,
        systemPrompt: modelSelection.systemPrompt,
        tools: tools,
        deploymentType: modelSelection.provider === "bedrock" ? "aws" : "ollama",
        score: modelSelection.score,
      }));

      const totalPoints = selectedModels.reduce((sum: number, m: any) => sum + m.score.totalScore, 0);

      return {
        success: true,
        agents,
        totalPoints,
        reasoning: analysis.reasoning,
      };
    } catch (error: any) {
      return {
        success: false,
        agents: [],
        totalPoints: 0,
        reasoning: "",
        error: error.message,
      };
    }
  },
});

/**
 * Step 1: Analyze user requirements with Claude Haiku
 */
async function analyzeRequirements(ctx: any, requirement: string, userId: any, modelId: string): Promise<any> {
  const prompt = `You are an expert AI agent architect. Analyze this user requirement and provide a structured analysis.

User Requirement: "${requirement}"

Provide your analysis in JSON format:
{
  "taskType": "string (e.g., 'data_analysis', 'customer_support', 'code_generation')",
  "complexity": "low|medium|high",
  "requiresMultipleAgents": boolean,
  "suggestedAgentCount": number,
  "requiredCapabilities": ["capability1", "capability2"],
  "requiredTools": ["tool1", "tool2"],
  "requiredDataSources": ["source1", "source2"],
  "estimatedTokenUsage": number,
  "reasoning": "string explaining your analysis"
}`;

  // Call LLM via Bedrock MCP — uses env var model, passes userId for billing
  const response = await ctx.runAction(api.mcpClient.invokeMCPTool, {
    serverName: "bedrock-agentcore-mcp-server",
    toolName: "execute_agent",
    userId,
    parameters: {
      model_id: modelId,
      input: prompt,
      system_prompt: "You are an expert AI agent architect. Always respond with valid JSON.",
    },
  });

  if (!response.success) {
    throw new Error("Failed to analyze requirements");
  }

  // Parse JSON response
  const analysisText = response.result.response;
  const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse analysis response");
  }

  return JSON.parse(jsonMatch[0]);
}

/**
 * Step 2: Select optimal models within budget
 */
function selectOptimalModels(analysis: any, maxBudget: number): any[] {
  const agentCount = analysis.suggestedAgentCount || 1;
  const budgetPerAgent = Math.floor(maxBudget / agentCount);

  const selections: any[] = [];

  for (let i = 0; i < agentCount; i++) {
    // Find best model within budget for this agent
    const suitableModels = MODEL_DATABASE.filter(m => m.totalScore <= budgetPerAgent);
    
    if (suitableModels.length === 0) {
      // If no models fit budget, use cheapest
      const cheapest = MODEL_DATABASE.reduce((min, m) => 
        m.totalScore < min.totalScore ? m : min
      );
      selections.push({
        agentName: `Agent ${i + 1}`,
        model: cheapest.model,
        provider: cheapest.provider,
        score: cheapest,
        systemPrompt: generateSystemPrompt(analysis, i, agentCount),
      });
    } else {
      // Select highest ability model within budget
      const best = suitableModels.reduce((max, m) => 
        m.abilityScore > max.abilityScore ? m : max
      );
      selections.push({
        agentName: `Agent ${i + 1}`,
        model: best.model,
        provider: best.provider,
        score: best,
        systemPrompt: generateSystemPrompt(analysis, i, agentCount),
      });
    }
  }

  return selections;
}

/**
 * Generate system prompt for agent
 */
function generateSystemPrompt(analysis: any, agentIndex: number, totalAgents: number): string {
  if (totalAgents === 1) {
    return `You are an AI agent designed to ${analysis.taskType}. 
Your capabilities include: ${analysis.requiredCapabilities.join(", ")}.
Focus on providing accurate, helpful responses.`;
  } else {
    return `You are Agent ${agentIndex + 1} of ${totalAgents} in a multi-agent system.
Your role: ${analysis.taskType} (specialized component ${agentIndex + 1}).
Capabilities: ${analysis.requiredCapabilities.join(", ")}.
Coordinate with other agents using A2A communication.`;
  }
}

/**
 * Step 3: Design tools and MCPs
 */
function designToolsFromAnalysis(analysis: any): any[] {
  const tools: any[] = [];

  // Map required tools to available tools
  const toolMapping: Record<string, any> = {
    "search": { name: "Search", type: "search", config: {} },
    "web_browser": { name: "Browser", type: "browser", config: {}, extrasPip: "browser" },
    "calculator": { name: "Calculator", type: "calculator", config: {} },
    "code_interpreter": { name: "Code Interpreter", type: "code_interpreter", config: {} },
    "file_system": { name: "File System", type: "file_system", config: {} },
  };

  for (const requiredTool of analysis.requiredTools) {
    const toolKey = requiredTool.toLowerCase().replace(/\s+/g, "_");
    if (toolMapping[toolKey]) {
      tools.push(toolMapping[toolKey]);
    }
  }

  // Add custom tools for data sources
  for (const dataSource of analysis.requiredDataSources) {
    tools.push({
      name: `${dataSource} Access`,
      type: "custom_data_source",
      config: {
        description: `Access ${dataSource} data`,
        parameters: [
          { name: "query", type: "str", description: "Query string", required: true },
        ],
      },
    });
  }

  return tools;
}

/**
 * Get available models with scores
 */
export const getAvailableModels = action({
  args: {},
  handler: async (_ctx, _args) => {
    return {
      models: MODEL_DATABASE,
      maxBudget: 300,
    };
  },
});

/**
 * Calculate total score for a set of agents
 */
export const calculateAgentScore = action({
  args: {
    agents: v.array(v.object({
      model: v.string(),
    })),
  },
  handler: async (_ctx, args) => {
    let totalScore = 0;

    for (const agent of args.agents) {
      const modelData = MODEL_DATABASE.find(m => m.model === agent.model);
      if (modelData) {
        totalScore += modelData.totalScore;
      }
    }

    return {
      totalScore,
      maxBudget: 300,
      remaining: 300 - totalScore,
      withinBudget: totalScore <= 300,
    };
  },
});
