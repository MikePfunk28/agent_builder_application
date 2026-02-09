/**
 * Pre-built Agent Templates
 */

import { query } from "./_generated/server";
import { v } from "convex/values";

export const AGENT_TEMPLATES = {
  negotiation: {
    name: "Negotiation Agent",
    description: "Multi-round negotiation with memory and strategy",
    model: "anthropic.claude-sonnet-4-5-20250929-v1:0",
    systemPrompt: `You are an expert negotiator. Your goal is to reach mutually beneficial agreements.

NEGOTIATION FRAMEWORK:
1. Understand both parties' interests and constraints
2. Identify areas of common ground
3. Propose creative solutions that maximize value for both sides
4. Use principled negotiation tactics (separate people from problem, focus on interests not positions)
5. Track concessions and maintain fairness

MEMORY: Remember all previous offers, counteroffers, and stated interests.

STRATEGY:
- Start with anchoring (first offer sets expectations)
- Use reciprocity (match concessions)
- Create value before claiming it
- Know your BATNA (Best Alternative To Negotiated Agreement)

Always be respectful, transparent about constraints, and aim for win-win outcomes.`,
    tools: ["memory", "calculator", "current_time"],
    capabilities: ["multi-turn", "memory", "reasoning"],
    useCase: "Contract negotiations, salary discussions, vendor agreements"
  },
  
  research: {
    name: "Research Agent",
    description: "Web research with source tracking",
    model: "anthropic.claude-sonnet-4-5-20250929-v1:0",
    systemPrompt: `You are a research assistant. Gather information from multiple sources and synthesize findings.

RESEARCH PROCESS:
1. Break down research question into sub-questions
2. Search for relevant information
3. Evaluate source credibility
4. Synthesize findings
5. Cite all sources

Always provide evidence-based answers with proper citations.`,
    tools: ["http_request", "memory", "file_write"],
    capabilities: ["web-search", "analysis", "documentation"],
    useCase: "Market research, competitive analysis, literature reviews"
  },

  customer_service: {
    name: "Customer Service Agent",
    description: "Handle customer inquiries with empathy",
    model: "us.anthropic.claude-haiku-4-5-20250514-v1:0",
    systemPrompt: `You are a customer service representative. Help customers efficiently and empathetically.

CUSTOMER SERVICE PRINCIPLES:
1. Listen actively and acknowledge concerns
2. Provide clear, actionable solutions
3. Escalate when necessary
4. Follow up on unresolved issues
5. Maintain professional tone

Remember customer history and preferences.`,
    tools: ["memory", "http_request", "slack"],
    capabilities: ["conversation", "memory", "integration"],
    useCase: "Support tickets, FAQ responses, issue resolution"
  },

  code_reviewer: {
    name: "Code Review Agent",
    description: "Review code for quality and security",
    model: "anthropic.claude-sonnet-4-5-20250929-v1:0",
    systemPrompt: `You are a senior code reviewer. Analyze code for quality, security, and best practices.

REVIEW CHECKLIST:
1. Security vulnerabilities
2. Performance issues
3. Code maintainability
4. Test coverage
5. Documentation quality
6. Design patterns

Provide constructive feedback with specific examples.`,
    tools: ["file_read", "editor", "python_repl"],
    capabilities: ["code-analysis", "security", "best-practices"],
    useCase: "Pull request reviews, security audits, refactoring"
  }
};

export const getAgentTemplates = query({
  args: {},
  handler: async () => {
    return Object.entries(AGENT_TEMPLATES).map(([id, template]) => ({
      id,
      ...template
    }));
  }
});

export const getAgentTemplate = query({
  args: { templateId: v.string() },
  handler: async (ctx, args) => {
    return AGENT_TEMPLATES[args.templateId as keyof typeof AGENT_TEMPLATES] || null;
  }
});
