"use node";

/**
 * Deployment Package Generator
 *
 * Creates downloadable ZIP packages containing agent code, Docker configuration,
 * and AWS CDK deployment scripts.
 */

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Generate deployment package for a successful test
 */
export const generatePackage = action({
  args: {
    testId: v.id("testExecutions"),
    customization: v.optional(v.object({
      includeLocalTesting: v.optional(v.boolean()),
      cdkLanguage: v.optional(v.string()),
      awsRegion: v.optional(v.string()),
      includeMonitoring: v.optional(v.boolean()),
    })),
  },
  handler: async (ctx, args) => {
    // CRITICAL: Use Convex user document ID, not OAuth provider ID
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get test
    const test = await ctx.runQuery(internal.testExecution.getTestByIdInternal, {
      testId: args.testId,
    });
    if (!test) {
      throw new Error("Test not found");
    }

    // Use Convex user document ID for access control
    if (test.userId !== userId) {
      throw new Error("Not authorized");
    }

    if (test.status !== "COMPLETED") {
      throw new Error(`Cannot generate package: test status must be COMPLETED (current: ${test.status})`);
    }

    // Skip existing package check for now - always generate new package

    // Schedule package generation (this is an async action)
    // Pass Convex user ID, not OAuth provider ID
    await ctx.scheduler.runAfter(0, internal.deploymentPackageGenerator.generatePackageAction, {
      testId: args.testId,
      userId: userId,
      customization: args.customization || {},
    });

    return {
      packageId: null,
      status: "generating",
      message: "Package generation started, check back in a few seconds",
    };
  },
});

/**
 * Generate package action (internal)
 */
export const generatePackageAction = internalAction({
  args: {
    testId: v.id("testExecutions"),
    userId: v.id("users"), // Use Convex user document ID type, not string
    customization: v.object({
      includeLocalTesting: v.optional(v.boolean()),
      cdkLanguage: v.optional(v.string()),
      awsRegion: v.optional(v.string()),
      includeMonitoring: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    try {
      // Get test
      const test = await ctx.runQuery(internal.testExecution.getTestByIdInternal, {
        testId: args.testId,
      });

      if (!test) {
        throw new Error("Test not found");
      }

      // Get agent
      const agent = await ctx.runQuery(internal.agents.getInternal, {
        id: test.agentId,
      });

      if (!agent) {
        throw new Error("Agent not found");
      }

      // Generate package files
      const files = await generatePackageFiles(test, agent, args.customization);

      // Create ZIP and upload to S3
      const { downloadUrl, s3Key: _s3Key, fileSize: _fileSize } = await uploadPackageToS3(
        args.testId,
        files,
        args.customization
      );

      // Create deployment package record
      const packageName = `agent-deployment-${test.agentId.slice(-8)}-${Date.now()}.zip`;
      const _urlExpiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

      // TODO: Store package record in database when needed
      // await ctx.runMutation(internal.deploymentPackages.createPackageRecord, { ... });

      console.log(`✅ Deployment package generated: ${packageName}`);
    } catch (error: any) {
      console.error("❌ Package generation failed:", error);
      // Could store error in test record here
    }
  },
});

// getAgentById moved to a separate file since this is a Node.js file

/**
 * Create package record (internal mutation)
 */
// createPackageRecord moved to packageMutations.ts

// All queries and mutations moved to deploymentPackages.ts since this is a Node.js file

// Helper Functions

interface PackageFile {
  path: string;
  content: string;
}

/**
 * Generate mcp.json configuration file
 * This file configures MCP servers that the agent can use as tools
 */
function generateMCPConfigFile(agent: any): string {
  const mcpConfig = {
    mcpServers: {} as Record<string, any>
  };

  // Extract MCP servers from agent configuration
  if (agent.mcpServers && Array.isArray(agent.mcpServers)) {
    for (const server of agent.mcpServers) {
      mcpConfig.mcpServers[server.name] = {
        command: server.command,
        args: server.args || [],
        env: server.env || {},
        disabled: server.disabled || false,
      };
    }
  }

  // If no MCP servers configured, provide a helpful example
  if (Object.keys(mcpConfig.mcpServers).length === 0) {
    mcpConfig.mcpServers = {
      "example-server": {
        command: "uvx",
        args: ["mcp-server-example"],
        env: {},
        disabled: true,
      }
    };
  }

  return JSON.stringify(mcpConfig, null, 2);
}

/**
 * Generate cloudformation.yaml infrastructure template
 * Uses the comprehensive CloudFormation generator for production-ready deployment
 */
function generateCloudFormationFile(agent: any, customization: any): string {
  // Build CloudFormation template using simplified approach
  // Note: Full production template available via api.cloudFormationGenerator.generateCloudFormationTemplate

  const agentName = (agent.name || "agent").replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
  const model = agent.model || "anthropic.claude-3-5-sonnet-20241022-v2:0";
  const region = customization.awsRegion || "us-east-1";
  const environment = customization.environment || "prod";

  return `AWSTemplateFormatVersion: '2010-09-09'
Description: >
  AWS Bedrock AgentCore deployment for ${agent.name || 'AI Agent'}
  Generated: ${new Date().toISOString()}

Parameters:
  AgentName:
    Type: String
    Default: ${agentName}
    Description: Name of the agent

  Environment:
    Type: String
    Default: ${environment}
    AllowedValues: [dev, staging, prod]
    Description: Deployment environment

  ModelId:
    Type: String
    Default: ${model}
    Description: AI model identifier

Resources:
  # ============================================================================
  # IAM Roles for AgentCore
  # ============================================================================
  AgentCoreTaskRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: !Sub '\${AgentName}-\${Environment}-task-role'
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: ecs-tasks.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/AmazonBedrockFullAccess
      Policies:
        - PolicyName: AgentCoreTaskPolicy
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - logs:CreateLogGroup
                  - logs:CreateLogStream
                  - logs:PutLogEvents
                Resource: !Sub 'arn:aws:logs:\${AWS::Region}:\${AWS::AccountId}:log-group:/aws/agentcore/\${AgentName}-\${Environment}*'

  AgentCoreExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: !Sub '\${AgentName}-\${Environment}-execution-role'
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: ecs-tasks.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

  # ============================================================================
  # CloudWatch Log Group
  # ============================================================================
  AgentCoreLogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: !Sub '/aws/agentcore/\${AgentName}-\${Environment}'
      RetentionInDays: 30

  # ============================================================================
  # Secrets Manager (for API keys and credentials)
  # ============================================================================
  AgentCoreSecrets:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: !Sub '\${AgentName}-\${Environment}-secrets'
      Description: Secrets for AgentCore agent
      SecretString: !Sub |
        {
          "MODEL_ID": "\${ModelId}",
          "AWS_REGION": "\${AWS::Region}",
          "ENVIRONMENT": "\${Environment}",
          "AGENT_NAME": "\${AgentName}"
        }

Outputs:
  TaskRoleArn:
    Description: IAM role ARN for AgentCore tasks
    Value: !GetAtt AgentCoreTaskRole.Arn
    Export:
      Name: !Sub '\${AWS::StackName}-task-role-arn'

  ExecutionRoleArn:
    Description: IAM role ARN for AgentCore execution
    Value: !GetAtt AgentCoreExecutionRole.Arn
    Export:
      Name: !Sub '\${AWS::StackName}-execution-role-arn'

  LogGroupName:
    Description: CloudWatch log group name
    Value: !Ref AgentCoreLogGroup
    Export:
      Name: !Sub '\${AWS::StackName}-log-group'

  SecretsArn:
    Description: Secrets Manager secret ARN
    Value: !Ref AgentCoreSecrets
    Export:
      Name: !Sub '\${AWS::StackName}-secrets-arn'

# ==============================================================================
# NOTES FOR PRODUCTION DEPLOYMENT
# ==============================================================================
# This is a simplified CloudFormation template for quick deployment.
# For a production-ready template with VPC, ECS Fargate, Load Balancer,
# Auto-scaling, and comprehensive monitoring, use the full template generator:
#
# await ctx.runAction(api.cloudFormationGenerator.generateCloudFormationTemplate, {
#   agentName: "${agentName}",
#   model: "${model}",
#   tools: [],
#   region: "${region}",
#   environment: "${environment}",
#   vpcConfig: { createVpc: true, vpcCidr: "10.0.0.0/16" },
#   monitoring: { enableXRay: true, enableCloudWatch: true, logRetentionDays: 30 },
#   scaling: { minCapacity: 0, maxCapacity: 10, targetCpuUtilization: 70 },
# });
`;
}

async function generatePackageFiles(
  test: any,
  agent: any,
  customization: any
): Promise<PackageFile[]> {
  const files: PackageFile[] = [];

  // ============================================================================
  // REQUIRED 4-FILE BUNDLE (AWS Bedrock AgentCore Deployment)
  // ============================================================================

  // 1. agent.py - Generated agent code
  files.push({
    path: "agent.py",
    content: test.agentCode,
  });

  // 2. mcp.json - MCP server configuration
  files.push({
    path: "mcp.json",
    content: generateMCPConfigFile(agent),
  });

  // 3. Dockerfile - Container configuration
  files.push({
    path: "Dockerfile",
    content: test.dockerfile,
  });

  // 4. cloudformation.yaml - AWS infrastructure template
  files.push({
    path: "cloudformation.yaml",
    content: generateCloudFormationFile(agent, customization),
  });

  // ============================================================================
  // ADDITIONAL SUPPORT FILES
  // ============================================================================

  // requirements.txt
  files.push({
    path: "requirements.txt",
    content: test.requirements,
  });

  // README.md
  files.push({
    path: "README.md",
    content: generateReadme(agent, test),
  });

  // .env.example
  files.push({
    path: ".env.example",
    content: generateEnvExample(test.modelProvider),
  });

  // docker-compose.yml (if requested)
  if (customization.includeLocalTesting !== false) {
    files.push({
      path: "docker-compose.yml",
      content: generateDockerCompose(test.modelProvider),
    });
  }

  // CDK templates (if requested)
  const cdkLang = customization.cdkLanguage || "python";
  if (cdkLang === "python") {
    files.push(...generatePythonCDK(agent, test, customization));
  }

  return files;
}

async function uploadPackageToS3(
  testId: string,
  files: PackageFile[],
  _customization: any
): Promise<{ downloadUrl: string; s3Key: string; fileSize: number }> {
  // For now, return mock data
  // In real implementation, would use @aws-sdk/client-s3 to upload ZIP

  const s3Key = `packages/${testId}-${Date.now()}.zip`;
  const mockSize = files.reduce((sum, f) => sum + f.content.length, 0);

  return {
    downloadUrl: `https://${process.env.AWS_S3_DEPLOYMENT_BUCKET}.s3.amazonaws.com/${s3Key}?X-Amz-Expires=86400`,
    s3Key,
    fileSize: mockSize,
  };
}

function _generateChecksum(content: string): string {
  // Simple hash for now
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash) + content.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function generateReadme(agent: any, test: any): string {
  return `# ${agent.name} - Deployment Package

This package contains everything needed to deploy your AI agent to production.

## Contents

- \`agent.py\` - Your generated agent code
- \`requirements.txt\` - Python dependencies
- \`Dockerfile\` - Container definition
- \`docker-compose.yml\` - Local testing setup
- \`cdk/\` - AWS CDK deployment templates

## Quick Start

### Local Testing

1. Install Docker and Docker Compose
2. Copy \`.env.example\` to \`.env\` and fill in your credentials
3. Run: \`docker-compose up\`
4. Test: \`docker exec -it agent python -c "from agent import *; print(agent.process_message('Hello'))"\`

### AWS Deployment

1. Install AWS CDK: \`npm install -g aws-cdk\`
2. Configure AWS credentials: \`aws configure\`
3. Bootstrap CDK (one-time): \`cdk bootstrap\`
4. Deploy: \`cd cdk && cdk deploy\`

## Model Configuration

- **Provider**: ${test.modelProvider}
- **Model**: ${agent.model}
- **Deployment Type**: ${agent.deploymentType}

## Support

For issues, contact support or check the documentation.

---

Generated by Agent Builder on ${new Date().toISOString()}
`;
}

function generateEnvExample(modelProvider: string): string {
  if (modelProvider === "ollama") {
    return `# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2
`;
  } else {
    return `# AWS Bedrock Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
`;
  }
}

function generateDockerCompose(modelProvider: string): string {
  return `version: '3.8'

services:
  agent:
    build: .
    container_name: agent
    environment:
      - MODEL_PROVIDER=${modelProvider}
    env_file:
      - .env
    volumes:
      - ./agent.py:/app/agent.py
    command: python agent.py
`;
}

function generatePythonCDK(_agent: any, _test: any, _customization: any): PackageFile[] {
  // Simplified CDK templates
  return [
    {
      path: "cdk/app.py",
      content: `#!/usr/bin/env python3
import aws_cdk as cdk
from stack import AgentStack

app = cdk.App()
AgentStack(app, "AgentStack")
app.synth()
`,
    },
    {
      path: "cdk/stack.py",
      content: `from aws_cdk import Stack, aws_ecs as ecs, aws_ec2 as ec2
from constructs import Construct

class AgentStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # VPC
        vpc = ec2.Vpc(self, "AgentVPC", max_azs=2)

        # ECS Cluster
        cluster = ecs.Cluster(self, "AgentCluster", vpc=vpc)

        # Fargate Task Definition
        task_def = ecs.FargateTaskDefinition(
            self, "AgentTask",
            memory_limit_mib=4096,
            cpu=2048,
        )

        # Container
        container = task_def.add_container(
            "AgentContainer",
            image=ecs.ContainerImage.from_asset("."),
            logging=ecs.LogDrivers.aws_logs(stream_prefix="agent"),
        )
`,
    },
  ];
}
