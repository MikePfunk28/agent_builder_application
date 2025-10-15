import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  agents: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    model: v.string(),
    systemPrompt: v.string(),
    tools: v.array(v.object({
      name: v.string(),
      type: v.string(),
      config: v.optional(v.any()),
      requiresPip: v.optional(v.boolean()),
      pipPackages: v.optional(v.array(v.string())),
    })),
    generatedCode: v.string(),
    dockerConfig: v.optional(v.string()),
    deploymentType: v.string(), // "aws", "ollama", "docker"
    createdBy: v.id("users"),
    isPublic: v.optional(v.boolean()),
  }).index("by_user", ["createdBy"])
    .index("by_public", ["isPublic"]),

  templates: defineTable({
    name: v.string(),
    description: v.string(),
    category: v.string(),
    model: v.string(),
    systemPrompt: v.string(),
    tools: v.array(v.object({
      name: v.string(),
      type: v.string(),
      config: v.optional(v.any()),
      requiresPip: v.optional(v.boolean()),
      pipPackages: v.optional(v.array(v.string())),
    })),
    isOfficial: v.optional(v.boolean()),
  }).index("by_category", ["category"]),

  // Containerized Agent Testing System
  testExecutions: defineTable({
    // Identity
    agentId: v.id("agents"),
    userId: v.id("users"),

    // Test Configuration
    testQuery: v.string(),
    agentCode: v.string(),
    requirements: v.string(),
    dockerfile: v.string(),
    modelProvider: v.string(), // "ollama" | "bedrock"
    modelConfig: v.object({
      baseUrl: v.optional(v.string()),
      modelId: v.optional(v.string()),
      region: v.optional(v.string()),
    }),
    timeout: v.number(),

    // Execution State
    status: v.string(), // CREATED | QUEUED | BUILDING | RUNNING | COMPLETED | FAILED | ABANDONED | ARCHIVED
    phase: v.string(), // queued | building | running | completed

    // Infrastructure
    ecsTaskArn: v.optional(v.string()),
    ecsTaskId: v.optional(v.string()),
    cloudwatchLogGroup: v.optional(v.string()),
    cloudwatchLogStream: v.optional(v.string()),

    // Execution Logs
    logs: v.array(v.string()),
    lastLogFetchedAt: v.optional(v.number()),

    // Results
    success: v.optional(v.boolean()),
    response: v.optional(v.string()),
    error: v.optional(v.string()),
    errorStage: v.optional(v.string()),

    // Metrics
    submittedAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    executionTime: v.optional(v.number()),
    buildTime: v.optional(v.number()),
    queueWaitTime: v.optional(v.number()),
    memoryUsed: v.optional(v.number()),
    cpuUsed: v.optional(v.number()),

    // Deployment Package
    deploymentPackageUrl: v.optional(v.string()),
    deploymentPackageExpiry: v.optional(v.number()),
  })
    .index("by_user", ["userId", "submittedAt"])
    .index("by_agent", ["agentId", "submittedAt"])
    .index("by_status", ["status", "submittedAt"]),

  testQueue: defineTable({
    testId: v.id("testExecutions"),
    priority: v.number(), // 1 = high, 2 = normal, 3 = low
    status: v.string(), // pending | claimed | abandoned

    // Timestamps
    createdAt: v.number(),
    claimedAt: v.optional(v.number()),
    claimedBy: v.optional(v.string()),

    // Retry Tracking
    attempts: v.number(),
    lastError: v.optional(v.string()),
  })
    .index("by_status_priority", ["status", "priority", "createdAt"])
    .index("by_test", ["testId"]),

  deploymentPackages: defineTable({
    testId: v.id("testExecutions"),
    agentId: v.id("agents"),
    userId: v.id("users"),

    // Package Metadata
    packageName: v.string(),
    fileSize: v.number(),

    // S3 Storage
    s3Bucket: v.string(),
    s3Key: v.string(),
    downloadUrl: v.string(),
    urlExpiresAt: v.number(),

    // Contents Manifest
    files: v.array(v.object({
      path: v.string(),
      size: v.number(),
      checksum: v.string(),
    })),

    // Download Tracking
    generatedAt: v.number(),
    downloadCount: v.number(),
    lastDownloadedAt: v.optional(v.number()),
  })
    .index("by_test", ["testId"])
    .index("by_user", ["userId", "generatedAt"])
    .index("by_expiry", ["urlExpiresAt"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
