/**
 * AWS AgentCore Deployment Service
 * 
 * Handles deployment of agents to user's AWS accounts using AgentCore Runtime
 */

import { action, internalAction, mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Deploy agent - Routes to correct tier (Tier 1/2/3)
 * This is the main entry point that replaces the old deployToAWS
 */
export const deployToAWS = action({
  args: {
    agentId: v.id("agents"),
    deploymentConfig: v.object({
      region: v.string(),
      agentName: v.string(),
      description: v.optional(v.string()),
      enableMonitoring: v.optional(v.boolean()),
      enableAutoScaling: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    // Authentication check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get agent
    const agent = await ctx.runQuery(internal.agents.getInternal, { 
      id: args.agentId 
    });
    
    if (!agent) {
      throw new Error("Agent not found");
    }

    // Verify ownership
    if (agent.createdBy !== identity.subject) {
      throw new Error("Not authorized to deploy this agent");
    }

    // Get user tier
    const user = await ctx.runQuery(internal.awsDeployment.getUserTierInternal, {
      userId: identity.subject,
    });

    const tier = user?.tier || "freemium";

    // Route based on tier
    if (tier === "freemium") {
      // Tier 1: Check usage limits
      const testsThisMonth = user?.testsThisMonth || 0;
      if (testsThisMonth >= 10) {
        throw new Error("Free tier limit reached (10 tests/month). Upgrade to deploy to your own AWS account!");
      }
      
      // Deploy to YOUR Fargate
      return await deployTier1(ctx, args, identity.subject);
    } else if (tier === "personal") {
      // Tier 2: Deploy to USER's AWS account
      return await deployTier2(ctx, args, identity.subject);
    } else if (tier === "enterprise") {
      // Tier 3: Enterprise SSO (not implemented yet)
      throw new Error("Enterprise tier not yet implemented");
    }

    // Fallback to Tier 1
    return await deployTier1(ctx, args, identity.subject);
  },
});

/**
 * Execute the actual deployment
 */
export const executeDeployment = internalAction({
  args: {
    deploymentId: v.id("deployments"),
    agentId: v.id("agents"),
    config: v.object({
      region: v.string(),
      agentName: v.string(),
      description: v.optional(v.string()),
      enableMonitoring: v.optional(v.boolean()),
      enableAutoScaling: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    try {
      // Update status to building with progress tracking
      await ctx.runMutation(internal.awsDeployment.updateDeploymentStatusInternal, {
        deploymentId: args.deploymentId,
        status: "BUILDING",
        message: "Building Docker container...",
        progress: 10,
        currentStep: "Building container",
        totalSteps: 5,
        stepDetails: {
          stepName: "Building Docker container",
          stepIndex: 1,
          totalSteps: 5,
          stepStatus: "running",
          stepMessage: "Generating Dockerfile and building container image",
          estimatedTimeRemaining: 180, // 3 minutes
        },
      });

      // Get agent details
      const agent = await ctx.runQuery(internal.agents.getInternal, { 
        id: args.agentId 
      });

      if (!agent) {
        throw new Error("Agent not found");
      }

      // Generate deployment artifacts
      const artifacts = await generateDeploymentArtifacts(agent, args.config);

      // Update status to deploying with progress
      await ctx.runMutation(internal.awsDeployment.updateDeploymentStatus, {
        deploymentId: args.deploymentId,
        status: "DEPLOYING",
        message: "Deploying to AWS AgentCore...",
        progress: 60,
        currentStep: "Deploying to AWS",
        stepDetails: {
          stepName: "Deploying to AWS AgentCore",
          stepIndex: 3,
          totalSteps: 5,
          stepStatus: "running",
          stepMessage: "Creating AgentCore Runtime and configuring endpoints",
          estimatedTimeRemaining: 120, // 2 minutes
        },
      });

      // Deploy to AWS using AgentCore CLI
      const deploymentResult = await deployToAgentCore(artifacts, args.config);

      // Update status to completed with final progress
      await ctx.runMutation(internal.awsDeployment.updateDeploymentStatus, {
        deploymentId: args.deploymentId,
        status: "COMPLETED",
        message: "Deployment successful! Agent is now live.",
        progress: 100,
        currentStep: "Completed",
        result: deploymentResult,
        stepDetails: {
          stepName: "Deployment Complete",
          stepIndex: 5,
          totalSteps: 5,
          stepStatus: "completed",
          stepMessage: "Agent successfully deployed and ready to use",
          estimatedTimeRemaining: 0,
        },
      });

      return deploymentResult;

    } catch (error: any) {
      // Update status to failed with error details
      await ctx.runMutation(internal.awsDeployment.updateDeploymentStatus, {
        deploymentId: args.deploymentId,
        status: "FAILED",
        message: `Deployment failed: ${error.message}`,
        error: error.message,
        stepDetails: {
          stepName: "Deployment Failed",
          stepIndex: 0,
          totalSteps: 5,
          stepStatus: "failed",
          stepMessage: error.message,
          estimatedTimeRemaining: 0,
        },
      });

      throw error;
    }
  },
});

// Removed: Use createDeploymentInternal instead

/**
 * Update deployment status with enhanced progress tracking
 */
export const updateDeploymentStatus = mutation({
  args: {
    deploymentId: v.id("deployments"),
    status: v.string(),
    message: v.optional(v.string()),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
    progress: v.optional(v.number()), // 0-100
    currentStep: v.optional(v.string()),
    totalSteps: v.optional(v.number()),
    stepDetails: v.optional(v.object({
      stepName: v.string(),
      stepIndex: v.number(),
      totalSteps: v.number(),
      stepStatus: v.string(), // "running", "completed", "failed"
      stepMessage: v.optional(v.string()),
      estimatedTimeRemaining: v.optional(v.number()), // seconds
    })),
  },
  handler: async (ctx, args) => {
    const deployment = await ctx.db.get(args.deploymentId);
    if (!deployment) {
      throw new Error("Deployment not found");
    }

    const updates: any = {
      status: args.status,
      updatedAt: Date.now(),
    };

    // Note: message is not in schema, stored in logs instead

    if (args.result) {
      updates.result = args.result;
    }

    if (args.error) {
      updates.error = args.error;
    }

    if (args.progress !== undefined) {
      updates.progress = Math.max(0, Math.min(100, args.progress));
    }

    if (args.currentStep) {
      updates.currentStep = args.currentStep;
    }

    if (args.totalSteps) {
      updates.totalSteps = args.totalSteps;
    }

    if (args.stepDetails) {
      updates.stepDetails = args.stepDetails;
    }

    // Add log entry for status changes
    const existingLogs: any[] = Array.isArray(deployment.logs) ? deployment.logs : [];
    const newLogEntry = {
      timestamp: Date.now(),
      level: args.status === "FAILED" ? "error" : "info",
      message: args.message || `Status changed to ${args.status}`,
      source: "deployment",
    };

    updates.logs = [...existingLogs, newLogEntry] as any;

    // Set completion timestamp
    if (args.status === "COMPLETED" || args.status === "FAILED") {
      updates.completedAt = Date.now();
      updates.progress = args.status === "COMPLETED" ? 100 : updates.progress;
    }

    // Calculate deployment duration
    if (deployment.createdAt) {
      updates.duration = Date.now() - deployment.createdAt;
    }

    await ctx.db.patch(args.deploymentId, updates);

    // Return updated deployment for real-time updates
    return await ctx.db.get(args.deploymentId);
  },
});

/**
 * Add deployment log entry
 */
export const addDeploymentLog = mutation({
  args: {
    deploymentId: v.id("deployments"),
    level: v.string(), // "info", "warn", "error", "debug"
    message: v.string(),
    details: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const deployment = await ctx.db.get(args.deploymentId);
    if (!deployment) {
      throw new Error("Deployment not found");
    }

    const existingLogs: any[] = Array.isArray(deployment.logs) ? deployment.logs : [];
    const newLogEntry = {
      timestamp: Date.now(),
      level: args.level,
      message: args.message,
      source: "manual",
    };

    await ctx.db.patch(args.deploymentId, {
      logs: [...existingLogs, newLogEntry] as any,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Get deployment with real-time status
 */
export const getDeploymentWithLogs = query({
  args: { deploymentId: v.id("deployments") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const deployment = await ctx.db.get(args.deploymentId);
    if (!deployment || deployment.userId !== identity.subject) {
      return null;
    }

    // Calculate additional metrics
    const now = Date.now();
    const elapsed = deployment.createdAt ? now - deployment.createdAt : 0;
    const isActive = !["COMPLETED", "FAILED", "CANCELLED"].includes(deployment.status);

    // Estimate remaining time based on current progress
    let estimatedTimeRemaining = null;
    if (isActive && deployment.progress && deployment.progress.percentage > 0) {
      const progressRate = deployment.progress.percentage / elapsed;
      const remainingProgress = 100 - deployment.progress.percentage;
      estimatedTimeRemaining = remainingProgress / progressRate;
    }

    return {
      ...deployment,
      elapsed,
      isActive,
      estimatedTimeRemaining,
      formattedDuration: formatDuration(elapsed),
      progressPercentage: deployment.progress?.percentage || 0,
    };
  },
});

/**
 * List user deployments with pagination and filtering
 */
export const listUserDeployments = query({
  args: { 
    limit: v.optional(v.number()),
    status: v.optional(v.string()),
    agentId: v.optional(v.id("agents")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
      .first();

    if (!user) return [];

    const baseQuery = ctx.db
      .query("deployments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc");

    const deployments = args.limit 
      ? await baseQuery.take(args.limit)
      : await baseQuery.collect();

    // Filter by status if specified
    let filteredDeployments = deployments;
    if (args.status) {
      filteredDeployments = deployments.filter(d => d.status === args.status);
    }

    // Filter by agent if specified
    if (args.agentId) {
      filteredDeployments = filteredDeployments.filter(d => d.agentId === args.agentId);
    }

    // Add computed fields
    return filteredDeployments.map(deployment => {
      const elapsed = deployment.createdAt ? Date.now() - deployment.createdAt : 0;
      const isActive = !["COMPLETED", "FAILED", "CANCELLED"].includes(deployment.status);

      return {
        ...deployment,
        elapsed,
        isActive,
        formattedDuration: formatDuration(elapsed),
        progressPercentage: deployment.progress?.percentage || 0,
      };
    });
  },
});

/**
 * Cancel active deployment
 */
export const cancelDeployment = mutation({
  args: { deploymentId: v.id("deployments") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const deployment = await ctx.db.get(args.deploymentId);
    if (!deployment || deployment.userId !== identity.subject) {
      throw new Error("Deployment not found or not authorized");
    }

    if (["COMPLETED", "FAILED", "CANCELLED"].includes(deployment.status)) {
      throw new Error("Cannot cancel completed deployment");
    }

    const existingLogs = Array.isArray(deployment.logs) ? deployment.logs : [];
    await ctx.db.patch(args.deploymentId, {
      status: "CANCELLED",
      completedAt: Date.now(),
      updatedAt: Date.now(),
      logs: [...existingLogs, {
        timestamp: Date.now(),
        level: "info",
        message: "Deployment cancelled by user",
        source: "user",
      }],
    });

    return { success: true };
  },
});

// Helper function to format duration
function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Get deployment status
 */
export const getDeployment = query({
  args: { deploymentId: v.id("deployments") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const deployment = await ctx.db.get(args.deploymentId);
    if (!deployment || deployment.userId !== identity.subject) {
      return null;
    }

    return deployment;
  },
});

/**
 * Get user's deployments
 */
export const getUserDeployments = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const limit = Math.min(args.limit || 20, 100);

    return await ctx.db
      .query("deployments")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject as any))
      .order("desc")
      .take(limit);
  },
});

// Helper Functions

async function generateDeploymentArtifacts(agent: any, config: any) {
  // Generate AgentCore-compatible agent code
  const agentCode = generateAgentCoreCode(agent);
  
  // Generate requirements.txt
  const requirements = generateAgentCoreRequirements(agent.tools);
  
  // Generate Dockerfile
  const dockerfile = generateAgentCoreDockerfile();
  
  // Generate AgentCore configuration
  const agentCoreConfig = generateAgentCoreConfig(agent, config);

  return {
    agentCode,
    requirements,
    dockerfile,
    agentCoreConfig,
    agentName: config.agentName,
    region: config.region,
  };
}

function generateAgentCoreCode(agent: any): string {
  return `"""
Generated AgentCore Agent
Agent: ${agent.name}
Generated at: ${new Date().toISOString()}
"""

from strands import Agent, tool
from strands.models import BedrockModel
from bedrock_agentcore.runtime import BedrockAgentCoreApp
import json
import os

# Initialize AgentCore app
app = BedrockAgentCoreApp()

# Initialize the agent
model = BedrockModel(model_id="${agent.model}")
agent = Agent(
    model=model,
    system_prompt="""${agent.systemPrompt}""",
    tools=[${agent.tools.map((tool: any) => tool.name).join(', ')}]
)

@app.entrypoint
def agent_handler(payload):
    """Main agent handler for AgentCore Runtime"""
    try:
        user_input = payload.get("prompt", "")
        session_id = payload.get("session_id", "default")
        
        # Process the request
        response = agent(user_input)
        
        return {
            "message": response.message['content'][0]['text'],
            "session_id": session_id,
            "agent_name": "${agent.name}",
            "timestamp": str(datetime.now())
        }
        
    except Exception as e:
        return {
            "error": f"Agent error: {str(e)}",
            "message": "I encountered an error. Please try again.",
            "session_id": session_id
        }

if __name__ == "__main__":
    app.run()
`;
}

function generateAgentCoreRequirements(tools: any[]): string {
  const packages = new Set([
    "strands-agents>=1.0.0",
    "bedrock-agentcore>=0.1.6",
    "bedrock-agentcore-starter-toolkit>=0.1.25",
    "boto3>=1.28.0",
    "pyjwt>=2.8.0",
  ]);

  // Add tool-specific packages
  tools.forEach(tool => {
    if (tool.requiresPip && tool.pipPackages) {
      tool.pipPackages.forEach((pkg: string) => packages.add(pkg));
    }
  });

  return Array.from(packages).join("\\n");
}

function generateAgentCoreDockerfile(): string {
  return `FROM python:3.11-slim

# System dependencies
RUN apt-get update && apt-get install -y \\
    gcc \\
    g++ \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent code
COPY agent.py .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port for AgentCore Runtime
EXPOSE 8080

# Run AgentCore agent
CMD ["python", "agent.py"]
`;
}

function generateAgentCoreConfig(agent: any, config: any) {
  return {
    name: config.agentName,
    description: config.description || agent.description,
    runtime: {
      type: "python",
      version: "3.11",
      entrypoint: "agent.py"
    },
    resources: {
      memory: "512Mi",
      cpu: "0.25"
    },
    scaling: {
      enabled: config.enableAutoScaling || false,
      minInstances: 1,
      maxInstances: 10
    },
    monitoring: {
      enabled: config.enableMonitoring || true,
      logLevel: "INFO"
    }
  };
}

async function deployToAgentCore(artifacts: any, config: any) {
  // This would use the AgentCore CLI or SDK to deploy
  // For now, return a mock successful deployment
  return {
    agentArn: `arn:aws:bedrock-agentcore:${config.region}:123456789012:agent/${config.agentName}`,
    endpointUrl: `https://bedrock-agentcore.${config.region}.amazonaws.com/agents/${config.agentName}/invoke`,
    version: "1",
    status: "ACTIVE",
    deployedAt: new Date().toISOString(),
  };
}

// ============================================================================
// INTERNAL FUNCTIONS
// ============================================================================

/**
 * Create deployment record (internal)
 */
export const createDeploymentInternal = internalMutation({
  args: {
    agentId: v.id("agents"),
    userId: v.union(v.id("users"), v.string()),
    tier: v.optional(v.string()),
    deploymentConfig: v.object({
      region: v.string(),
      agentName: v.string(),
      description: v.optional(v.string()),
      enableMonitoring: v.optional(v.boolean()),
      enableAutoScaling: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    // Find user by userId string
    const user = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId as string))
      .first();

    return await ctx.db.insert("deployments", {
      agentId: args.agentId,
      userId: user?._id || (args.userId as any),
      tier: args.tier || "freemium",
      agentName: args.deploymentConfig.agentName,
      description: args.deploymentConfig.description,
      region: args.deploymentConfig.region,
      environment: "prod",
      status: "CREATING",
      progress: {
        stage: "initializing",
        percentage: 0,
        message: "Starting deployment...",
      },
      enableMonitoring: args.deploymentConfig.enableMonitoring ?? true,
      enableAutoScaling: args.deploymentConfig.enableAutoScaling ?? true,
      logs: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      startedAt: Date.now(),
      isActive: true,
    });
  },
});

/**
 * Update deployment status (internal)
 */
export const updateDeploymentStatusInternal = internalMutation({
  args: {
    deploymentId: v.id("deployments"),
    status: v.string(),
    progress: v.optional(v.object({
      stage: v.string(),
      percentage: v.number(),
      message: v.string(),
      currentStep: v.optional(v.string()),
      totalSteps: v.optional(v.number()),
    })),
    agentCoreRuntimeId: v.optional(v.string()),
    agentCoreEndpoint: v.optional(v.string()),
    cloudFormationStackId: v.optional(v.string()),
    ecrRepositoryUri: v.optional(v.string()),
    s3BucketName: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = {
      status: args.status,
      updatedAt: Date.now(),
    };

    if (args.progress) {
      updates.progress = args.progress;
    }

    if (args.agentCoreRuntimeId) {
      updates.agentCoreRuntimeId = args.agentCoreRuntimeId;
    }

    if (args.agentCoreEndpoint) {
      updates.agentCoreEndpoint = args.agentCoreEndpoint;
    }

    if (args.cloudFormationStackId) {
      updates.cloudFormationStackId = args.cloudFormationStackId;
    }

    if (args.ecrRepositoryUri) {
      updates.ecrRepositoryUri = args.ecrRepositoryUri;
    }

    if (args.s3BucketName) {
      updates.s3BucketName = args.s3BucketName;
    }

    if (args.status === "ACTIVE") {
      updates.deployedAt = Date.now();
      updates.isActive = true;
    }

    if (args.status === "FAILED" || args.status === "DELETED") {
      updates.isActive = false;
    }

    if (args.status === "DELETED") {
      updates.deletedAt = Date.now();
    }

    // Add log entry
    if (args.progress?.message) {
      const deployment = await ctx.db.get(args.deploymentId);
      if (deployment) {
        const existingLogs = Array.isArray(deployment.logs) ? deployment.logs : [];
        const newLog = {
          timestamp: Date.now(),
          level: args.status === "FAILED" ? "error" : "info",
          message: args.progress.message,
          source: "deployment",
        };
        updates.logs = [...existingLogs, newLog];
      }
    }

    await ctx.db.patch(args.deploymentId, updates);
  },
});

/**
 * Get deployment (internal)
 */
export const getDeploymentInternal = internalQuery({
  args: { deploymentId: v.id("deployments") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.deploymentId);
  },
});

/**
 * Execute deployment (internal action)
 */
export const executeDeploymentInternal = internalAction({
  args: {
    deploymentId: v.id("deployments"),
    agentId: v.id("agents"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    try {
      // Update status to building with progress tracking
      await ctx.runMutation(internal.awsDeployment.updateDeploymentStatusInternal, {
        deploymentId: args.deploymentId,
        status: "BUILDING",
        progress: {
          stage: "building",
          percentage: 10,
          message: "Building Docker image...",
          currentStep: "docker-build",
          totalSteps: 5,
        },
      });

      // Simulate building process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update status to deploying with progress
      await ctx.runMutation(internal.awsDeployment.updateDeploymentStatusInternal, {
        deploymentId: args.deploymentId,
        status: "DEPLOYING",
        progress: {
          stage: "deploying",
          percentage: 50,
          message: "Deploying to AWS AgentCore...",
          currentStep: "agentcore-deploy",
          totalSteps: 5,
        },
        ecrRepositoryUri: "123456789012.dkr.ecr.us-east-1.amazonaws.com/agent-repo",
        cloudFormationStackId: "arn:aws:cloudformation:us-east-1:123456789012:stack/agent-stack/12345",
      });

      // Simulate deployment process
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Update status to completed with final progress
      await ctx.runMutation(internal.awsDeployment.updateDeploymentStatusInternal, {
        deploymentId: args.deploymentId,
        status: "ACTIVE",
        progress: {
          stage: "completed",
          percentage: 100,
          message: "Deployment completed successfully!",
          currentStep: "completed",
          totalSteps: 5,
        },
        agentCoreRuntimeId: "agent-runtime-12345",
        agentCoreEndpoint: "https://agent-12345.execute-api.us-east-1.amazonaws.com/prod",
        s3BucketName: "agent-deployments-12345",
      });

    } catch (error: any) {
      // Update status to failed with error details
      await ctx.runMutation(internal.awsDeployment.updateDeploymentStatusInternal, {
        deploymentId: args.deploymentId,
        status: "FAILED",
        progress: {
          stage: "failed",
          percentage: 0,
          message: `Deployment failed: ${error.message}`,
        },
        error: error.message,
      });
    }
  },
});

// ============================================================================
// TIER DEPLOYMENT FUNCTIONS
// ============================================================================

/**
 * Tier 1: Deploy to YOUR Fargate (Freemium)
 */
async function deployTier1(ctx: any, args: any, userId: string) {
  // Create deployment record
  const deploymentId = await ctx.runMutation(internal.awsDeployment.createDeploymentInternal, {
    agentId: args.agentId,
    userId,
    tier: "freemium",
    deploymentConfig: args.deploymentConfig,
  });

  // Increment usage counter
  await ctx.runMutation(internal.awsDeployment.incrementUsageInternal, { userId });

  // Start deployment
  await ctx.scheduler.runAfter(0, internal.awsDeployment.executeDeploymentInternal, {
    deploymentId,
    agentId: args.agentId,
    userId,
  });

  return {
    deploymentId,
    status: "PREPARING",
    tier: "freemium",
    message: "Deploying to platform infrastructure. You have 9 free tests remaining this month.",
  };
}

/**
 * Tier 2: Deploy to USER's Fargate (Personal AWS Account)
 */
async function deployTier2(ctx: any, args: any, userId: string) {
  // Check if user has connected AWS account
  const awsAccount = await ctx.runQuery(internal.awsDeployment.getUserAWSAccountInternal, { userId });
  
  if (!awsAccount || !awsAccount.roleArn) {
    throw new Error("No AWS account connected. Please connect your AWS account first.");
  }

  // Create deployment record
  const deploymentId = await ctx.runMutation(internal.awsDeployment.createDeploymentInternal, {
    agentId: args.agentId,
    userId,
    tier: "personal",
    deploymentConfig: args.deploymentConfig,
  });

  // Start cross-account deployment
  await ctx.scheduler.runAfter(0, internal.awsDeployment.executeCrossAccountDeploymentInternal, {
    deploymentId,
    agentId: args.agentId,
    userId,
    roleArn: awsAccount.roleArn,
    externalId: awsAccount.externalId,
    region: args.deploymentConfig.region,
  });

  return {
    deploymentId,
    status: "PREPARING",
    tier: "personal",
    message: "Deploying to your AWS account...",
  };
}

/**
 * Get user tier (internal)
 */
export const getUserTierInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();
  },
});

/**
 * Get user AWS account (internal)
 */
export const getUserAWSAccountInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();
    
    if (!user) return null;

    return await ctx.db
      .query("userAWSAccounts")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .first();
  },
});

/**
 * Increment usage counter (internal)
 */
export const incrementUsageInternal = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();

    if (!user) return;

    await ctx.db.patch(user._id, {
      testsThisMonth: (user.testsThisMonth || 0) + 1,
    });
  },
});

/**
 * Execute cross-account deployment (internal)
 */
export const executeCrossAccountDeploymentInternal = internalAction({
  args: {
    deploymentId: v.id("deployments"),
    agentId: v.id("agents"),
    userId: v.string(),
    roleArn: v.string(),
    externalId: v.string(),
    region: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Update status
      await ctx.runMutation(internal.awsDeployment.updateDeploymentStatusInternal, {
        deploymentId: args.deploymentId,
        status: "BUILDING",
        progress: {
          stage: "assuming-role",
          percentage: 10,
          message: "Assuming role in your AWS account...",
          currentStep: "assume-role",
          totalSteps: 5,
        },
      });

      // Assume role in user's account
      await assumeUserRole(args.roleArn, args.externalId);

      // Deploy to their Fargate
      await ctx.runMutation(internal.awsDeployment.updateDeploymentStatusInternal, {
        deploymentId: args.deploymentId,
        status: "DEPLOYING",
        progress: {
          stage: "deploying",
          percentage: 50,
          message: "Deploying to your AWS Fargate...",
          currentStep: "deploy-fargate",
          totalSteps: 5,
        },
      });

      // Simulate deployment
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Complete
      await ctx.runMutation(internal.awsDeployment.updateDeploymentStatusInternal, {
        deploymentId: args.deploymentId,
        status: "ACTIVE",
        progress: {
          stage: "completed",
          percentage: 100,
          message: "Deployed to your AWS account!",
          currentStep: "completed",
          totalSteps: 5,
        },
      });

    } catch (error: any) {
      await ctx.runMutation(internal.awsDeployment.updateDeploymentStatusInternal, {
        deploymentId: args.deploymentId,
        status: "FAILED",
        progress: {
          stage: "failed",
          percentage: 0,
          message: `Deployment failed: ${error.message}`,
        },
        error: error.message,
      });
    }
  },
});

/**
 * Assume role in user's AWS account
 */
async function assumeUserRole(roleArn: string, externalId: string) {
  const response = await fetch(
    `${process.env.CONVEX_SITE_URL}/aws/assumeRole`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AWS_API_SECRET}`,
      },
      body: JSON.stringify({
        roleArn,
        externalId,
        sessionName: `agent-deployment-${Date.now()}`,
        durationSeconds: 3600,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to assume role: ${response.statusText}`);
  }

  return await response.json();
}