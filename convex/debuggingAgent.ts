/**
 * Debugging Agent Service
 *
 * An AI agent that helps debug deployment and testing issues
 */

import { action, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Analyze and debug issues with agent testing or deployment
 */
export const debugIssue = action({
  args: {
    issueType: v.string(), // "test_failure", "deployment_failure", "auth_error", etc.
    errorMessage: v.optional(v.string()),
    logs: v.optional(v.array(v.string())),
    agentId: v.optional(v.id("agents")),
    testId: v.optional(v.id("testExecutions")),
    deploymentId: v.optional(v.id("deployments")),
    context: v.optional(v.object({
      modelType: v.optional(v.string()),
      deploymentType: v.optional(v.string()),
      tools: v.optional(v.array(v.string())),
      region: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args): Promise<any> => {
    // CRITICAL: Use Convex user document ID, not OAuth provider ID
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Gather diagnostic information
    const diagnostics = await gatherDiagnostics(ctx, args);

    // Analyze the issue using AI
    const analysis = await analyzeIssue(args, diagnostics);

    // Generate recommendations
    const recommendations = await generateRecommendations(analysis, args);

    // Store the debugging session - pass Convex user ID
    const debugSessionId: string = await ctx.runMutation(internal.debuggingAgent.createDebugSession, {
      userId: userId,
      issueType: args.issueType,
      analysis,
      recommendations,
      diagnostics,
    });

    return {
      debugSessionId,
      analysis,
      recommendations,
      diagnostics,
    };
  },
});

/**
 * Get debugging suggestions for common issues
 */
export const getDebuggingSuggestions = query({
  args: { issueType: v.string() },
  handler: async (ctx, args) => {
    const suggestions = getCommonSolutions(args.issueType);
    return suggestions;
  },
});

/**
 * Get debug session history
 */
export const getDebugSessions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (_ctx, _args) => {
    // Debug sessions table not yet implemented
    // Return empty array for now
    return [];
  },
});

// ─── Module state ────────────────────────────────────────────────────────────
let warnedDebugSessionsStub = false;

// Helper Functions

async function gatherDiagnostics(ctx: any, args: any) {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    issueType: args.issueType,
  };

  // Gather agent information
  if (args.agentId) {
    try {
      const agent = await ctx.runQuery(internal.agents.getInternal, { 
        id: args.agentId 
      });
      diagnostics.agent = {
        name: agent?.name,
        model: agent?.model,
        deploymentType: agent?.deploymentType,
        toolCount: agent?.tools?.length || 0,
        codeSize: agent?.generatedCode?.length || 0,
      };
    } catch (error: unknown) {
      diagnostics.agentError = error instanceof Error ? error.message : String(error);
    }
  }

  // Gather test information
  if (args.testId) {
    try {
      const test = await ctx.runQuery(internal.testExecution.getTestByIdInternal, { 
        testId: args.testId 
      });
      diagnostics.test = {
        status: test?.status,
        phase: test?.phase,
        modelProvider: test?.modelProvider,
        timeout: test?.timeout,
        logCount: test?.logs?.length || 0,
        executionTime: test?.executionTime,
        error: test?.error,
      };
    } catch (error: unknown) {
      diagnostics.testError = error instanceof Error ? error.message : String(error);
    }
  }

  // Gather deployment information
  if (args.deploymentId) {
    try {
      const deployment = await ctx.runQuery(internal.awsDeployment.getDeploymentInternal, { 
        deploymentId: args.deploymentId 
      });
      diagnostics.deployment = {
        status: deployment?.status,
        region: deployment?.config?.region,
        agentName: deployment?.config?.agentName,
        error: deployment?.error,
        message: deployment?.message,
      };
    } catch (error: unknown) {
      diagnostics.deploymentError = error instanceof Error ? error.message : String(error);
    }
  }

  return diagnostics;
}

async function analyzeIssue(args: any, diagnostics: any) {
  // AI-powered issue analysis
  const analysis = {
    issueCategory: categorizeIssue(args.issueType, args.errorMessage),
    severity: assessSeverity(args, diagnostics),
    rootCause: identifyRootCause(args, diagnostics),
    affectedComponents: identifyAffectedComponents(diagnostics),
  };

  return analysis;
}

async function generateRecommendations(analysis: any, args: any) {
  const recommendations = [];

  // Generate specific recommendations based on issue type
  switch (args.issueType) {
    case "test_failure":
      recommendations.push(...getTestFailureRecommendations(analysis, args));
      break;
    case "deployment_failure":
      recommendations.push(...getDeploymentFailureRecommendations(analysis, args));
      break;
    case "auth_error":
      recommendations.push(...getAuthErrorRecommendations(analysis, args));
      break;
    case "model_error":
      recommendations.push(...getModelErrorRecommendations(analysis, args));
      break;
    default:
      recommendations.push(...getGeneralRecommendations(analysis, args));
  }

  return recommendations;
}

function categorizeIssue(issueType: string, errorMessage?: string): string {
  if (errorMessage) {
    if (errorMessage.includes("timeout")) return "timeout";
    if (errorMessage.includes("authentication") || errorMessage.includes("unauthorized")) return "authentication";
    if (errorMessage.includes("permission")) return "permissions";
    if (errorMessage.includes("network") || errorMessage.includes("connection")) return "network";
    if (errorMessage.includes("memory") || errorMessage.includes("resource")) return "resources";
    if (errorMessage.includes("model") || errorMessage.includes("bedrock")) return "model";
  }
  
  return issueType;
}

function assessSeverity(args: any, diagnostics: any): "low" | "medium" | "high" | "critical" {
  if (args.issueType === "deployment_failure") return "high";
  if (args.errorMessage?.includes("critical") || args.errorMessage?.includes("fatal")) return "critical";
  if (diagnostics.test?.status === "FAILED") return "medium";
  return "low";
}

function identifyRootCause(args: any, diagnostics: any): string {
  if (args.errorMessage?.includes("Not authorized")) {
    return "Authentication or authorization failure";
  }
  if (args.errorMessage?.includes("timeout")) {
    return "Operation timeout - possibly due to resource constraints or network issues";
  }
  if (diagnostics.agent?.codeSize > 100000) {
    return "Agent code size may be too large for deployment";
  }
  if (diagnostics.test?.modelProvider === "ollama" && args.errorMessage?.includes("connection")) {
    return "Ollama service connection issue";
  }
  
  return "Unknown - requires further investigation";
}

function identifyAffectedComponents(diagnostics: any): string[] {
  const components = [];
  
  if (diagnostics.agent) components.push("Agent Configuration");
  if (diagnostics.test) components.push("Test Execution");
  if (diagnostics.deployment) components.push("AWS Deployment");
  if (diagnostics.testError || diagnostics.deploymentError) components.push("System Integration");
  
  return components;
}

function getTestFailureRecommendations(_analysis: any, args: any) {
  const recommendations = [
    {
      title: "Check Agent Configuration",
      description: "Verify that your agent has the correct model and tools configured",
      action: "Review agent settings in the builder",
      priority: "high"
    },
    {
      title: "Verify Model Availability",
      description: "Ensure the selected model is available in your deployment environment",
      action: "Test with a different model or check model permissions",
      priority: "medium"
    },
    {
      title: "Check Tool Dependencies",
      description: "Some tools may require additional setup or permissions",
      action: "Review tool requirements and ensure all dependencies are met",
      priority: "medium"
    }
  ];

  if (args.errorMessage?.includes("timeout")) {
    recommendations.unshift({
      title: "Increase Timeout",
      description: "The test may need more time to complete",
      action: "Try increasing the timeout value or simplifying the test query",
      priority: "high"
    });
  }

  return recommendations;
}

function getDeploymentFailureRecommendations(_analysis: any, _args: any) {
  return [
    {
      title: "Verify AWS Credentials",
      description: "Ensure you're authenticated with AWS Cognito and have proper permissions",
      action: "Sign in with AWS Cognito and verify your account has AgentCore permissions",
      priority: "critical"
    },
    {
      title: "Check Region Availability",
      description: "AgentCore may not be available in all AWS regions",
      action: "Try deploying to us-east-1, us-west-2, or eu-central-1",
      priority: "high"
    },
    {
      title: "Review Agent Size",
      description: "Large agents may fail to deploy",
      action: "Simplify your agent or reduce the number of tools",
      priority: "medium"
    }
  ];
}

function getAuthErrorRecommendations(_analysis: any, _args: any) {
  return [
    {
      title: "Re-authenticate",
      description: "Your authentication session may have expired",
      action: "Sign out and sign back in with AWS Cognito",
      priority: "high"
    },
    {
      title: "Check Cognito Configuration",
      description: "Verify Cognito User Pool is properly configured",
      action: "Run the Cognito setup script again if needed",
      priority: "medium"
    }
  ];
}

function getModelErrorRecommendations(_analysis: any, _args: any) {
  return [
    {
      title: "Verify Model Access",
      description: "Ensure you have access to the selected model",
      action: "Check your AWS Bedrock model permissions or try a different model",
      priority: "high"
    },
    {
      title: "Check Model Availability",
      description: "Some models may not be available in your region",
      action: "Try a different region or model",
      priority: "medium"
    }
  ];
}

function getGeneralRecommendations(_analysis: any, _args: any) {
  return [
    {
      title: "Check System Status",
      description: "Verify that all services are operational",
      action: "Check AWS status page and try again later",
      priority: "low"
    },
    {
      title: "Contact Support",
      description: "If the issue persists, contact support with the debug session ID",
      action: "Provide the debug session details for further assistance",
      priority: "low"
    }
  ];
}

function getCommonSolutions(issueType: string) {
  const solutions: Record<string, any[]> = {
    "test_failure": [
      "Verify agent configuration is complete",
      "Check if the model is available",
      "Ensure test query is not too complex",
      "Try with a simpler test prompt"
    ],
    "deployment_failure": [
      "Authenticate with AWS Cognito",
      "Verify AWS region supports AgentCore",
      "Check agent size and complexity",
      "Ensure proper IAM permissions"
    ],
    "auth_error": [
      "Sign out and sign back in",
      "Clear browser cache and cookies",
      "Verify Cognito configuration",
      "Check network connectivity"
    ],
    "model_error": [
      "Verify model permissions in AWS Bedrock",
      "Try a different model",
      "Check region availability",
      "Ensure model is enabled in your account"
    ]
  };

  return solutions[issueType] || [
    "Check system logs for more details",
    "Try refreshing the page",
    "Contact support if issue persists"
  ];
}

// ============================================================================
// INTERNAL FUNCTIONS
// ============================================================================

/**
 * Create debug session (internal)
 */
export const createDebugSession = internalMutation({
  args: {
    userId: v.id("users"),
    issueType: v.string(),
    analysis: v.any(), // v.any(): debug analysis structure varies by issue type
    recommendations: v.any(), // v.any(): recommendation structure varies by issue type
    diagnostics: v.any(), // v.any(): diagnostic data varies by issue type
  },
  handler: async (_ctx, _args) => {
    // TODO: Persist to a debugSessions table once the schema migration is done.
    // Currently returns a stub ID — no data is stored.
    if ( !warnedDebugSessionsStub ) {
      console.warn( "debugSessions table not implemented — returning stub ID" );
      warnedDebugSessionsStub = true;
    }
    return `debug_${Date.now()}_${Math.random().toString( 36 ).substring( 2, 11 )}`;
  },
});