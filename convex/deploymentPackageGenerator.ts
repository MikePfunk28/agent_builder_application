"use node";

/**
 * Deployment Package Generator
 *
 * Creates downloadable ZIP packages containing agent code, Docker configuration,
 * and AWS CDK deployment scripts.
 */

import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Generate deployment package for a successful test
 */
export const generatePackage = mutation({
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get test
    const test = await ctx.db.get(args.testId);
    if (!test) {
      throw new Error("Test not found");
    }

    if (test.userId !== identity.subject) {
      throw new Error("Not authorized");
    }

    if (test.status !== "COMPLETED") {
      throw new Error(`Cannot generate package: test status must be COMPLETED (current: ${test.status})`);
    }

    // Check if package already exists
    const existing = await ctx.db
      .query("deploymentPackages")
      .withIndex("by_test", (q) => q.eq("testId", args.testId))
      .first();

    if (existing) {
      // Return existing package
      return {
        packageId: existing._id,
        downloadUrl: existing.downloadUrl,
        expiresAt: existing.urlExpiresAt,
        fileSize: existing.fileSize,
        manifest: existing.files,
      };
    }

    // Schedule package generation (this is an async action)
    await ctx.scheduler.runAfter(0, internal.deploymentPackageGenerator.generatePackageAction, {
      testId: args.testId,
      userId: identity.subject,
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
export const generatePackageAction = action({
  args: {
    testId: v.id("testExecutions"),
    userId: v.string(),
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
      const agent = await ctx.runQuery(internal.deploymentPackageGenerator.getAgentById, {
        agentId: test.agentId,
      });

      if (!agent) {
        throw new Error("Agent not found");
      }

      // Generate package files
      const files = await generatePackageFiles(test, agent, args.customization);

      // Create ZIP and upload to S3
      const { downloadUrl, s3Key, fileSize } = await uploadPackageToS3(
        args.testId,
        files,
        args.customization
      );

      // Create deployment package record
      const packageName = `agent-deployment-${test.agentId.slice(-8)}-${Date.now()}.zip`;
      const urlExpiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

      await ctx.runMutation(internal.deploymentPackageGenerator.createPackageRecord, {
        testId: args.testId,
        agentId: test.agentId,
        userId: args.userId,
        packageName,
        fileSize,
        s3Bucket: process.env.AWS_S3_DEPLOYMENT_BUCKET!,
        s3Key,
        downloadUrl,
        urlExpiresAt,
        files: files.map(f => ({
          path: f.path,
          size: f.content.length,
          checksum: generateChecksum(f.content),
        })),
      });

      console.log(`✅ Deployment package generated: ${packageName}`);
    } catch (error: any) {
      console.error("❌ Package generation failed:", error);
      // Could store error in test record here
    }
  },
});

/**
 * Get agent by ID (internal query)
 */
export const getAgentById = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.agentId);
  },
});

/**
 * Create package record (internal mutation)
 */
export const createPackageRecord = mutation({
  args: {
    testId: v.id("testExecutions"),
    agentId: v.id("agents"),
    userId: v.id("users"),
    packageName: v.string(),
    fileSize: v.number(),
    s3Bucket: v.string(),
    s3Key: v.string(),
    downloadUrl: v.string(),
    urlExpiresAt: v.number(),
    files: v.array(v.object({
      path: v.string(),
      size: v.number(),
      checksum: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const packageId = await ctx.db.insert("deploymentPackages", {
      testId: args.testId,
      agentId: args.agentId,
      userId: args.userId,
      packageName: args.packageName,
      fileSize: args.fileSize,
      s3Bucket: args.s3Bucket,
      s3Key: args.s3Key,
      downloadUrl: args.downloadUrl,
      urlExpiresAt: args.urlExpiresAt,
      files: args.files,
      generatedAt: Date.now(),
      downloadCount: 0,
    });

    // Update test with package URL
    await ctx.db.patch(args.testId, {
      deploymentPackageUrl: args.downloadUrl,
      deploymentPackageExpiry: args.urlExpiresAt,
    });

    return packageId;
  },
});

/**
 * Get package by ID
 */
export const getPackageById = query({
  args: { packageId: v.id("deploymentPackages") },
  handler: async (ctx, args) => {
    const pkg = await ctx.db.get(args.packageId);

    if (!pkg) {
      return null;
    }

    // Check authorization
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || pkg.userId !== identity.subject) {
      return null;
    }

    // Check if expired
    const expired = pkg.urlExpiresAt < Date.now();

    return {
      ...pkg,
      expired,
    };
  },
});

/**
 * Get user's deployment packages
 */
export const getUserPackages = query({
  args: {
    limit: v.optional(v.number()),
    includeExpired: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { packages: [], hasMore: false };
    }

    const limit = Math.min(args.limit || 20, 100);

    let packages = await ctx.db
      .query("deploymentPackages")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject as any))
      .order("desc")
      .take(limit + 1);

    if (!args.includeExpired) {
      packages = packages.filter(pkg => pkg.urlExpiresAt >= Date.now());
    }

    const hasMore = packages.length > limit;

    return {
      packages: packages.slice(0, limit).map(pkg => ({
        ...pkg,
        expired: pkg.urlExpiresAt < Date.now(),
      })),
      hasMore,
    };
  },
});

/**
 * Track package download
 */
export const trackDownload = mutation({
  args: { packageId: v.id("deploymentPackages") },
  handler: async (ctx, args) => {
    const pkg = await ctx.db.get(args.packageId);

    if (!pkg) {
      throw new Error("Package not found");
    }

    await ctx.db.patch(args.packageId, {
      downloadCount: pkg.downloadCount + 1,
      lastDownloadedAt: Date.now(),
    });

    return {
      success: true,
      downloadCount: pkg.downloadCount + 1,
    };
  },
});

// Helper Functions

interface PackageFile {
  path: string;
  content: string;
}

async function generatePackageFiles(
  test: any,
  agent: any,
  customization: any
): Promise<PackageFile[]> {
  const files: PackageFile[] = [];

  // agent.py
  files.push({
    path: "agent.py",
    content: test.agentCode,
  });

  // requirements.txt
  files.push({
    path: "requirements.txt",
    content: test.requirements,
  });

  // Dockerfile
  files.push({
    path: "Dockerfile",
    content: test.dockerfile,
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
  customization: any
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

function generateChecksum(content: string): string {
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

function generatePythonCDK(agent: any, test: any, customization: any): PackageFile[] {
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
