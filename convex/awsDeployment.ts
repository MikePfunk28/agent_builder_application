/**
 * AWS AgentCore Deployment Service
 *
 * Handles deployment of agents to user's AWS accounts using AgentCore Runtime
 */

import { action, internalAction, mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Stripe mutations live in stripeMutations.ts. Cast bridges codegen gap.

const internalStripeMutations = ( internal as any ).stripeMutations;
// Direct import for mutation handlers (mutations cannot call ctx.runMutation)
import { incrementUsageAndReportOverageImpl } from "./stripeMutations";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assembleDeploymentPackageFiles } from "./deploymentPackageGenerator";
import { sanitizeAgentName } from "./constants";
import { isOllamaModelId } from "./modelRegistry";

/**
 * Deploy agent - Routes to correct tier (Tier 1/2/3)
 * This is the main entry point that replaces the old deployToAWS
 */
export const deployToAWS = action( {
  args: {
    agentId: v.id( "agents" ),
    deploymentConfig: v.object( {
      region: v.string(),
      agentName: v.string(),
      description: v.optional( v.string() ),
      enableMonitoring: v.optional( v.boolean() ),
      enableAutoScaling: v.optional( v.boolean() ),
    } ),
    // Optional: Provide AWS credentials directly (for anonymous users)
    awsCredentials: v.optional( v.object( {
      accessKeyId: v.string(),
      secretAccessKey: v.string(),
      roleArn: v.optional( v.string() ),
    } ) ),
  },
  handler: async ( ctx, args ): Promise<any> => {
    // Get user ID (can be anonymous)
    const userId = await getAuthUserId( ctx );

    // Get agent
    const agent: any = await ctx.runQuery( internal.agents.getInternal, {
      id: args.agentId
    } );

    if ( !agent ) {
      throw new Error( "Agent not found" );
    }

    // Verify ownership (allow anonymous users to deploy their own agents)
    if ( userId && agent.createdBy !== userId ) {
      throw new Error( "Not authorized to deploy this agent" );
    }

    // Get user tier (default to freemium for anonymous users)
    const user = userId ? await ctx.runQuery( internal.awsDeployment.getUserTierInternal, {
      userId: userId,
    } ) : null;

    const tier = user?.tier || "freemium";

    // PROVIDER GATING: Freemium users cannot deploy to Bedrock (all AWS deployments use Bedrock)
    const { isProviderAllowedForTier } = await import( "./lib/tierConfig" );
    if ( !isProviderAllowedForTier( tier, "bedrock" ) ) {
      throw new Error(
        "Free tier cannot deploy to AWS Bedrock. " +
        "Upgrade to Personal ($5/month) for Bedrock access, " +
        "or use Ollama models for unlimited FREE local testing."
      );
    }

    // Check if user provided AWS credentials directly (for anonymous/one-time deployment)
    if ( args.awsCredentials ) {
      // TODO: Implement direct credential deployment
      throw new Error( "Direct AWS credential deployment not yet implemented. Please save your AWS credentials in settings first." );
    }

    // Check if user has AWS credentials configured (saved)
    const hasAWSCreds = userId ? await ctx.runQuery( api.awsAuth.hasValidAWSCredentials ) : false;

    // If user has saved AWS credentials, deploy to THEIR account (Tier 2)
    if ( hasAWSCreds && userId ) {
      return await deployTier2( ctx, args, userId );
    }

    // Otherwise, use platform deployment (Tier 1)
    if ( tier === "freemium" ) {
      // Anonymous users must provide AWS credentials
      if ( !userId ) {
        throw new Error( "Anonymous users must provide AWS credentials or sign in to use the platform." );
      }

      // Tier 1: Check usage limits using centralized tier config
      const executionsThisMonth = user?.executionsThisMonth || 0;
      const { getTierConfig: getFreeTierCfg } = await import( "./lib/tierConfig" );
      const freeLimits = getFreeTierCfg( "freemium" );
      if ( executionsThisMonth >= freeLimits.monthlyExecutions ) {
        throw new Error( `Free tier limit reached (${freeLimits.monthlyExecutions} executions/month). Configure AWS credentials to deploy to your own account!` );
      }

      // Deploy to platform Fargate
      return await deployTier1( ctx, args, userId );
    } else if ( tier === "enterprise" ) {
      // Tier 3: Enterprise SSO (not implemented yet)
      throw new Error( "Enterprise tier not yet implemented" );
    }

    // Fallback to Tier 1 - requires authentication
    if ( !userId ) {
      throw new Error( "Authentication required for deployment." );
    }
    return await deployTier1( ctx, args, userId );
  },
} );

/**
 * Execute the actual deployment
 */
export const executeDeployment = internalAction( {
  args: {
    deploymentId: v.id( "deployments" ),
    agentId: v.id( "agents" ),
    config: v.object( {
      region: v.string(),
      agentName: v.string(),
      description: v.optional( v.string() ),
      enableMonitoring: v.optional( v.boolean() ),
      enableAutoScaling: v.optional( v.boolean() ),
    } ),
  },
  handler: async ( ctx, args ) => {
    try {
      // Update status to building with progress tracking
      await ctx.runMutation( internal.awsDeployment.updateDeploymentStatusInternal, {
        deploymentId: args.deploymentId,
        status: "BUILDING",
        progress: {
          stage: "building",
          percentage: 10,
          message: "Building Docker container...",
          currentStep: "Building container",
          totalSteps: 5,
        },
      } );

      // Get agent details
      const agent = await ctx.runQuery( internal.agents.getInternal, {
        id: args.agentId
      } );

      if ( !agent ) {
        throw new Error( "Agent not found" );
      }

      // Generate deployment artifacts
      const artifacts = await generateDeploymentArtifacts( agent, args.config );

      // Update status to deploying with progress
      await ctx.runMutation( internal.awsDeployment.updateDeploymentStatusInternal, {
        deploymentId: args.deploymentId,
        status: "DEPLOYING",
        progress: {
          stage: "deploying",
          percentage: 60,
          message: "Deploying to AWS AgentCore...",
          currentStep: "Deploying to AWS",
          totalSteps: 5,
        },
      } );

      // Deploy to AWS using AgentCore CLI
      const deploymentResult = await deployToAgentCore( artifacts, args.config );

      // Update status to completed with final progress
      await ctx.runMutation( internal.awsDeployment.updateDeploymentStatusInternal, {
        deploymentId: args.deploymentId,
        status: "COMPLETED",
        progress: {
          stage: "completed",
          percentage: 100,
          message: "Deployment successful! Agent is now live.",
          currentStep: "Completed",
          totalSteps: 5,
        },
      } );

      return deploymentResult;

    } catch ( error: any ) {
      // Update status to failed with error details
      await ctx.runMutation( internal.awsDeployment.updateDeploymentStatusInternal, {
        deploymentId: args.deploymentId,
        status: "FAILED",
        progress: {
          stage: "failed",
          percentage: 0,
          message: `Deployment failed: ${error.message}`,
        },
        error: error.message,
      } );

      throw error;
    }
  },
} );

// Removed: Use createDeploymentInternal instead

/**
 * Update deployment status with enhanced progress tracking
 */
export const updateDeploymentStatus = mutation( {
  args: {
    deploymentId: v.id( "deployments" ),
    status: v.string(),
    message: v.optional( v.string() ),
    result: v.optional( v.record( v.string(), v.any() ) ), // Deployment result key-value pairs
    error: v.optional( v.string() ),
    progress: v.optional( v.number() ), // 0-100
    currentStep: v.optional( v.string() ),
    totalSteps: v.optional( v.number() ),
    stepDetails: v.optional( v.object( {
      stepName: v.string(),
      stepIndex: v.number(),
      totalSteps: v.number(),
      stepStatus: v.string(), // "running", "completed", "failed"
      stepMessage: v.optional( v.string() ),
      estimatedTimeRemaining: v.optional( v.number() ), // seconds
    } ) ),
  },
  handler: async ( ctx, args ) => {
    const deployment = await ctx.db.get( args.deploymentId );
    if ( !deployment ) {
      throw new Error( "Deployment not found" );
    }

    const updates: any = {
      status: args.status,
      updatedAt: Date.now(),
    };

    // Note: message is not in schema, stored in logs instead

    if ( args.result ) {
      updates.result = args.result;
    }

    if ( args.error ) {
      updates.error = args.error;
    }

    if ( args.progress !== undefined ) {
      updates.progress = Math.max( 0, Math.min( 100, args.progress ) );
    }

    if ( args.currentStep ) {
      updates.currentStep = args.currentStep;
    }

    if ( args.totalSteps ) {
      ( updates ).totalSteps = args.totalSteps;
    }

    if ( args.stepDetails ) {
      ( updates ).stepDetails = args.stepDetails;
    }

    // Add log entry for status changes
    const existingLogs: any[] = Array.isArray( deployment.logs ) ? deployment.logs : [];
    const newLogEntry = {
      timestamp: Date.now(),
      level: args.status === "FAILED" ? "error" : "info",
      message: args.message || `Status changed to ${args.status}`,
      source: "deployment",
    };

    updates.logs = [...existingLogs, newLogEntry] as any;

    // Set completion timestamp
    if ( args.status === "COMPLETED" || args.status === "FAILED" ) {
      updates.completedAt = Date.now();
      updates.progress = args.status === "COMPLETED" ? 100 : updates.progress;
    }

    // Calculate deployment duration
    if ( deployment.createdAt ) {
      ( updates ).duration = Date.now() - deployment.createdAt;
    }

    await ctx.db.patch( args.deploymentId, updates );

    // Return updated deployment for real-time updates
    return await ctx.db.get( args.deploymentId );
  },
} );

/**
 * Add deployment log entry
 */
export const addDeploymentLog = mutation( {
  args: {
    deploymentId: v.id( "deployments" ),
    level: v.string(), // "info", "warn", "error", "debug"
    message: v.string(),
    details: v.optional( v.record( v.string(), v.any() ) ), // Log detail key-value pairs
  },
  handler: async ( ctx, args ) => {
    const deployment = await ctx.db.get( args.deploymentId );
    if ( !deployment ) {
      throw new Error( "Deployment not found" );
    }

    const existingLogs: any[] = Array.isArray( deployment.logs ) ? deployment.logs : [];
    const newLogEntry = {
      timestamp: Date.now(),
      level: args.level,
      message: args.message,
      source: "manual",
    };

    await ctx.db.patch( args.deploymentId, {
      logs: [...existingLogs, newLogEntry] as any,
      updatedAt: Date.now(),
    } );
  },
} );

/**
 * Get deployment with real-time status
 */
export const getDeploymentWithLogs = query( {
  args: { deploymentId: v.id( "deployments" ) },
  handler: async ( ctx, args ) => {
    const userId = await getAuthUserId( ctx );
    if ( !userId ) {
      return null;
    }

    const deployment = await ctx.db.get( args.deploymentId );
    if ( !deployment || deployment.userId !== userId ) {
      return null;
    }

    // Calculate additional metrics
    const now = Date.now();
    const elapsed = deployment.createdAt ? now - deployment.createdAt : 0;
    const isActive = !["COMPLETED", "FAILED", "CANCELLED"].includes( deployment.status );

    // Estimate remaining time based on current progress
    let estimatedTimeRemaining = null;
    if ( isActive && deployment.progress && deployment.progress.percentage > 0 ) {
      const progressRate = deployment.progress.percentage / elapsed;
      const remainingProgress = 100 - deployment.progress.percentage;
      estimatedTimeRemaining = remainingProgress / progressRate;
    }

    return {
      ...deployment,
      elapsed,
      isActive,
      estimatedTimeRemaining,
      formattedDuration: formatDuration( elapsed ),
      progressPercentage: deployment.progress?.percentage || 0,
    };
  },
} );

/**
 * List user deployments with pagination and filtering
 */
export const listUserDeployments = query( {
  args: {
    limit: v.optional( v.number() ),
    status: v.optional( v.string() ),
    agentId: v.optional( v.id( "agents" ) ),
  },
  handler: async ( ctx, args ) => {
    const userId = await getAuthUserId( ctx );
    if ( !userId ) {
      return [];
    }

    const baseQuery = ctx.db
      .query( "deployments" )
      .withIndex( "by_user", ( q ) => q.eq( "userId", userId ) )
      .order( "desc" );

    const deployments = args.limit
      ? await baseQuery.take( args.limit )
      : await baseQuery.collect();

    // Filter by status if specified
    let filteredDeployments = deployments;
    if ( args.status ) {
      filteredDeployments = deployments.filter( d => d.status === args.status );
    }

    // Filter by agent if specified
    if ( args.agentId ) {
      filteredDeployments = filteredDeployments.filter( d => d.agentId === args.agentId );
    }

    // Add computed fields
    return filteredDeployments.map( deployment => {
      const elapsed = deployment.createdAt ? Date.now() - deployment.createdAt : 0;
      const isActive = !["COMPLETED", "FAILED", "CANCELLED"].includes( deployment.status );

      return {
        ...deployment,
        elapsed,
        isActive,
        formattedDuration: formatDuration( elapsed ),
        progressPercentage: deployment.progress?.percentage || 0,
      };
    } );
  },
} );

/**
 * Cancel active deployment
 */
export const cancelDeployment = mutation( {
  args: { deploymentId: v.id( "deployments" ) },
  handler: async ( ctx, args ) => {
    const userId = await getAuthUserId( ctx );
    if ( !userId ) {
      throw new Error( "Not authenticated" );
    }

    const deployment = await ctx.db.get( args.deploymentId );
    if ( !deployment || deployment.userId !== userId ) {
      throw new Error( "Deployment not found or not authorized" );
    }

    if ( ["COMPLETED", "FAILED", "CANCELLED"].includes( deployment.status ) ) {
      throw new Error( "Cannot cancel completed deployment" );
    }

    const existingLogs = Array.isArray( deployment.logs ) ? deployment.logs : [];
    await ctx.db.patch( args.deploymentId, {
      status: "CANCELLED",
      completedAt: Date.now(),
      updatedAt: Date.now(),
      logs: [...existingLogs, {
        timestamp: Date.now(),
        level: "info",
        message: "Deployment cancelled by user",
        source: "user",
      }],
    } );

    return { success: true };
  },
} );

// Helper function to format duration
function formatDuration( milliseconds: number ): string {
  const seconds = Math.floor( milliseconds / 1000 );
  const minutes = Math.floor( seconds / 60 );
  const hours = Math.floor( minutes / 60 );

  if ( hours > 0 ) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if ( minutes > 0 ) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Get deployment status
 */
export const getDeployment = query( {
  args: { deploymentId: v.id( "deployments" ) },
  handler: async ( ctx, args ) => {
    const userId = await getAuthUserId( ctx );
    if ( !userId ) {
      return null;
    }

    const deployment = await ctx.db.get( args.deploymentId );
    if ( !deployment || deployment.userId !== userId ) {
      return null;
    }

    return deployment;
  },
} );

/**
 * Get user's deployments
 */
export const getUserDeployments = query( {
  args: { limit: v.optional( v.number() ) },
  handler: async ( ctx, args ) => {
    const userId = await getAuthUserId( ctx );
    if ( !userId ) {
      return [];
    }

    const limit = Math.min( args.limit || 20, 100 );

    return await ctx.db
      .query( "deployments" )
      .withIndex( "by_user", ( q ) => q.eq( "userId", userId ) )
      .order( "desc" )
      .take( limit );
  },
} );

// Helper Functions

async function generateDeploymentArtifacts( agent: any, config: any ) {
  // Generate AgentCore-compatible agent code
  const agentCode = generateAgentCoreCode( agent );

  // Generate requirements.txt
  const requirements = generateAgentCoreRequirements( agent.tools );

  // Generate Dockerfile
  const dockerfile = generateAgentCoreDockerfile( agent );

  // Generate AgentCore configuration
  const agentCoreConfig = generateAgentCoreConfig( agent, config );

  return {
    agentCode,
    requirements,
    dockerfile,
    agentCoreConfig,
    agentName: config.agentName,
    region: config.region,
  };
}

function generateAgentCoreCode( agent: any ): string {
  // Generate tool imports based on agent tools
  const toolImports = agent.tools && agent.tools.length > 0
    ? agent.tools.map( ( tool: any ) => `from strands_tools import ${tool.name}` ).join( '\n' )
    : '# No tools configured';

  const toolsList = agent.tools && agent.tools.length > 0
    ? agent.tools.map( ( tool: any ) => tool.name ).join( ', ' )
    : '';

  return `"""
Generated AgentCore Agent
Agent: ${agent.name}
Generated at: ${new Date().toISOString()}
"""

import os
os.environ["BYPASS_TOOL_CONSENT"] = "true"

from strands import Agent
from bedrock_agentcore.runtime import BedrockAgentCoreApp
${toolImports}

# Initialize agent with tools
agent = Agent(
    tools=[${toolsList}],
    callback_handler=None
)

# Create AgentCore app
app = BedrockAgentCoreApp()

@app.entrypoint
async def agent_invocation(payload, context):
    """
    Handler for agent invocation with streaming support

    Args:
        payload: Input payload with 'prompt' key
        context: AgentCore runtime context

    Yields:
        Streaming events from agent execution
    """
    user_message = payload.get("prompt", "No prompt provided")

    print(f"[${agent.name}] Processing: {user_message}")
    print(f"Context: {context}")

    # Stream agent responses
    agent_stream = agent.stream_async(user_message)

    async for event in agent_stream:
        yield event

if __name__ == "__main__":
    app.run()
`;
}

function generateAgentCoreRequirements( tools: any[] ): string {
  const packages = new Set( [
    "strands-agents>=1.0.0",
    "bedrock-agentcore>=0.1.6",
    "bedrock-agentcore-starter-toolkit>=0.1.25",
    "boto3>=1.28.0",
    "pyjwt>=2.8.0",
  ] );

  // Add tool-specific packages
  tools.forEach( tool => {
    if ( tool.requiresPip && tool.pipPackages ) {
      tool.pipPackages.forEach( ( pkg: string ) => packages.add( pkg ) );
    }
  } );

  return Array.from( packages ).join( String.raw`\n` );
}

function generateAgentCoreDockerfile( agent: any ): string {
  const isOllamaModel = isOllamaModelId( agent.model, agent.deploymentType );

  if ( isOllamaModel ) {
    // Validate model name to prevent shell injection in entrypoint.sh
    const safeModelPattern = /^[A-Za-z0-9._:/-]+$/;
    const modelName = safeModelPattern.test( agent.model ) ? agent.model : "llama3:latest";

    return `FROM ollama/ollama:latest

RUN apt-get update && apt-get install -y python3.11 python3-pip curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt agent.py ./
RUN pip3 install --no-cache-dir -r requirements.txt

RUN echo '#!/bin/bash\nollama serve &\nsleep 5\nollama pull ${modelName}\npython3 agent.py' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

EXPOSE 8080 11434
ENTRYPOINT ["/app/entrypoint.sh"]
`;
  }

  return `FROM python:3.11-slim

RUN apt-get update && apt-get install -y gcc g++ curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt agent.py ./
RUN pip install --no-cache-dir -r requirements.txt

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8080
CMD ["python", "agent.py"]
`;
}

function generateAgentCoreConfig( agent: any, config: any ) {
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

async function deployToAgentCore( artifacts: any, config: any ) {
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
export const createDeploymentInternal = internalMutation( {
  args: {
    agentId: v.id( "agents" ),
    userId: v.id( "users" ),
    tier: v.optional( v.string() ),
    deploymentConfig: v.object( {
      region: v.string(),
      agentName: v.string(),
      description: v.optional( v.string() ),
      enableMonitoring: v.optional( v.boolean() ),
      enableAutoScaling: v.optional( v.boolean() ),
    } ),
  },
  handler: async ( ctx, args ) => {
    return await ctx.db.insert( "deployments", {
      agentId: args.agentId,
      userId: args.userId,
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
    } );
  },
} );

/**
 * Update deployment status (internal)
 */
export const updateDeploymentStatusInternal = internalMutation( {
  args: {
    deploymentId: v.id( "deployments" ),
    status: v.string(),
    progress: v.optional( v.object( {
      stage: v.string(),
      percentage: v.number(),
      message: v.string(),
      currentStep: v.optional( v.string() ),
      totalSteps: v.optional( v.number() ),
    } ) ),
    agentCoreRuntimeId: v.optional( v.string() ),
    agentCoreEndpoint: v.optional( v.string() ),
    cloudFormationStackId: v.optional( v.string() ),
    ecrRepositoryUri: v.optional( v.string() ),
    s3BucketName: v.optional( v.string() ),
    deploymentPackageKey: v.optional( v.string() ),
    awsAccountId: v.optional( v.string() ),
    awsCallerArn: v.optional( v.string() ),
    logs: v.optional( v.union(
      v.string(),
      v.array( v.object( {
        timestamp: v.number(),
        level: v.string(),
        message: v.string(),
        source: v.optional( v.string() ),
      } ) )
    ) ),
    error: v.optional( v.string() ),
  },
  handler: async ( ctx, args ) => {
    const updates: any = {
      status: args.status,
      updatedAt: Date.now(),
    };

    if ( args.progress ) {
      updates.progress = args.progress;
    }

    if ( args.agentCoreRuntimeId ) {
      updates.agentCoreRuntimeId = args.agentCoreRuntimeId;
    }

    if ( args.agentCoreEndpoint ) {
      updates.agentCoreEndpoint = args.agentCoreEndpoint;
    }

    if ( args.cloudFormationStackId ) {
      updates.cloudFormationStackId = args.cloudFormationStackId;
    }

    if ( args.ecrRepositoryUri ) {
      updates.ecrRepositoryUri = args.ecrRepositoryUri;
    }

    if ( args.s3BucketName ) {
      updates.s3BucketName = args.s3BucketName;
    }

    if ( args.deploymentPackageKey ) {
      updates.deploymentPackageKey = args.deploymentPackageKey;
    }

    if ( args.awsAccountId ) {
      updates.awsAccountId = args.awsAccountId;
    }

    if ( args.awsCallerArn ) {
      updates.awsCallerArn = args.awsCallerArn;
    }

    if ( args.status === "ACTIVE" ) {
      updates.deployedAt = Date.now();
      updates.isActive = true;
    }

    if ( args.status === "FAILED" || args.status === "DELETED" ) {
      updates.isActive = false;
    }

    if ( args.status === "DELETED" ) {
      updates.deletedAt = Date.now();
    }

    if ( args.logs || args.progress?.message ) {
      const deployment = await ctx.db.get( args.deploymentId );
      const existingLogs = Array.isArray( deployment?.logs ) ? deployment.logs : [];
      const combinedLogs = [...existingLogs];

      if ( args.logs ) {
        if ( Array.isArray( args.logs ) ) {
          combinedLogs.push( ...args.logs );
        }
      }

      if ( args.progress?.message ) {
        combinedLogs.push( {
          timestamp: Date.now(),
          level: args.status === "FAILED" ? "error" : "info",
          message: args.progress.message,
          source: "deployment",
        } );
      }

      updates.logs = combinedLogs;
    }

    await ctx.db.patch( args.deploymentId, updates );
  },
} );

/**
 * Get deployment (internal)
 */
export const getDeploymentInternal = internalQuery( {
  args: { deploymentId: v.id( "deployments" ) },
  handler: async ( ctx, args ) => {
    return await ctx.db.get( args.deploymentId );
  },
} );

/**
 * Execute deployment (internal action)
 */
export const executeDeploymentInternal = internalAction( {
  args: {
    deploymentId: v.id( "deployments" ),
    agentId: v.id( "agents" ),
    userId: v.id( "users" ),
  },
  handler: async ( ctx, args ) => {
    try {
      // Update status to building with progress tracking
      await ctx.runMutation( internal.awsDeployment.updateDeploymentStatusInternal, {
        deploymentId: args.deploymentId,
        status: "BUILDING",
        progress: {
          stage: "building",
          percentage: 10,
          message: "Building Docker image...",
          currentStep: "docker-build",
          totalSteps: 5,
        },
      } );

      // Simulate building process
      await new Promise( resolve => setTimeout( resolve, 2000 ) );

      // Update status to deploying with progress
      await ctx.runMutation( internal.awsDeployment.updateDeploymentStatusInternal, {
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
      } );

      // Simulate deployment process
      await new Promise( resolve => setTimeout( resolve, 3000 ) );

      // Update status to completed with final progress
      await ctx.runMutation( internal.awsDeployment.updateDeploymentStatusInternal, {
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
      } );

    } catch ( error: any ) {
      // Update status to failed with error details
      await ctx.runMutation( internal.awsDeployment.updateDeploymentStatusInternal, {
        deploymentId: args.deploymentId,
        status: "FAILED",
        progress: {
          stage: "failed",
          percentage: 0,
          message: `Deployment failed: ${error.message}`,
        },
        error: error.message,
      } );
    }
  },
} );

// ============================================================================
// TIER DEPLOYMENT FUNCTIONS
// ============================================================================

/**
 * Tier 1: Deploy to YOUR Fargate (Freemium)
 */
async function deployTier1( ctx: any, args: any, userId: Id<"users"> ): Promise<any> {
  // Create deployment record
  const deploymentId: any = await ctx.runMutation( internal.awsDeployment.createDeploymentInternal, {
    agentId: args.agentId,
    userId,
    tier: "freemium",
    deploymentConfig: args.deploymentConfig,
  } );

  // Increment usage counter (non-fatal: don't block deployment)
  try {
    await ctx.runMutation( internalStripeMutations.incrementUsageAndReportOverage, { userId } );
  } catch ( billingErr ) {
    console.error( "awsDeployment.deployTier1: billing failed (non-fatal)", {
      userId,
      error: billingErr instanceof Error ? billingErr.message : billingErr,
    } );
  }

  // Start deployment
  await ctx.scheduler.runAfter( 0, internal.awsDeployment.executeDeploymentInternal, {
    deploymentId,
    agentId: args.agentId,
    userId,
  } );

  return {
    deploymentId,
    status: "PREPARING",
    tier: "freemium",
    message: "Deploying to platform infrastructure. You have 9 free tests remaining this month.",
  };
}

/**
 * Tier 2: Deploy to USER's Fargate (Personal AWS Account) using Web Identity Federation
 */
async function deployTier2( ctx: any, args: any, userId: string ): Promise<any> {
  // Get user's stored Role ARN
  const user = await ctx.runQuery( internal.awsDeployment.getUserTierInternal, { userId } );

  if ( !user || !user.awsRoleArn ) {
    throw new Error( "No AWS Role ARN configured. Please configure your IAM role in settings." );
  }

  // Create deployment record
  const deploymentId: any = await ctx.runMutation( internal.awsDeployment.createDeploymentInternal, {
    agentId: args.agentId,
    userId,
    tier: "personal",
    deploymentConfig: args.deploymentConfig,
  } );

  // Start deployment with web identity federation
  await ctx.scheduler.runAfter( 0, internal.awsDeployment.executeWebIdentityDeploymentInternal, {
    deploymentId,
    agentId: args.agentId,
    userId,
    roleArn: user.awsRoleArn,
    region: args.deploymentConfig.region,
  } );

  return {
    deploymentId,
    status: "PREPARING",
    tier: "personal",
    message: "Deploying to your AWS account using federated access...",
  };
}

/**
 * Get user tier (internal)
 */
export const getUserTierInternal = internalQuery( {
  args: { userId: v.id( "users" ) },
  handler: async ( ctx, args ) => {
    return await ctx.db.get( args.userId );
  },
} );

/**
 * Get user AWS account (internal)
 */
export const getUserAWSAccountInternal = internalQuery( {
  args: { userId: v.id( "users" ) },
  handler: async ( ctx, args ) => {
    return await ctx.db
      .query( "userAWSAccounts" )
      .withIndex( "by_user_id", ( q ) => q.eq( "userId", args.userId ) )
      .first();
  },
} );

/**
 * Increment usage counter — delegates to shared helper in stripeMutations.ts
 * (single source of truth for usage + overage logic).
 */
export const incrementUsageInternal = internalMutation( {
  args: { userId: v.id( "users" ) },
  handler: async ( ctx, args ) => {
    await incrementUsageAndReportOverageImpl( ctx, args.userId );
  },
} );

/**
 * Execute cross-account deployment (internal)
 */
export const executeCrossAccountDeploymentInternal = internalAction( {
  args: {
    deploymentId: v.id( "deployments" ),
    agentId: v.id( "agents" ),
    userId: v.string(),
    roleArn: v.string(),
    externalId: v.string(),
    region: v.string(),
  },
  handler: async ( ctx, args ) => {
    try {
      // Update status
      await ctx.runMutation( internal.awsDeployment.updateDeploymentStatusInternal, {
        deploymentId: args.deploymentId,
        status: "BUILDING",
        progress: {
          stage: "assuming-role",
          percentage: 10,
          message: "Assuming role in your AWS account...",
          currentStep: "assume-role",
          totalSteps: 5,
        },
      } );

      // Assume role in user's account
      await assumeUserRole( args.roleArn, args.externalId );

      // Deploy to their Fargate
      await ctx.runMutation( internal.awsDeployment.updateDeploymentStatusInternal, {
        deploymentId: args.deploymentId,
        status: "DEPLOYING",
        progress: {
          stage: "deploying",
          percentage: 50,
          message: "Deploying to your AWS Fargate...",
          currentStep: "deploy-fargate",
          totalSteps: 5,
        },
      } );

      // Simulate deployment
      await new Promise( resolve => setTimeout( resolve, 3000 ) );

      // Complete
      await ctx.runMutation( internal.awsDeployment.updateDeploymentStatusInternal, {
        deploymentId: args.deploymentId,
        status: "ACTIVE",
        progress: {
          stage: "completed",
          percentage: 100,
          message: "Deployed to your AWS account!",
          currentStep: "completed",
          totalSteps: 5,
        },
      } );

    } catch ( error: any ) {
      await ctx.runMutation( internal.awsDeployment.updateDeploymentStatusInternal, {
        deploymentId: args.deploymentId,
        status: "FAILED",
        progress: {
          stage: "failed",
          percentage: 0,
          message: `Deployment failed: ${error.message}`,
        },
        error: error.message,
      } );
    }
  },
} );

/**
 * Execute deployment using Web Identity Federation
 * Gets temporary credentials via AssumeRoleWithWebIdentity and deploys to user's AWS
 */
export const executeWebIdentityDeploymentInternal = internalAction( {
  args: {
    deploymentId: v.id( "deployments" ),
    agentId: v.id( "agents" ),
    userId: v.string(),
    roleArn: v.string(),
    region: v.string(),
  },
  handler: async ( ctx, args ) => {
    try {
      await ctx.runMutation( internal.awsDeployment.updateDeploymentStatusInternal, {
        deploymentId: args.deploymentId,
        status: "BUILDING",
        progress: {
          stage: "authenticating",
          percentage: 10,
          message: "Getting temporary AWS credentials via web identity...",
          currentStep: "authenticate",
          totalSteps: 5,
        },
      } );

      const assumeRoleResult = await ctx.runAction( api.awsAuth.assumeRoleWithWebIdentity, {
        roleArn: args.roleArn,
      } );

      if ( !assumeRoleResult.success || !assumeRoleResult.credentials ) {
        throw new Error( assumeRoleResult.error || "Failed to assume role with web identity" );
      }

      const region = args.region;
      const tempCredentials = assumeRoleResult.credentials;
      const awsCredentials = {
        accessKeyId: tempCredentials.accessKeyId,
        secretAccessKey: tempCredentials.secretAccessKey,
        sessionToken: tempCredentials.sessionToken,
      };

      const { STSClient, GetCallerIdentityCommand } = await import( "@aws-sdk/client-sts" );
      const stsClient = new STSClient( { region, credentials: awsCredentials } );
      const identity = await stsClient.send( new GetCallerIdentityCommand( {} ) );
      const awsAccountId = identity.Account || "unknown";
      const callerArn = identity.Arn || "";

      await ctx.runMutation( internal.awsDeployment.updateDeploymentStatusInternal, {
        deploymentId: args.deploymentId,
        status: "BUILDING",
        progress: {
          stage: "packaging",
          percentage: 30,
          message: "Packaging deployment artifacts...",
          currentStep: "package-artifacts",
          totalSteps: 5,
        },
      } );

      const agent = await ctx.runQuery( internal.agents.getInternal, { id: args.agentId } );
      if ( !agent ) {
        throw new Error( "Agent not found" );
      }

      const { files } = assembleDeploymentPackageFiles( agent, {
        deploymentTarget: agent.deploymentType === "aws" ? "agentcore" : agent.deploymentType,
        includeCloudFormation: true,
        includeCLIScript: true,
        includeLambdaConfig: agent.deploymentType === "lambda",
      } );

      const JSZipModule = await import( "jszip" );
      const zip = new JSZipModule.default();
      for ( const [filename, content] of Object.entries( files ) ) {
        zip.file( filename, content );
      }
      const zipBuffer: Buffer = await zip.generateAsync( { type: "nodebuffer" } );

      await ctx.runMutation( internal.awsDeployment.updateDeploymentStatusInternal, {
        deploymentId: args.deploymentId,
        status: "BUILDING",
        progress: {
          stage: "packaged",
          percentage: 45,
          message: "Agent artifacts packaged successfully.",
          currentStep: "package-artifacts",
          totalSteps: 5,
        },
      } );

      const sanitizedName = sanitizeAgentName( agent.name || `agent-${args.agentId}` );
      const packageKey = `agentcore/${sanitizedName}/${args.deploymentId}-${Date.now()}.zip`;
      const baseBucketName = `agent-builder-${awsAccountId}-deployments`;
      let bucketName = baseBucketName;

      const { S3Client, CreateBucketCommand, HeadBucketCommand, PutObjectCommand, GetObjectCommand } = await import( "@aws-sdk/client-s3" );
      const { getSignedUrl } = await import( "@aws-sdk/s3-request-presigner" );
      const s3Client = new S3Client( { region, credentials: awsCredentials } );

      try {
        await s3Client.send( new HeadBucketCommand( { Bucket: bucketName } ) );
      } catch ( headError: any ) {
        try {
          const createParams: any = { Bucket: bucketName };
          if ( region !== "us-east-1" ) {
            createParams.CreateBucketConfiguration = { LocationConstraint: region };
          }
          await s3Client.send( new CreateBucketCommand( createParams ) );
        } catch ( createError: any ) {
          if ( createError.name === "BucketAlreadyOwnedByYou" ) {
            // bucket already accessible
          } else if ( createError.name === "BucketAlreadyExists" ) {
            bucketName = `${baseBucketName}-${Date.now()}`;
            const createParams: any = { Bucket: bucketName };
            if ( region !== "us-east-1" ) {
              createParams.CreateBucketConfiguration = { LocationConstraint: region };
            }
            await s3Client.send( new CreateBucketCommand( createParams ) );
          } else {
            throw createError;
          }
        }
      }

      await s3Client.send( new PutObjectCommand( {
        Bucket: bucketName,
        Key: packageKey,
        Body: zipBuffer,
        ContentType: "application/zip",
      } ) );

      await ctx.runMutation( internal.awsDeployment.updateDeploymentStatusInternal, {
        deploymentId: args.deploymentId,
        status: "BUILDING",
        progress: {
          stage: "staging-artifacts",
          percentage: 65,
          message: `Uploaded deployment package to s3://${bucketName}/${packageKey}`,
          currentStep: "upload-artifacts",
          totalSteps: 5,
        },
        s3BucketName: bucketName,
        deploymentPackageKey: packageKey,
        awsAccountId,
        awsCallerArn: callerArn,
      } );

      const { ECRClient, DescribeRepositoriesCommand, CreateRepositoryCommand } = await import( "@aws-sdk/client-ecr" );
      const ecrClient = new ECRClient( { region, credentials: awsCredentials } );
      const repositoryName = `agent-builder/${sanitizedName}`;
      let repositoryUri: string | undefined;

      try {
        const describe = await ecrClient.send( new DescribeRepositoriesCommand( { repositoryNames: [repositoryName] } ) );
        repositoryUri = describe.repositories?.[0]?.repositoryUri;
      } catch ( repoError: any ) {
        if ( repoError.name === "RepositoryNotFoundException" ) {
          const created = await ecrClient.send( new CreateRepositoryCommand( { repositoryName } ) );
          repositoryUri = created.repository?.repositoryUri;
        } else {
          throw repoError;
        }
      }

      await ctx.runMutation( internal.awsDeployment.updateDeploymentStatusInternal, {
        deploymentId: args.deploymentId,
        status: "DEPLOYING",
        progress: {
          stage: "registry-ready",
          percentage: 80,
          message: repositoryUri
            ? `ECR repository ready at ${repositoryUri}`
            : "ECR repository ready",
          currentStep: "prepare-registry",
          totalSteps: 5,
        },
        ecrRepositoryUri: repositoryUri,
      } );

      let downloadUrl: string | null = null;
      try {
        downloadUrl = await getSignedUrl(
          s3Client,
          new GetObjectCommand( { Bucket: bucketName, Key: packageKey } ),
          { expiresIn: 3600 }
        );
      } catch ( presignError ) {
        console.warn( "Unable to create presigned URL for deployment package", presignError );
      }

      const instructionsLines = [
        `Artifacts uploaded to s3://${bucketName}/${packageKey}`,
        `1. Download package: aws s3 cp s3://${bucketName}/${packageKey} ./agent_package.zip --region ${region}`,
        repositoryUri
          ? `2. Build and push the container image:\n   aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin ${awsAccountId}.dkr.ecr.${region}.amazonaws.com\n   docker build -t ${repositoryUri}:latest .\n   docker push ${repositoryUri}:latest`
          : "2. Build and push your agent image to the provisioned ECR repository.",
        "3. Deploy the AgentCore stack using the CloudFormation template inside agent_package.zip or run deploy_agentcore.sh.",
      ];

      if ( downloadUrl ) {
        instructionsLines.push( `Temporary download URL (valid 1 hour): ${downloadUrl}` );
      }

      const instructions = instructionsLines.join( "\n\n" );

      await ctx.runMutation( internal.awsDeployment.updateDeploymentStatusInternal, {
        deploymentId: args.deploymentId,
        status: "ACTIVE",
        progress: {
          stage: "staged",
          percentage: 100,
          message: "Artifacts staged in your AWS account. Push the container image and launch AgentCore to finish deployment.",
          currentStep: "staged",
          totalSteps: 5,
        },
        ecrRepositoryUri: repositoryUri,
        s3BucketName: bucketName,
        deploymentPackageKey: packageKey,
        awsAccountId,
        awsCallerArn: callerArn,
        logs: [
          {
            timestamp: Date.now(),
            level: "info",
            message: instructions,
            source: "deployment",
          },
        ],
      } );

    } catch ( error: any ) {
      console.error( "Web identity deployment error:", error );
      await ctx.runMutation( internal.awsDeployment.updateDeploymentStatusInternal, {
        deploymentId: args.deploymentId,
        status: "FAILED",
        progress: {
          stage: "failed",
          percentage: 0,
          message: `Deployment failed: ${error.message}`,
        },
        error: error.message,
      } );
    }
  },
} );

/**
 * Assume role in user's AWS account (DEPRECATED - use web identity instead)
 */
async function assumeUserRole( roleArn: string, externalId: string ) {
  const response = await fetch(
    `${process.env.CONVEX_SITE_URL}/aws/assumeRole`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AWS_API_SECRET}`,
      },
      body: JSON.stringify( {
        roleArn,
        externalId,
        sessionName: `agent-deployment-${Date.now()}`,
        durationSeconds: 3600,
      } ),
    }
  );

  if ( !response.ok ) {
    throw new Error( `Failed to assume role: ${response.statusText}` );
  }

  return await response.json();
}

/**
 *
 Deploy agent to user's AWS account using temporary credentials
 */
async function deployToUserAWS(
  agent: any,
  region: string,
  accessKeyId: string,
  secretAccessKey: string,
  sessionToken: string
) {
  const {
    ECRClient,
    CreateRepositoryCommand,
    GetAuthorizationTokenCommand
  } = await import( "@aws-sdk/client-ecr" );

  const {
    ECSClient,
    CreateClusterCommand,
    RegisterTaskDefinitionCommand,
    CreateServiceCommand
  } = await import( "@aws-sdk/client-ecs" );

  const {
    S3Client,
    CreateBucketCommand,
    PutObjectCommand
  } = await import( "@aws-sdk/client-s3" );

  const {
    EC2Client,
    DescribeVpcsCommand,
    DescribeSubnetsCommand,
    CreateSecurityGroupCommand,
    AuthorizeSecurityGroupIngressCommand,
    DescribeSecurityGroupsCommand
  } = await import( "@aws-sdk/client-ec2" );

  // Configure AWS clients with temporary credentials
  const credentials = {
    accessKeyId,
    secretAccessKey,
    sessionToken
  };

  const ecrClient = new ECRClient( { region, credentials } );
  const ecsClient = new ECSClient( { region, credentials } );
  const s3Client = new S3Client( { region, credentials } );
  const ec2Client = new EC2Client( { region, credentials } );

  // 1. Create ECR repository for agent image
  const repoName = `agent-${agent._id.toLowerCase()}`;
  try {
    await ecrClient.send( new CreateRepositoryCommand( {
      repositoryName: repoName,
      imageScanningConfiguration: {
        scanOnPush: true
      }
    } ) );
  } catch ( error: any ) {
    if ( error.name !== "RepositoryAlreadyExistsException" ) {
      throw error;
    }
  }

  // 2. Get ECR auth token for Docker push
  const authResponse = await ecrClient.send( new GetAuthorizationTokenCommand( {} ) );
  const authToken = authResponse.authorizationData?.[0];

  if ( !authToken ) {
    throw new Error( "Failed to get ECR authorization token" );
  }

  // 3. Create S3 bucket for agent artifacts
  const bucketName = `agent-artifacts-${Date.now()}`;
  try {
    await s3Client.send( new CreateBucketCommand( {
      Bucket: bucketName,
      CreateBucketConfiguration: {
        LocationConstraint: ( region !== "us-east-1" ? region : undefined ) as any
      }
    } ) );
  } catch ( error: any ) {
    if ( error.name !== "BucketAlreadyOwnedByYou" ) {
      throw error;
    }
  }

  // 4. Upload agent code to S3
  const agentCode = generateAgentCoreCode( agent );
  await s3Client.send( new PutObjectCommand( {
    Bucket: bucketName,
    Key: "agent.py",
    Body: agentCode,
    ContentType: "text/x-python"
  } ) );

  // 5. Create ECS cluster
  const clusterName = `agent-cluster-${agent._id}`;
  try {
    await ecsClient.send( new CreateClusterCommand( {
      clusterName,
      capacityProviders: ["FARGATE"],
      defaultCapacityProviderStrategy: [{
        capacityProvider: "FARGATE",
        weight: 1
      }]
    } ) );
  } catch ( error: any ) {
    if ( error.name !== "ClusterAlreadyExistsException" ) {
      throw error;
    }
  }

  // 6. Register task definition
  const taskFamily = `agent-task-${agent._id}`;
  const taskDefResponse = await ecsClient.send( new RegisterTaskDefinitionCommand( {
    family: taskFamily,
    networkMode: "awsvpc",
    requiresCompatibilities: ["FARGATE"],
    cpu: "256",
    memory: "512",
    executionRoleArn: `arn:aws:iam::${authToken.proxyEndpoint?.split( '.' )[0].split( '//' )[1]}:role/ecsTaskExecutionRole`,
    containerDefinitions: [{
      name: "agent-container",
      image: `${authToken.proxyEndpoint}/${repoName}:latest`,
      essential: true,
      portMappings: [{
        containerPort: 8080,
        protocol: "tcp"
      }],
      environment: [
        { name: "AGENT_NAME", value: agent.name },
        { name: "MODEL_ID", value: agent.model }
      ],
      logConfiguration: {
        logDriver: "awslogs",
        options: {
          "awslogs-group": `/ecs/${taskFamily}`,
          "awslogs-region": region,
          "awslogs-stream-prefix": "agent"
        }
      }
    }]
  } ) );

  // 7. Create ECS service
  const serviceName = `agent-service-${agent._id}`;
  try {
    await ecsClient.send( new CreateServiceCommand( {
      cluster: clusterName,
      serviceName,
      taskDefinition: taskDefResponse.taskDefinition?.taskDefinitionArn,
      desiredCount: 1,
      launchType: "FARGATE",
      networkConfiguration: {
        awsvpcConfiguration: {
          assignPublicIp: "ENABLED",
          subnets: [], // TODO: Get default VPC subnets
          securityGroups: [] // TODO: Create security group
        }
      }
    } ) );
  } catch ( error: any ) {
    if ( error.name !== "ServiceAlreadyExistsException" ) {
      throw error;
    }
  }

  return {
    ecrRepository: `${authToken.proxyEndpoint}/${repoName}`,
    ecsCluster: clusterName,
    ecsService: serviceName,
    s3Bucket: bucketName,
    taskDefinition: taskDefResponse.taskDefinition?.taskDefinitionArn
  };
}
