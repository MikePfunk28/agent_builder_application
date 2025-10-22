/**
 * Test Execution API
 *
 * Manages the complete lifecycle of agent tests from submission to completion.
 * Provides real-time log streaming and test management.
 */

import { mutation, query, internalMutation, internalQuery, action } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
// Removed unused import: Id

// Validation constants
const MAX_QUERY_LENGTH = 2000;
const MAX_AGENT_CODE_SIZE = 100 * 1024; // 100KB
const MAX_REQUIREMENTS_SIZE = 10 * 1024; // 10KB
const MAX_DOCKERFILE_SIZE = 5 * 1024; // 5KB
const MIN_TIMEOUT = 10000; // 10 seconds
const MAX_TIMEOUT = 600000; // 10 minutes
const MAX_CONCURRENT_TESTS = parseInt(process.env.MAX_CONCURRENT_TESTS || "10");

/**
 * Submit a new agent test
 */
export const submitTest = mutation({
  args: {
    agentId: v.id("agents"),
    testQuery: v.string(),
    timeout: v.optional(v.number()),
    priority: v.optional(v.number()),
    conversationId: v.optional(v.id("conversations")),
    testEnvironment: v.optional(v.union(
      v.literal("lambda"),
      v.literal("agentcore"),
      v.literal("fargate")
    )),
  },
  handler: async (ctx, args) => {
    // Authentication - use getAuthUserId for Convex user document ID
    // Allow anonymous users to test agents
    const userId = await getAuthUserId(ctx);
    const effectiveUserId = userId || `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get agent
    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      throw new Error("Agent not found");
    }

    // Verify ownership or public access
    const isOwner = agent.createdBy === userId;
    const isPublic = Boolean(agent.isPublic);

    // Allow testing for authenticated users (development mode)
    console.log("Authorization check:", {
      userId,
      agentCreatedBy: agent.createdBy,
      isOwner,
      isPublic,
      agentId: args.agentId,
      allowing: "all authenticated users"
    });
    
    // Authorization is relaxed for development
    // In production, uncomment this to enforce strict ownership:
    // if (!isOwner && !isPublic) {
    //   throw new Error("Not authorized to test this agent");
    // }

    // Validate test query
    if (!args.testQuery || args.testQuery.length < 1 || args.testQuery.length > MAX_QUERY_LENGTH) {
      throw new Error(`Test query must be 1-${MAX_QUERY_LENGTH} characters`);
    }

    // Validate timeout
    const timeout = args.timeout || 180000; // 3 minutes default
    if (timeout < MIN_TIMEOUT || timeout > MAX_TIMEOUT) {
      throw new Error(`Timeout must be between ${MIN_TIMEOUT} and ${MAX_TIMEOUT} milliseconds`);
    }

    // Validate priority
    const priority = args.priority || 2; // Normal priority
    if (priority < 1 || priority > 3) {
      throw new Error("Priority must be 1 (high), 2 (normal), or 3 (low)");
    }

    // Validate code sizes
    if (agent.generatedCode.length > MAX_AGENT_CODE_SIZE) {
      throw new Error(`Agent code exceeds maximum size of ${MAX_AGENT_CODE_SIZE} bytes`);
    }

    // Extract requirements from agent tools
    const requirements = generateRequirements(agent.tools, agent.deploymentType);
    if (requirements.length > MAX_REQUIREMENTS_SIZE) {
      throw new Error(`Requirements exceed maximum size of ${MAX_REQUIREMENTS_SIZE} bytes`);
    }

    // Generate Dockerfile
    const dockerfile = generateDockerfile(agent.model, agent.deploymentType);
    if (dockerfile.length > MAX_DOCKERFILE_SIZE) {
      throw new Error(`Dockerfile exceeds maximum size of ${MAX_DOCKERFILE_SIZE} bytes`);
    }

    // Determine model provider and config
    const { modelProvider, modelConfig } = extractModelConfig(agent.model, agent.deploymentType);

    // Get conversation history if conversationId provided
    if (args.conversationId) {
      const conversation = await ctx.db.get(args.conversationId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }
    }

    // Create test execution record
    const testId = await ctx.db.insert("testExecutions", {
      agentId: args.agentId,
      userId: effectiveUserId as any,
      testQuery: args.testQuery,
      agentCode: agent.generatedCode,
      requirements,
      dockerfile,
      modelProvider,
      modelConfig,
      timeout,
      status: "CREATED",
      phase: "queued",
      logs: [],
      submittedAt: Date.now(),
      conversationId: args.conversationId,
    });

    // Add to queue
    await ctx.db.insert("testQueue", {
      testId,
      priority,
      status: "pending",
      createdAt: Date.now(),
      attempts: 0,
    });

    // Update test status to QUEUED
    await ctx.db.patch(testId, { status: "QUEUED" });

    // Trigger queue processor immediately (on-demand processing to save costs)
    await ctx.scheduler.runAfter(0, internal.queueProcessor.processQueue);

    // Get queue position
    const queuePosition = await getQueuePosition(ctx, testId);

    return {
      testId,
      status: "QUEUED",
      queuePosition,
      estimatedWaitTime: queuePosition * 30, // Rough estimate: 30s per queued test
    };
  },
});

/**
 * Get test execution by ID
 */
export const getTestById = query({
  args: { testId: v.id("testExecutions") },
  handler: async (ctx, args) => {
    const test = await ctx.db.get(args.testId);
    if (!test) {
      return null;
    }

    // Allow anyone to view test results (anonymous or authenticated)
    // In production, you might want to restrict this to test owner only
    return test;
  },
});

/**
 * Internal query for getTestById (skips auth)
 */
export const getTestByIdInternal = internalQuery({
  args: { testId: v.id("testExecutions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.testId);
  },
});

/**
 * Get user's test history
 */
export const getUserTests = query({
  args: {
    limit: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    // Anonymous users can't view saved tests
    if (!userId) {
      return { tests: [], hasMore: false };
    }

    const limit = Math.min(args.limit || 20, 100);

    let query = ctx.db
      .query("testExecutions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc");

    if (args.status) {
      query = query.filter((q) => q.eq(q.field("status"), args.status));
    }

    const tests = await query.take(limit + 1);
    const hasMore = tests.length > limit;

    return {
      tests: tests.slice(0, limit),
      hasMore,
    };
  },
});

/**
 * Cancel a running test
 */
export const cancelTest = mutation({
  args: { testId: v.id("testExecutions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    
    const test = await ctx.db.get(args.testId);
    if (!test) {
      throw new Error("Test not found");
    }

    // Allow anonymous users to cancel their own tests
    // For authenticated users, verify ownership
    if (userId && test.userId !== userId) {
      throw new Error("Not authorized");
    }

    if (test.status === "COMPLETED" || test.status === "FAILED") {
      throw new Error("Test already finished");
    }

    // If queued, just remove from queue
    if (test.status === "QUEUED") {
      const queueEntry = await ctx.db
        .query("testQueue")
        .withIndex("by_test", (q) => q.eq("testId", args.testId))
        .first();

      if (queueEntry) {
        await ctx.db.delete(queueEntry._id);
      }

      await ctx.db.patch(args.testId, {
        status: "FAILED",
        success: false,
        error: "Cancelled by user while queued",
        completedAt: Date.now(),
      });

      return { success: true, message: "Test removed from queue" };
    }

    // If building or running, stop ECS task
    if (test.status === "BUILDING" || test.status === "RUNNING") {
      if (test.ecsTaskArn) {
        await ctx.scheduler.runAfter(0, internal.containerOrchestrator.stopTestContainer, {
          testId: args.testId,
          taskArn: test.ecsTaskArn,
        });
      }

      // Mark as cancelled immediately
      await ctx.db.patch(args.testId, {
        status: "FAILED",
        success: false,
        error: "Cancelled by user",
        completedAt: Date.now(),
      });

      return { success: true, message: "Test cancelled" };
    }

    // Fallback: mark as cancelled anyway
    await ctx.db.patch(args.testId, {
      status: "FAILED",
      success: false,
      error: "Cancelled by user",
      completedAt: Date.now(),
    });

    return { success: true, message: "Test cancelled" };
  },
});

/**
 * Retry a failed test
 */
export const retryTest = mutation({
  args: {
    testId: v.id("testExecutions"),
    modifyQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    
    const originalTest = await ctx.db.get(args.testId);
    if (!originalTest) {
      throw new Error("Test not found");
    }

    // Allow anonymous users to retry their own tests
    // For authenticated users, verify ownership
    if (userId && originalTest.userId !== userId) {
      throw new Error("Not authorized");
    }

    // Use original userId (which might be anonymous temp ID)
    const effectiveUserId = userId || originalTest.userId;

    // Create new test with same configuration
    const newTestId = await ctx.db.insert("testExecutions", {
      agentId: originalTest.agentId,
      userId: effectiveUserId as any,
      testQuery: args.modifyQuery || originalTest.testQuery,
      agentCode: originalTest.agentCode,
      requirements: originalTest.requirements,
      dockerfile: originalTest.dockerfile,
      modelProvider: originalTest.modelProvider,
      modelConfig: originalTest.modelConfig,
      timeout: originalTest.timeout,
      status: "CREATED",
      phase: "queued",
      logs: [],
      submittedAt: Date.now(),
    });

    // Add to queue
    await ctx.db.insert("testQueue", {
      testId: newTestId,
      priority: 2, // Normal priority
      status: "pending",
      createdAt: Date.now(),
      attempts: 0,
    });

    await ctx.db.patch(newTestId, { status: "QUEUED" });

    // Trigger queue processor immediately (on-demand processing)
    await ctx.scheduler.runAfter(0, internal.queueProcessor.processQueue);

    return {
      newTestId,
      originalTestId: args.testId,
    };
  },
});

/**
 * Get queue status
 */
export const getQueueStatus = query({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("testQueue")
      .withIndex("by_status_priority", (q) => q.eq("status", "pending"))
      .collect();

    const running = await ctx.db
      .query("testExecutions")
      .withIndex("by_status", (q) => q.eq("status", "RUNNING"))
      .collect();

    // Calculate average wait time from last 10 completed tests
    const recent = await ctx.db
      .query("testExecutions")
      .withIndex("by_status", (q) => q.eq("status", "COMPLETED"))
      .order("desc")
      .take(10);

    const avgWaitTime = recent.length > 0
      ? recent.reduce((sum, t) => sum + (t.queueWaitTime || 0), 0) / recent.length / 1000
      : 0;

    const oldestPending = pending.length > 0
      ? Math.floor((Date.now() - Math.min(...pending.map(p => p.createdAt))) / 1000)
      : 0;

    return {
      pendingCount: pending.length,
      runningCount: running.length,
      capacity: MAX_CONCURRENT_TESTS,
      avgWaitTime: Math.round(avgWaitTime),
      oldestPendingAge: oldestPending,
    };
  },
});

/**
 * Update test status (internal)
 */
export const updateStatus = internalMutation({
  args: {
    testId: v.id("testExecutions"),
    status: v.string(),
    success: v.optional(v.boolean()),
    error: v.optional(v.string()),
    errorStage: v.optional(v.string()),
    response: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const test = await ctx.db.get(args.testId);
    if (!test) return;

    const updates: any = { status: args.status };

    if (args.status === "BUILDING") {
      updates.startedAt = Date.now();
      updates.queueWaitTime = Date.now() - test.submittedAt;
      updates.phase = "building";
    } else if (args.status === "RUNNING") {
      updates.phase = "running";
    } else if (args.status === "COMPLETED" || args.status === "FAILED") {
      updates.completedAt = Date.now();
      updates.success = args.success;
      updates.phase = "completed";
      if (test.startedAt) {
        updates.executionTime = Date.now() - test.startedAt;
      }
      if (args.error) {
        updates.error = args.error;
        updates.errorStage = args.errorStage;
      }
      if (args.response) {
        updates.response = args.response;
      }
      
      // Add assistant response to conversation if exists
      if (test.conversationId && args.response && args.success) {
        await ctx.runMutation(internal.conversations.addMessageInternal, {
          conversationId: test.conversationId,
          role: "assistant",
          content: args.response,
        });
      }
    }

    await ctx.db.patch(args.testId, updates);
  },
});

/**
 * Append logs (internal)
 */
export const appendLogs = internalMutation({
  args: {
    testId: v.id("testExecutions"),
    logs: v.array(v.string()),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const test = await ctx.db.get(args.testId);
    if (!test) return;

    await ctx.db.patch(args.testId, {
      logs: [...test.logs, ...args.logs],
      lastLogFetchedAt: args.timestamp,
    });
  },
});

// Helper Functions

function generateRequirements(tools: any[], deploymentType?: string): string {
  const packages = new Set<string>([
    "strands-agents>=1.0.0",
    "strands-agents-tools>=0.2.11",
  ]);

  // Add AgentCore packages for AWS deployment
  if (deploymentType === "aws" || deploymentType === "bedrock") {
    packages.add("bedrock-agentcore>=0.1.6");
    packages.add("bedrock-agentcore-starter-toolkit>=0.1.25");
    packages.add("boto3>=1.28.0");
    packages.add("pyjwt>=2.8.0");
  }

  // Add Ollama for local testing
  if (deploymentType === "ollama") {
    packages.add("ollama>=0.1.0");
  }

  // Add tool-specific packages
  tools.forEach(tool => {
    if (tool.requiresPip && tool.pipPackages) {
      tool.pipPackages.forEach((pkg: string) => packages.add(pkg));
    }
  });

  // Add common packages
  packages.add("fastapi>=0.100.0");
  packages.add("uvicorn>=0.23.0");
  packages.add("python-dotenv>=1.0.0");
  packages.add("pydantic>=2.0.0");
  packages.add("requests>=2.31.0");

  return Array.from(packages).join("\n");
}

function generateDockerfile(model: string, deploymentType: string): string {
  if (deploymentType === "aws" || deploymentType === "bedrock") {
    // Production AgentCore-compatible Dockerfile
    return `# Production AgentCore Dockerfile - Multi-stage build
FROM --platform=linux/arm64 python:3.11-slim-bookworm AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \\
    build-essential \\
    gcc \\
    g++ \\
    curl \\
    git \\
    pkg-config \\
    libffi-dev \\
    libssl-dev \\
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy and install requirements with caching
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Production stage
FROM --platform=linux/arm64 python:3.11-slim-bookworm AS production

# Install runtime dependencies only
RUN apt-get update && apt-get install -y \\
    curl \\
    ca-certificates \\
    && rm -rf /var/lib/apt/lists/* \\
    && groupadd -r agentcore \\
    && useradd -r -g agentcore -u 1000 agentcore

# Copy Python packages from builder
COPY --from=builder /root/.local /home/agentcore/.local

# Create app directory
WORKDIR /app

# Copy agent code
COPY --chown=agentcore:agentcore agent.py .
COPY --chown=agentcore:agentcore agentcore_server.py .

# Set environment variables
ENV PATH="/home/agentcore/.local/bin:$PATH" \\
    PYTHONPATH="/app" \\
    PYTHONUNBUFFERED=1 \\
    PYTHONDONTWRITEBYTECODE=1 \\
    PORT=8080

# Security: Run as non-root user
USER agentcore

# Expose port for AgentCore Runtime
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \\
    CMD curl -f http://localhost:8080/ping || exit 1

# Run AgentCore agent with proper signal handling
CMD ["python", "-m", "uvicorn", "agentcore_server:app", \\
     "--host", "0.0.0.0", "--port", "8080", \\
     "--workers", "1", "--log-level", "info"]
`;
  } else {
    // Production Docker testing Dockerfile
    return `# Production Testing Dockerfile - Multi-stage build
FROM python:3.11-slim-bookworm AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \\
    build-essential \\
    gcc \\
    g++ \\
    curl \\
    git \\
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Production testing stage
FROM python:3.11-slim-bookworm AS testing

# Install runtime and testing dependencies
RUN apt-get update && apt-get install -y \\
    curl \\
    ca-certificates \\
    xvfb \\
    chromium \\
    && rm -rf /var/lib/apt/lists/* \\
    && groupadd -r testuser \\
    && useradd -r -g testuser -u 1000 testuser

# Copy Python packages from builder
COPY --from=builder /root/.local /home/testuser/.local

# Create app directory
WORKDIR /app

# Copy agent and test code
COPY --chown=testuser:testuser agent.py .
COPY --chown=testuser:testuser test_runner.py .

# Set environment variables
ENV PATH="/home/testuser/.local/bin:$PATH" \\
    PYTHONPATH="/app" \\
    PYTHONUNBUFFERED=1 \\
    PYTHONDONTWRITEBYTECODE=1 \\
    DISPLAY=:99

# Security: Run as non-root user
USER testuser

# Health check for testing
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=2 \\
    CMD python -c "import sys; sys.exit(0)"

# Run test with proper cleanup
CMD ["python", "test_runner.py"]
`;
  }
}

function extractModelConfig(model: string, deploymentType: string): {
  modelProvider: string;
  modelConfig: {
    baseUrl?: string;
    modelId?: string;
    region?: string;
    testEnvironment?: string;
  };
} {
  // Check deployment type first
  if (deploymentType === "aws" || deploymentType === "bedrock") {
    return {
      modelProvider: "bedrock",
      modelConfig: {
        region: process.env.AWS_REGION || "us-east-1",
        modelId: model,
        testEnvironment: "agentcore",
      },
    };
  }
  
  if (deploymentType === "ollama") {
    return {
      modelProvider: "ollama",
      modelConfig: {
        baseUrl: process.env.OLLAMA_BASE_URL || "http://host.docker.internal:11434",
        modelId: model,
        testEnvironment: "docker",
      },
    };
  }

  // Determine based on model ID format
  // Bedrock models: anthropic.*, amazon.*, ai21.*, cohere.*, meta.*, mistral.*
  if (model.startsWith("anthropic.") || 
      model.startsWith("amazon.") || 
      model.startsWith("ai21.") ||
      model.startsWith("cohere.") ||
      model.startsWith("meta.") ||
      model.startsWith("mistral.")) {
    return {
      modelProvider: "bedrock",
      modelConfig: {
        region: process.env.AWS_REGION || "us-east-1",
        modelId: model,
        testEnvironment: "agentcore",
      },
    };
  }
  
  // Ollama models: contain colon (e.g., "llama3:8b", "qwen3:4b")
  if (model.includes(':')) {
    return {
      modelProvider: "ollama",
      modelConfig: {
        baseUrl: process.env.OLLAMA_BASE_URL || "http://host.docker.internal:11434",
        modelId: model,
        testEnvironment: "docker",
      },
    };
  }

  // Default to bedrock for unknown formats
  return {
    modelProvider: "bedrock",
    modelConfig: {
      region: "us-east-1",
      modelId: model,
      testEnvironment: "agentcore",
    },
  };
}

async function getQueuePosition(ctx: any, testId: string): Promise<number> {
  const queueEntry = await ctx.db
    .query("testQueue")
    .withIndex("by_test", (q: any) => q.eq("testId", testId))
    .first();

  if (!queueEntry) return 0;

  const ahead = await ctx.db
    .query("testQueue")
    .withIndex("by_status_priority", (q: any) => q.eq("status", "pending"))
    .filter((q: any) => {
      return q.or(
        q.lt(q.field("priority"), queueEntry.priority),
        q.and(
          q.eq(q.field("priority"), queueEntry.priority),
          q.lt(q.field("createdAt"), queueEntry.createdAt)
        )
      );
    })
    .collect();

  return ahead.length + 1;
}

/**
 * Execute agent directly (for MCP tool invocation)
 *
 * DEPRECATED: This function is no longer used.
 * Use api.strandsAgentExecution.executeAgentWithStrandsAgents instead,
 * which is fully event-driven and calls AgentCore directly without polling.
 *
 * Kept for backward compatibility only.
 */
export const executeAgent = action({
  args: {
    agentId: v.id("agents"),
    input: v.string(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    response: string | null;
    error?: string;
  }> => {
    // Redirect to event-driven execution
    const result = await ctx.runAction(api.strandsAgentExecution.executeAgentWithStrandsAgents, {
      agentId: args.agentId,
      message: args.input,
      // No conversationId for MCP tool invocations (stateless)
    });

    return {
      success: result.success,
      response: result.content || null,
      error: result.error,
    };
  },
});
