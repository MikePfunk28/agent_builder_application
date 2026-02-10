/**
 * Conversation Analysis for Agent Improvement
 *
 * Analyzes chat conversations to identify:
 * - Agent successes and failures
 * - Missing capabilities
 * - Performance bottlenecks
 * - User frustrations and corrections
 * - Suggested improvements
 */

import { v } from "convex/values";
import { mutation, query, action, internalMutation, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

/**
 * Analyze a conversation to identify improvement opportunities
 */
export const analyzeConversation = action({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx: any, args: { conversationId: Id<"conversations"> }): Promise<{ analysisId: string; analysis: any }> => {
    // Get conversation data
    const conversation: any = await ctx.runQuery(api.conversations.get, { conversationId: args.conversationId });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Get agent data
    const agent: any = await ctx.runQuery(api.agents.get, { id: conversation.agentId });

    if (!agent) {
      throw new Error("Agent not found");
    }

    // Analyze conversation using AI
    const analysis = await analyzeWithAI(conversation.messages, agent);

    // Store analysis
    const analysisId: string = await ctx.runMutation(internal.conversationAnalysis.storeAnalysis, {
      conversationId: args.conversationId,
      agentId: conversation.agentId,
      analysis,
    });

    return {
      analysisId,
      analysis,
    };
  },
});

/**
 * AI-powered conversation analysis
 */
async function analyzeWithAI(messages: any[], agent: any) {
  // Extract patterns
  const userMessages = messages.filter(m => m.role === "user");
  const assistantMessages = messages.filter(m => m.role === "assistant");

  const analysis = {
    conversationMetrics: {
      totalMessages: messages.length,
      userTurns: userMessages.length,
      assistantTurns: assistantMessages.length,
      avgResponseLength: assistantMessages.length > 0
        ? assistantMessages.reduce((acc, m) => acc + m.content.length, 0) / assistantMessages.length
        : 0,
    },

    identifiedIssues: [] as Array<{
      type: 'error' | 'misunderstanding' | 'missing_tool' | 'incorrect_response' | 'timeout';
      message: string;
      userMessage: string;
      agentResponse: string;
      severity: 'high' | 'medium' | 'low';
      timestamp: number;
    }>,

    successfulInteractions: [] as Array<{
      userMessage: string;
      agentResponse: string;
      timestamp: number;
    }>,

    userCorrections: [] as Array<{
      originalMessage: string;
      correctionMessage: string;
      timestamp: number;
    }>,

    missingCapabilities: [] as string[],

    suggestedImprovements: [] as Array<{
      type: 'add_tool' | 'modify_prompt' | 'change_model' | 'add_memory' | 'improve_error_handling';
      description: string;
      priority: 'high' | 'medium' | 'low';
      implementation: string;
    }>,

    performanceIssues: [] as Array<{
      issue: string;
      impact: string;
      recommendation: string;
    }>,
  };

  // Analyze messages for issues
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const nextMsg = messages[i + 1];

    if (msg.role === "user" && nextMsg?.role === "assistant") {
      const userContent = msg.content.toLowerCase();
      const assistantContent = nextMsg.content.toLowerCase();

      // Detect errors
      if (assistantContent.includes("error") || assistantContent.includes("failed") || assistantContent.includes("cannot")) {
        analysis.identifiedIssues.push({
          type: 'error',
          message: "Agent reported an error",
          userMessage: msg.content,
          agentResponse: nextMsg.content,
          severity: 'high',
          timestamp: msg.timestamp,
        });
      }

      // Detect misunderstandings
      if (userContent.includes("no") || userContent.includes("that's not what i meant") || userContent.includes("try again")) {
        analysis.identifiedIssues.push({
          type: 'misunderstanding',
          message: "User indicated misunderstanding",
          userMessage: msg.content,
          agentResponse: nextMsg.content,
          severity: 'medium',
          timestamp: msg.timestamp,
        });

        // This is likely a correction
        if (i > 0) {
          analysis.userCorrections.push({
            originalMessage: messages[i - 2]?.content || "",
            correctionMessage: msg.content,
            timestamp: msg.timestamp,
          });
        }
      }

      // Detect missing capabilities
      if (assistantContent.includes("i don't have") || assistantContent.includes("i cannot") || assistantContent.includes("unable to")) {
        const capabilityMatch = assistantContent.match(/(?:don't have|cannot|unable to)\s+([^.]+)/);
        if (capabilityMatch) {
          analysis.missingCapabilities.push(capabilityMatch[1].trim());
        }
      }

      // Detect successful interactions (positive user feedback)
      if (i < messages.length - 2) {
        const followUp = messages[i + 2];
        if (followUp?.role === "user") {
          const followUpContent = followUp.content.toLowerCase();
          if (
            followUpContent.includes("thanks") ||
            followUpContent.includes("perfect") ||
            followUpContent.includes("great") ||
            followUpContent.includes("good") ||
            followUpContent.includes("exactly")
          ) {
            analysis.successfulInteractions.push({
              userMessage: msg.content,
              agentResponse: nextMsg.content,
              timestamp: msg.timestamp,
            });
          }
        }
      }
    }
  }

  // Generate improvement suggestions based on analysis
  if (analysis.identifiedIssues.length > 0) {
    const errorCount = analysis.identifiedIssues.filter(i => i.type === 'error').length;
    if (errorCount > 2) {
      analysis.suggestedImprovements.push({
        type: 'improve_error_handling',
        description: `Agent encountered ${errorCount} errors. Improve error handling and validation.`,
        priority: 'high',
        implementation: `Add try-catch blocks and user-friendly error messages. Consider adding retry logic for failed operations.`,
      });
    }
  }

  if (analysis.missingCapabilities.length > 0) {
    analysis.missingCapabilities.forEach(cap => {
      analysis.suggestedImprovements.push({
        type: 'add_tool',
        description: `Add capability: ${cap}`,
        priority: 'high',
        implementation: `Research and add appropriate tool or function to handle: ${cap}`,
      });
    });
  }

  if (analysis.userCorrections.length > 2) {
    analysis.suggestedImprovements.push({
      type: 'modify_prompt',
      description: `Multiple user corrections detected (${analysis.userCorrections.length}). Agent may need clearer instructions.`,
      priority: 'medium',
      implementation: `Review system prompt and add more specific instructions about expected behavior.`,
    });
  }

  // Check for performance issues
  if (analysis.conversationMetrics.avgResponseLength > 1000) {
    analysis.performanceIssues.push({
      issue: "Responses are very long (avg " + Math.round(analysis.conversationMetrics.avgResponseLength) + " chars)",
      impact: "May frustrate users who want concise answers",
      recommendation: "Add instruction to be more concise, or allow users to request detailed explanations",
    });
  }

  return analysis;
}

/**
 * Store conversation analysis (internal mutation)
 */
export const storeAnalysis = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    agentId: v.id("agents"),
    analysis: v.any(),
  },
  handler: async (ctx, { conversationId, agentId, analysis }) => {
    const analysisId = await ctx.db.insert("conversationAnalyses", {
      conversationId,
      agentId,
      analysis,
      createdAt: Date.now(),
    });

    return analysisId;
  },
});

/**
 * Get analysis for a conversation (internal query)
 */
export const getAnalysis = internalQuery({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    return await ctx.db
      .query("conversationAnalyses")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("desc")
      .first();
  },
});

/**
 * Get all analyses for an agent (internal query)
 */
export const getAgentAnalyses = internalQuery({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, { agentId }) => {
    return await ctx.db
      .query("conversationAnalyses")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .order("desc")
      .collect();
  },
});

/**
 * Generate agent improvement plan based on conversation
 */
export const generateImprovementPlan = action({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx: any, args: { conversationId: Id<"conversations"> }): Promise<any> => {
    // First analyze the conversation
    const result: any = await ctx.runAction(api.conversationAnalysis.analyzeConversation, {
      conversationId: args.conversationId,
    });
    const analysis: any = result.analysis;

    // Generate comprehensive improvement plan
    const improvementPlan: any = {
      summary: generateSummary(analysis),
      criticalIssues: analysis.identifiedIssues.filter((i: any) => i.severity === 'high'),
      recommendedChanges: analysis.suggestedImprovements,
      estimatedImpact: calculateImpact(analysis),
      implementationSteps: generateImplementationSteps(analysis.suggestedImprovements),
    };

    return improvementPlan;
  },
});

function generateSummary(analysis: any): string {
  const issueCount = analysis.identifiedIssues.length;
  const successCount = analysis.successfulInteractions.length;
  const correctionCount = analysis.userCorrections.length;

  return `Conversation Analysis: ${successCount} successful interactions, ${issueCount} issues detected, ${correctionCount} user corrections needed. ${analysis.suggestedImprovements.length} improvements suggested.`;
}

function calculateImpact(analysis: any): {
  currentScore: number;
  projectedScore: number;
  improvement: string;
} {
  const total = analysis.conversationMetrics.totalMessages;
  const issues = analysis.identifiedIssues.length;
  const successes = analysis.successfulInteractions.length;

  const denom = successes + issues;
  const currentScore = denom === 0 ? 0 : Math.max(0, Math.min(100, (successes / denom) * 100));
  const projectedScore = Math.min(100, currentScore + (analysis.suggestedImprovements.length * 10));

  return {
    currentScore: Math.round(currentScore),
    projectedScore: Math.round(projectedScore),
    improvement: `+${Math.round(projectedScore - currentScore)}%`,
  };
}

function generateImplementationSteps(improvements: any[]): string[] {
  return improvements.map((imp, idx) => {
    return `${idx + 1}. [${imp.priority.toUpperCase()}] ${imp.description} - ${imp.implementation}`;
  });
}
