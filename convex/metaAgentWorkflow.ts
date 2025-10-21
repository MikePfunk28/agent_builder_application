/**
 * Meta-Agent Workflow
 * Uses strands-agents workflow with thinking, research, and optimization
 * 
 * Workflow Steps:
 * 1. Think: Analyze user requirement
 * 2. Research: Look up subject matter complexity
 * 3. Think: Determine optimal architecture
 * 4. Design: Create agent configuration(s)
 * 5. Think: Validate and optimize
 * 6. Return: Final agent design
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { MODEL_BENCHMARKS, calculateTaskComplexity, recommendModelForComplexity, type ModelBenchmarks } from "./modelBenchmarks";

/**
 * Agent Templates
 */
export const AGENT_TEMPLATES = {
  // Basic templates
  "customer-support": {
    name: "Customer Support Agent",
    description: "Handles customer inquiries and support tickets",
    tools: ["search", "knowledge_base"],
    systemPrompt: "You are a helpful customer support agent. Provide clear, empathetic responses.",
    complexity: 30,
  },
  "code-reviewer": {
    name: "Code Review Agent",
    description: "Reviews code for quality, security, and best practices",
    tools: ["code_interpreter", "search"],
    systemPrompt: "You are an expert code reviewer. Analyze code for bugs, security issues, and improvements.",
    complexity: 70,
  },
  "data-analyst": {
    name: "Data Analysis Agent",
    description: "Analyzes data and generates insights",
    tools: ["code_interpreter", "calculator", "search"],
    systemPrompt: "You are a data analyst. Analyze data, identify patterns, and provide actionable insights.",
    complexity: 60,
  },
  
  // Meta-tooling templates
  "meta-tooling-basic": {
    name: "Meta-Tooling Agent (Basic)",
    description: "Creates simple tools as needed",
    tools: ["code_interpreter", "search"],
    systemPrompt: "You can create new tools when needed. Use the @tool decorator to define tools.",
    complexity: 80,
    metaTooling: true,
  },
  "meta-tooling-agent-as-tool": {
    name: "Meta-Tooling with Agent-as-Tool",
    description: "Creates tools and sub-agents, connects to MCP",
    tools: ["code_interpreter", "search", "mcp_client"],
    systemPrompt: "You can create tools, sub-agents, and MCP connections. Use @tool and @agent decorators.",
    complexity: 90,
    metaTooling: true,
    agentAsTool: true,
  },
  "meta-tooling-complex": {
    name: "Meta-Tooling Agent (Complex)",
    description: "Full meta-tooling with real tool generation and MCP integration",
    tools: ["code_interpreter", "search", "mcp_client", "file_system"],
    systemPrompt: "You are an advanced meta-tooling agent. Create tools, agents, MCPs, and integrate data sources.",
    complexity: 95,
    metaTooling: true,
    agentAsTool: true,
    realToolGeneration: true,
  },
  
  // Domain-specific templates
  "fedramp-consultant": {
    name: "FedRAMP Compliance Consultant",
    description: "Expert in FedRAMP compliance and security requirements",
    tools: ["search", "browser", "document_analysis"],
    systemPrompt: "You are a FedRAMP compliance expert. Provide guidance on security controls and compliance.",
    complexity: 85,
    dataSources: ["fedramp_docs"],
  },
};

/**
 * Workflow-based agent design with thinking
 */
export const designAgentWithWorkflow = action({
  args: {
    userRequirement: v.string(),
    useTemplate: v.optional(v.string()),
    maxBudgetPoints: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const conversationHistory: any[] = [];
    
    try {
      // Step 1: Initial Thinking - Analyze requirement
      const thinkingStep1 = await thinkStep(ctx, conversationHistory, `
Analyze this user requirement:
"${args.userRequirement}"

Think about:
1. What is the core task?
2. What domain knowledge is required?
3. Is this a simple or complex task?
4. Should we use a template or custom design?
5. What tools might be needed?

Provide your analysis.
`);
      
      conversationHistory.push(
        { role: "user", content: "Think about the requirement" },
        { role: "assistant", content: thinkingStep1 }
      );
      
      // Step 2: Research - Look up subject complexity
      const researchResult = await researchStep(ctx, conversationHistory, args.userRequirement);

      conversationHistory.push(
        { role: "user", content: "Research the subject matter" },
        { role: "assistant", content: researchResult }
      );
      
      // Step 3: Thinking - Determine architecture
      const thinkingStep2 = await thinkStep(ctx, conversationHistory, `
Based on the research, think about:
1. How complex is this task? (0-100)
2. What type of task is it? (code/reasoning/knowledge/general)
3. Should we use one agent or multiple?
4. What's the minimum model capability needed?
5. What's the optimal cost/performance balance?

Provide your architectural decisions.
`);
      
      conversationHistory.push(
        { role: "user", content: "Determine architecture" },
        { role: "assistant", content: thinkingStep2 }
      );
      
      // Step 4: Design - Create agent configuration
      const design = await designStep(ctx, conversationHistory, args);
      
      // Step 5: Final Thinking - Validate and optimize
      const thinkingStep3 = await thinkStep(ctx, conversationHistory, `
Review the design:
${JSON.stringify(design, null, 2)}

Think about:
1. Is this the optimal model selection?
2. Are the tools appropriate?
3. Is the budget well-utilized?
4. Any improvements needed?

Provide your validation.
`);
      
      conversationHistory.push(
        { role: "user", content: "Validate design" },
        { role: "assistant", content: thinkingStep3 }
      );
      
      return {
        success: true,
        ...design,
        workflow: {
          thinking1: thinkingStep1,
          research: researchStep,
          thinking2: thinkingStep2,
          thinking3: thinkingStep3,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        agents: [],
        totalPoints: 0,
        reasoning: "",
      };
    }
  },
});

/**
 * Thinking step using Claude Haiku
 */
async function thinkStep(ctx: any, history: any[], prompt: string): Promise<string> {
  const response = await ctx.runAction(api.mcpClient.invokeMCPTool, {
    serverName: "bedrock-agentcore-mcp-server",
    toolName: "execute_agent",
    parameters: {
      model_id: "anthropic.claude-3-haiku-20240307-v1:0",
      input: prompt,
      system_prompt: "You are a thoughtful AI architect. Think step-by-step and reason carefully.",
      conversation_history: history,
    },
  });
  
  if (!response.success) {
    throw new Error("Thinking step failed");
  }
  
  return response.result.response;
}

/**
 * Research step - Look up subject matter
 */
async function researchStep(ctx: any, history: any[], requirement: string): Promise<string> {
  // Extract key terms from requirement
  const terms = requirement.toLowerCase();
  
  // Determine domain
  let domain = "general";
  let complexity = 50;
  
  if (terms.includes("fedramp") || terms.includes("compliance") || terms.includes("security")) {
    domain = "security_compliance";
    complexity = 85;
  } else if (terms.includes("code") || terms.includes("programming") || terms.includes("software")) {
    domain = "software_engineering";
    complexity = 70;
  } else if (terms.includes("data") || terms.includes("analysis") || terms.includes("analytics")) {
    domain = "data_science";
    complexity = 65;
  } else if (terms.includes("customer") || terms.includes("support") || terms.includes("help")) {
    domain = "customer_service";
    complexity = 30;
  }
  
  // Use Claude to research and assess complexity
  const response = await ctx.runAction(api.mcpClient.invokeMCPTool, {
    serverName: "bedrock-agentcore-mcp-server",
    toolName: "execute_agent",
    parameters: {
      model_id: "anthropic.claude-3-haiku-20240307-v1:0",
      input: `Research this domain: ${domain}

Requirement: "${requirement}"

Assess:
1. Domain complexity (0-100)
2. Required expertise level
3. Common tools/resources needed
4. Typical challenges

Provide a brief research summary.`,
      system_prompt: "You are a research assistant. Provide concise, factual assessments.",
      conversation_history: history,
    },
  });
  
  if (!response.success) {
    return `Domain: ${domain}, Estimated complexity: ${complexity}`;
  }
  
  return response.result.response;
}

/**
 * Design step - Create agent configuration
 */
async function designStep(ctx: any, history: any[], args: any): Promise<any> {
  // Check if using template
  if (args.useTemplate && AGENT_TEMPLATES[args.useTemplate as keyof typeof AGENT_TEMPLATES]) {
    const template = AGENT_TEMPLATES[args.useTemplate as keyof typeof AGENT_TEMPLATES];
    const model = recommendModelForComplexity(template.complexity);
    
    return {
      agents: [{
        name: template.name,
        model: model.model,
        systemPrompt: template.systemPrompt,
        tools: template.tools,
        deploymentType: model.provider === "bedrock" ? "aws" : "ollama",
        score: model,
        template: args.useTemplate,
      }],
      totalPoints: model.totalScore,
      reasoning: `Used template: ${template.name}. Selected ${model.model} based on complexity ${template.complexity}.`,
    };
  }
  
  // Custom design using Claude
  const response = await ctx.runAction(api.mcpClient.invokeMCPTool, {
    serverName: "bedrock-agentcore-mcp-server",
    toolName: "execute_agent",
    parameters: {
      model_id: "anthropic.claude-3-haiku-20240307-v1:0",
      input: `Design an agent for: "${args.userRequirement}"

Based on our analysis, provide a JSON design:
{
  "agentCount": number,
  "taskType": "code|reasoning|knowledge|general",
  "complexity": number (0-100),
  "requiredTools": ["tool1", "tool2"],
  "systemPrompt": "string",
  "reasoning": "string"
}`,
      system_prompt: "You are an AI architect. Always respond with valid JSON.",
      conversation_history: history,
    },
  });
  
  if (!response.success) {
    throw new Error("Design step failed");
  }
  
  // Parse response
  const designText = response.result.response;
  const jsonMatch = designText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse design");
  }
  
  const design = JSON.parse(jsonMatch[0]);
  
  // Select model based on complexity
  const model = recommendModelForComplexity(
    design.complexity,
    design.taskType,
    args.maxBudgetPoints || 300
  );
  
  return {
    agents: [{
      name: "Custom Agent",
      model: model.model,
      systemPrompt: design.systemPrompt,
      tools: design.requiredTools,
      deploymentType: model.provider === "bedrock" ? "aws" : "ollama",
      score: model,
    }],
    totalPoints: model.totalScore,
    reasoning: design.reasoning,
  };
}

/**
 * Get available templates
 */
export const getAgentTemplates = action({
  args: {},
  handler: async (_ctx, _args) => {
    return {
      templates: Object.entries(AGENT_TEMPLATES).map(([key, template]) => ({
        id: key,
        ...template,
      })),
    };
  },
});
