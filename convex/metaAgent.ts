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

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

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
 * Model database with scoring
 */
const MODEL_DATABASE: ModelScore[] = [
  // Anthropic Claude (Bedrock)
  {
    model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
    costScore: 100,
    sizeScore: 100,
    abilityScore: 100,
    totalScore: 300,
    costPerMToken: 15.00,
    provider: "bedrock",
  },
  {
    model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
    costScore: 95,
    sizeScore: 95,
    abilityScore: 95,
    totalScore: 285,
    costPerMToken: 15.00,
    provider: "bedrock",
  },
  {
    model: "anthropic.claude-3-opus-20240229-v1:0",
    costScore: 98,
    sizeScore: 90,
    abilityScore: 90,
    totalScore: 278,
    costPerMToken: 75.00,
    provider: "bedrock",
  },
  {
    model: "anthropic.claude-3-haiku-20240307-v1:0",
    costScore: 20,
    sizeScore: 40,
    abilityScore: 70,
    totalScore: 130,
    costPerMToken: 1.25,
    provider: "bedrock",
  },
  // Amazon Nova (Bedrock)
  {
    model: "amazon.nova-pro-v1:0",
    costScore: 30,
    sizeScore: 70,
    abilityScore: 80,
    totalScore: 180,
    costPerMToken: 2.00,
    provider: "bedrock",
  },
  {
    model: "amazon.nova-lite-v1:0",
    costScore: 10,
    sizeScore: 30,
    abilityScore: 60,
    totalScore: 100,
    costPerMToken: 0.50,
    provider: "bedrock",
  },
  // Ollama Models (Local/Fargate)
  {
    model: "llama3.1:70b",
    costScore: 50,
    sizeScore: 85,
    abilityScore: 85,
    totalScore: 220,
    costPerMToken: 0.00, // Free but requires compute
    provider: "ollama",
  },
  {
    model: "llama3:8b",
    costScore: 15,
    sizeScore: 50,
    abilityScore: 65,
    totalScore: 130,
    costPerMToken: 0.00,
    provider: "ollama",
  },
  {
    model: "gemma2:27b",
    costScore: 35,
    sizeScore: 65,
    abilityScore: 70,
    totalScore: 170,
    costPerMToken: 0.00,
    provider: "ollama",
  },
  {
    model: "gemma2:2b",
    costScore: 5,
    sizeScore: 20,
    abilityScore: 50,
    totalScore: 75,
    costPerMToken: 0.00,
    provider: "ollama",
  },
];

/**
 * Meta-Agent: Analyze requirements and design optimal agent(s)
 */
export const designAgent = action({
  args: {
    userRequirement: v.string(),
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
      const maxBudget = args.maxBudgetPoints || 300;

      // Step 1: Analyze requirements with Claude Haiku
      const analysis = await analyzeRequirements(ctx, args.userRequirement);

      // Step 2: Select optimal models within budget
      const selectedModels = selectOptimalModels(analysis, maxBudget);

      // Step 3: Design tools and MCPs
      const tools = await designTools(ctx, analysis);

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
async function analyzeRequirements(ctx: any, requirement: string): Promise<any> {
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

  // Call Claude Haiku via Bedrock
  const response = await ctx.runAction(api.mcpClient.invokeMCPTool, {
    serverName: "bedrock-agentcore-mcp-server",
    toolName: "execute_agent",
    parameters: {
      model_id: "anthropic.claude-3-haiku-20240307-v1:0",
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
async function designTools(ctx: any, analysis: any): Promise<any[]> {
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
