import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  // User AWS Accounts for Tier 2 (Cross-Account Deployment)
  userAWSAccounts: defineTable({
    userId: v.id("users"),
    externalId: v.string(), // Unique security token
    roleArn: v.optional(v.string()), // User's cross-account role ARN
    region: v.optional(v.string()),
    awsAccountId: v.optional(v.string()),
    status: v.string(), // "pending", "connected", "disconnected"
    createdAt: v.number(),
    connectedAt: v.optional(v.number()),
    disconnectedAt: v.optional(v.number()),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_and_external_id", ["userId", "externalId"])
    .index("by_external_id", ["externalId"]),

  // Deployment History (Merged: Simple + AWS Deployments)
  deployments: defineTable({
    // Identity
    agentId: v.id("agents"),
    userId: v.id("users"),

    // Tier & Account Info
    tier: v.string(), // "freemium", "personal", "enterprise"
    awsAccountId: v.optional(v.string()),
    region: v.string(),
    environment: v.optional(v.string()), // dev | staging | prod

    // Deployment Configuration
    agentName: v.optional(v.string()),
    description: v.optional(v.string()),

    // AWS Resources
    taskArn: v.optional(v.string()), // ECS task ARN
    agentCoreRuntimeId: v.optional(v.string()),
    agentCoreEndpoint: v.optional(v.string()),
    cloudFormationStackId: v.optional(v.string()),
    ecrRepositoryUri: v.optional(v.string()),
    s3BucketName: v.optional(v.string()),
    deploymentPackageKey: v.optional(v.string()),
    awsCallerArn: v.optional(v.string()),

    // Status & Progress
    status: v.string(), // "running", "completed", "failed", "CREATING", "ACTIVE", etc.
    progress: v.optional(v.object({
      stage: v.string(),
      percentage: v.number(),
      message: v.string(),
      currentStep: v.optional(v.string()),
      totalSteps: v.optional(v.number()),
    })),

    // Configuration
    enableMonitoring: v.optional(v.boolean()),
    enableAutoScaling: v.optional(v.boolean()),
    enableXRay: v.optional(v.boolean()),
    logRetentionDays: v.optional(v.number()),

    // Logs & Errors
    error: v.optional(v.string()),
    logs: v.optional(v.union(
      v.string(), // Simple string logs
      v.array(v.object({ // Structured logs
        timestamp: v.number(),
        level: v.string(),
        message: v.string(),
        source: v.optional(v.string()),
      }))
    )),

    // Timestamps
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    deployedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),

    // Metadata
    version: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    lastHealthCheck: v.optional(v.number()),
    healthStatus: v.optional(v.string()),
  })
    .index("by_agent", ["agentId"])
    .index("by_user", ["userId"])
    .index("by_tier", ["tier"])
    .index("by_status", ["status"])
    .index("by_active", ["isActive"]),

  // User Profiles with Tier Information
  users: defineTable({
    // DO NOT add userId field - use _id (Convex user document ID) instead
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    image: v.optional(v.string()), // Profile picture URL
    tier: v.optional(v.string()), // "freemium", "personal", "enterprise"
    testsThisMonth: v.optional(v.number()), // For freemium limits
    upgradedAt: v.optional(v.number()),
    createdAt: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()), // For anonymous users
    deviceId: v.optional(v.string()), // Browser fingerprint for anonymous users
    mergedInto: v.optional(v.id("users")), // If anonymous account was merged
    mergedAt: v.optional(v.number()), // When account was merged

    // OAuth provider-specific fields
    locale: v.optional(v.string()), // Google: user's locale (e.g., "en-US")
    login: v.optional(v.string()), // GitHub: username
    authProvider: v.optional(v.string()), // "github" | "google" | "cognito" | "password"

    // Auth metadata
    lastSignIn: v.optional(v.number()),
    signInCount: v.optional(v.number()),

    // Usage Tracking
    lastTestAt: v.optional(v.number()), // Last test execution timestamp
    totalTokensUsed: v.optional(v.number()), // Total tokens consumed across all tests
    totalExecutionTime: v.optional(v.number()), // Total execution time in milliseconds

    // AWS Deployment Credentials
    awsAuthMethod: v.optional(v.union(v.literal("assumeRole"), v.literal("direct"))),
    awsRoleArn: v.optional(v.string()),
    awsAccessKeyId: v.optional(v.string()),
    awsSecretAccessKey: v.optional(v.string()),
    awsConfiguredAt: v.optional(v.number()),

    // AWS Federated Identity (for Cognito users)
    awsIdentityId: v.optional(v.string()), // Cognito Identity Pool ID
    awsCredentials: v.optional(v.object({
      accessKeyId: v.string(),
      secretKey: v.string(),
      sessionToken: v.string(),
      expiration: v.number(),
    })),
    awsCredentialsUpdatedAt: v.optional(v.number()),
  })
    .index("by_tier", ["tier"])
    .index("by_email", ["email"])
    .index("by_auth_provider", ["authProvider"])
    .index("by_device_id", ["deviceId"]),

  // API Keys for external access and usage tracking
  apiKeys: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    keyHash: v.string(),
    keyPrefix: v.string(),
    isActive: v.boolean(),
    testsUsed: v.number(),
    lastUsed: v.optional(v.number()),
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_hash", ["keyHash"]),

  agents: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    model: v.string(),
    modelProvider: v.optional(v.string()), // "bedrock", "ollama", "openai", etc.
    ollamaEndpoint: v.optional(v.string()), // e.g., "http://localhost:11434"
    systemPrompt: v.string(),
    tools: v.array(v.object({
      name: v.string(),
      type: v.string(),
      config: v.optional(v.object({
        description: v.optional(v.string()),
        parameters: v.optional(v.array(v.object({
          name: v.string(),
          type: v.string(),
          description: v.optional(v.string()),
          required: v.optional(v.boolean()),
        }))),
      })),
      requiresPip: v.optional(v.boolean()),
      pipPackages: v.optional(v.array(v.string())),
      extrasPip: v.optional(v.string()),
      notSupportedOn: v.optional(v.array(v.string())),
    })),
    generatedCode: v.string(),
    dockerConfig: v.optional(v.string()),
    deploymentType: v.string(), // "aws", "ollama", "docker", "agentcore"
    createdBy: v.id("users"),
    isPublic: v.optional(v.boolean()),
    tier: v.optional(v.string()), // "freemium", "personal", "enterprise"

    // MCP Configuration
    mcpServers: v.optional(v.array(v.object({
      name: v.string(),
      command: v.string(),
      args: v.array(v.string()),
      env: v.optional(v.any()),
      disabled: v.optional(v.boolean()),
    }))),

    // Dynamic Tools (Meta-tooling)
    dynamicTools: v.optional(v.array(v.object({
      name: v.string(),
      code: v.string(),
      parameters: v.any(),
    }))),

    // MCP Tool Exposure
    exposableAsMCPTool: v.optional(v.boolean()),
    mcpToolName: v.optional(v.string()),
    mcpInputSchema: v.optional(v.any()),

    // Dynamic Model Switching (Unified Modality Switching)
    enableDynamicModelSwitching: v.optional(v.boolean()),
    modelSwitchingConfig: v.optional(v.object({
      preferCost: v.optional(v.boolean()),
      preferSpeed: v.optional(v.boolean()),
      preferCapability: v.optional(v.boolean()),
      minComplexityForSonnet: v.optional(v.number()),
      minComplexityForOpus: v.optional(v.number()),
    })),

    // Architecture & Deployment Metadata
    diagramUrl: v.optional(v.string()),
    lastDeployedAt: v.optional(v.number()),
    deploymentCount: v.optional(v.number()),

    // Timestamps
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  }).index("by_user", ["createdBy"])
    .index("by_public", ["isPublic"])
    .index("by_mcp_tool_name", ["mcpToolName"])
    .index("by_user_and_tier", ["createdBy", "tier"])
    .index("by_deployment_type", ["deploymentType"])
    .index("by_model_provider", ["modelProvider"]),

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

  // Conversation Management
  conversations: defineTable({
    agentId: v.id("agents"),
    userId: v.id("users"),
    title: v.string(),
    messages: v.array(v.object({
      role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
      content: v.string(),
      timestamp: v.number(),
      metadata: v.optional(v.any()),
    })),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_agent", ["agentId"])
    .index("by_agent_user", ["agentId", "userId"]),

  // Conversation Analysis for Agent Improvement
  conversationAnalyses: defineTable({
    conversationId: v.id("conversations"),
    agentId: v.id("agents"),
    analysis: v.any(), // Detailed analysis object from conversationAnalysis.ts
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_agent", ["agentId"])
    .index("by_created", ["createdAt"]),

  // Agent Improvement History
  agentImprovementHistory: defineTable({
    agentId: v.id("agents"),
    conversationId: v.id("conversations"),
    improvementPlan: v.any(),
    changes: v.array(v.string()), // List of changes applied
    appliedAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_conversation", ["conversationId"])
    .index("by_applied", ["appliedAt"]),

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
      testEnvironment: v.optional(v.string()), // "docker" | "agentcore" | "fargate"
    }),
    timeout: v.number(),
    agentRuntimeArn: v.optional(v.string()), // For AgentCore testing
    conversationId: v.optional(v.id("conversations")), // For conversation context

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
    testType: v.optional(v.string()), // docker | agentcore

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

  // MCP Server Configuration
  mcpServers: defineTable({
    // Identity
    name: v.string(),
    userId: v.id("users"),

    // Server Configuration
    command: v.string(),
    args: v.array(v.string()),
    env: v.optional(v.object({})),
    disabled: v.boolean(),
    timeout: v.optional(v.number()), // Timeout in milliseconds

    // Connection Status
    status: v.string(), // "connected" | "disconnected" | "error" | "unknown"
    lastConnected: v.optional(v.number()),
    lastError: v.optional(v.string()),

    // Tool Discovery
    availableTools: v.optional(v.array(v.object({
      name: v.string(),
      description: v.optional(v.string()),
      inputSchema: v.optional(v.any()),
    }))),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_name", ["name"])
    .index("by_status", ["status"])
    .index("by_user_and_name", ["userId", "name"]),

  // Architecture Diagrams
  diagrams: defineTable({
    // Identity
    deploymentId: v.id("deployments"),
    userId: v.id("users"),

    // Diagram Content
    format: v.string(), // "svg" | "png" | "mermaid"
    content: v.string(), // The actual diagram content (SVG markup, PNG base64, or Mermaid code)

    // Metadata
    generatedAt: v.number(),
    resourceCount: v.optional(v.number()), // Number of AWS resources in the diagram
    diagramType: v.optional(v.string()), // "architecture" | "network" | "security"
  })
    .index("by_deployment", ["deploymentId"])
    .index("by_user", ["userId", "generatedAt"])
    .index("by_deployment_and_format", ["deploymentId", "format"]),

  // Error Logs
  errorLogs: defineTable({
    category: v.string(), // "oauth" | "mcp" | "agent" | "deployment" | "general"
    severity: v.string(), // "info" | "warning" | "error" | "critical"
    message: v.string(),
    details: v.optional(v.any()),
    userId: v.optional(v.id("users")),
    stackTrace: v.optional(v.string()),
    metadata: v.optional(v.object({
      provider: v.optional(v.string()),
      serverName: v.optional(v.string()),
      agentId: v.optional(v.string()),
      deploymentId: v.optional(v.string()),
      requestId: v.optional(v.string()),
    })),
    timestamp: v.number(),
    resolved: v.boolean(),
    resolvedAt: v.optional(v.number()),
    resolution: v.optional(v.string()),
  })
    .index("by_category", ["category", "timestamp"])
    .index("by_severity", ["severity", "timestamp"])
    .index("by_user", ["userId", "timestamp"])
    .index("by_resolved", ["resolved", "timestamp"]),

  // Audit Logs
  auditLogs: defineTable({
    eventType: v.string(), // "oauth_login" | "mcp_invocation" | "agent_invocation" | "deployment_created"
    userId: v.optional(v.id("users")),
    action: v.string(),
    resource: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    success: v.boolean(),
    details: v.optional(v.any()),
    metadata: v.optional(v.object({
      provider: v.optional(v.string()),
      serverName: v.optional(v.string()),
      toolName: v.optional(v.string()),
      agentId: v.optional(v.string()),
      ipAddress: v.optional(v.string()),
      userAgent: v.optional(v.string()),
    })),
    timestamp: v.number(),
  })
    .index("by_event_type", ["eventType", "timestamp"])
    .index("by_user", ["userId", "timestamp"])
    .index("by_resource", ["resource", "resourceId"])
    .index("by_timestamp", ["timestamp"]),

  // Agent Build Sessions (Automated Builder with Woz Questions)
  agentBuildSessions: defineTable({
    userId: v.id("users"),
    status: v.string(), // "gathering_requirements" | "ready_to_generate" | "completed"
    currentQuestion: v.number(),
    agentRequirements: v.object({
      agentType: v.union(v.string(), v.null()),
      targetUsers: v.union(v.string(), v.null()),
      problems: v.array(v.string()),
      tools: v.array(v.string()),
      tone: v.union(v.string(), v.null()),
      testingPreference: v.union(v.string(), v.null()),
      domainKnowledge: v.union(v.string(), v.null()),
      knowledgeBase: v.union(v.string(), v.null()),
      documentUrls: v.array(v.string()),
    }),
    conversationHistory: v.array(v.object({
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
      reasoning: v.optional(v.string()),
      timestamp: v.number(),
    })),
    generatedAgentConfig: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId", "updatedAt"])
    .index("by_status", ["status", "updatedAt"]),

  // Interleaved Reasoning Conversations
  interleavedConversations: defineTable({
    userId: v.optional(v.id("users")),
    conversationToken: v.optional(v.string()), // For anonymous users
    agentId: v.optional(v.id("agents")), // Optional: Associate conversation with specific agent
    title: v.string(),
    systemPrompt: v.string(),
    messages: v.optional(v.array(v.object({
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
      reasoning: v.optional(v.string()),
      toolCalls: v.optional(v.any()),
      timestamp: v.number(),
    }))), // DEPRECATED: Use interleavedMessages table instead
    messageCount: v.optional(v.number()), // OPTIONAL: Computed on-demand from interleavedMessages count
    contextSize: v.number(), // Size in bytes (approximate)
    s3ContextKey: v.optional(v.string()), // S3 key for archived context
    createdAt: v.number(),
    updatedAt: v.number(),
    isActive: v.boolean(),
  })
    .index("by_user", ["userId", "updatedAt"])
    .index("by_token", ["conversationToken"])
    .index("by_agent", ["agentId", "updatedAt"]),

  // Interleaved Messages (one document per message for efficient writes)
  interleavedMessages: defineTable({
    conversationId: v.id("interleavedConversations"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    reasoning: v.optional(v.string()), // Claude's thinking process
    toolCalls: v.optional(v.any()),
    timestamp: v.number(),
    sequenceNumber: v.number(), // For ordering messages
  })
    .index("by_conversation", ["conversationId", "sequenceNumber"])
    .index("by_timestamp", ["conversationId", "timestamp"]),

  // Agent Memory store (Convex + S3 hybrid)
  agentMemories: defineTable({
    agentId: v.optional(v.id("agents")),
    conversationId: v.optional(v.id("interleavedConversations")),
    memoryType: v.string(),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    content: v.optional(v.string()),
    s3Key: v.optional(v.string()),
    metadata: v.optional(v.any()),
    tokenCount: v.optional(v.number()),
    createdAt: v.number(),
    archived: v.optional(v.boolean()),
  })
    .index("by_agent", ["agentId", "createdAt"])
    .index("by_conversation", ["conversationId", "createdAt"])
    .index("by_type", ["memoryType", "createdAt"]),

  // Dynamic Tools (Meta-tooling)
  dynamicTools: defineTable({
    // Identity
    name: v.string(),
    displayName: v.string(),
    description: v.string(),
    userId: v.id("users"),
    agentId: v.optional(v.id("agents")), // Agent that created this tool

    // Tool Code
    code: v.string(), // Python code with @tool decorator
    validated: v.boolean(), // Whether code passed syntax validation
    validationError: v.optional(v.string()),

    // Tool Metadata
    parameters: v.any(), // JSON schema for tool parameters
    returnType: v.optional(v.string()),
    category: v.optional(v.string()),

    // Dependencies
    pipPackages: v.optional(v.array(v.string())),
    extrasPip: v.optional(v.string()),

    // Usage Tracking
    invocationCount: v.number(),
    lastInvokedAt: v.optional(v.number()),
    successCount: v.number(),
    errorCount: v.number(),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Status
    isActive: v.boolean(),
    isPublic: v.optional(v.boolean()),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_agent", ["agentId"])
    .index("by_name", ["name"])
    .index("by_active", ["isActive"])
    .index("by_public", ["isPublic"]),

  // Rate Limiting System
  rateLimitEntries: defineTable({
    userId: v.string(),
    action: v.string(),
    requests: v.array(v.number()), // Timestamps of requests in current window
    blockedUntil: v.optional(v.number()), // Timestamp when block expires
    lastRequest: v.number(), // Timestamp of last request
  })
    .index("by_user_action", ["userId", "action"])
    .index("by_user", ["userId"])
    .index("by_action", ["action"]),

};

export default defineSchema({
  workflows: defineTable({
    name: v.string(),
    userId: v.string(),
    templateId: v.string(),
    nodes: v.array(v.any()),
    edges: v.array(v.any()),
    status: v.string(),
    createdAt: v.number(),
    updatedAt: v.number()
  }).index("by_user", ["userId"]).index("by_template", ["templateId"]),

  workflowExecutions: defineTable({
    workflowId: v.id("workflows"),
    userId: v.string(),
    input: v.any(),
    output: v.any(),
    executionLog: v.array(v.any()),
    duration: v.number(),
    status: v.string(),
    createdAt: v.number()
  }).index("by_workflow", ["workflowId"]).index("by_user", ["userId"]),

  // Workflow Templates (pre-built agent workflows)
  workflowTemplates: defineTable({
    name: v.string(),
    description: v.string(),
    category: v.string(), // "Support", "Development", "Research", "Reasoning", etc.
    icon: v.string(),
    difficulty: v.string(), // "Beginner", "Intermediate", "Advanced", "Expert"
    nodes: v.array(v.any()), // Visual scripting nodes with tool configs
    connections: v.array(v.any()), // Connections between nodes
    isOfficial: v.boolean(), // Official templates from us
    usageCount: v.number(), // Track popularity
    createdAt: v.number(),
  })
    .index("by_category", ["category"])
    .index("by_popularity", ["usageCount"])
    .index("by_official", ["isOfficial"]),

  ...authTables,
  ...applicationTables,
});
