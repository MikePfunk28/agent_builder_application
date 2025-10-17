"use node";

/**
 * AWS ECS Container Orchestrator
 *
 * Manages containerized agent test execution using AWS ECS Fargate.
 * Replaces the simulated Docker service with real container orchestration.
 */

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// AWS SDK v3 imports (add to package.json: @aws-sdk/client-ecs, @aws-sdk/client-cloudwatch-logs, @aws-sdk/client-s3)
// These will be dynamically imported in actions since they're Node.js only

interface ECSTaskConfig {
  taskArn: string;
  taskId: string;
  logGroup: string;
  logStream: string;
}

/**
 * Start an ECS Fargate task to execute an agent test
 */
export const startTestContainer = internalAction({
  args: {
    testId: v.id("testExecutions"),
    agentCode: v.string(),
    requirements: v.string(),
    dockerfile: v.string(),
    testQuery: v.string(),
    modelProvider: v.string(),
    modelConfig: v.object({
      baseUrl: v.optional(v.string()),
      modelId: v.optional(v.string()),
      region: v.optional(v.string()),
    }),
    timeout: v.number(),
  },
  handler: async (ctx, args): Promise<ECSTaskConfig | { error: string }> => {
    try {
      // Import AWS SDK dynamically (only available in Node.js environment)
      const { ECSClient, RunTaskCommand } = await import("@aws-sdk/client-ecs");

      const ecsClient = new ECSClient({
        region: process.env.AWS_S3_REGION || "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      // Generate unique task ID
      const taskId = `test-${args.testId.slice(-8)}-${Date.now().toString(36)}`;
      const logGroup = process.env.CLOUDWATCH_LOG_GROUP || "/ecs/agent-tests";
      const logStream = `${taskId}`;

      // Prepare environment variables for container
      const environment = [
        { name: "TEST_ID", value: args.testId },
        { name: "TEST_QUERY", value: args.testQuery },
        { name: "MODEL_PROVIDER", value: args.modelProvider },
        { name: "LOG_LEVEL", value: "INFO" },
      ];

      if (args.modelProvider === "ollama") {
        environment.push(
          { name: "OLLAMA_BASE_URL", value: args.modelConfig.baseUrl || "http://host.docker.internal:11434" },
          { name: "OLLAMA_MODEL", value: args.modelConfig.modelId || "llama2" }
        );
      } else if (args.modelProvider === "bedrock") {
        environment.push(
          { name: "AWS_REGION", value: args.modelConfig.region || "us-east-1" },
          { name: "BEDROCK_MODEL_ID", value: args.modelConfig.modelId || "anthropic.claude-3-sonnet-20240229-v1:0" }
        );
      }

      // Base64 encode agent code and files to pass as environment variables
      const agentCodeB64 = Buffer.from(args.agentCode).toString('base64');
      const requirementsB64 = Buffer.from(args.requirements).toString('base64');
      const dockerfileB64 = Buffer.from(args.dockerfile).toString('base64');

      environment.push(
        { name: "AGENT_CODE_B64", value: agentCodeB64 },
        { name: "REQUIREMENTS_B64", value: requirementsB64 },
        { name: "DOCKERFILE_B64", value: dockerfileB64 }
      );

      // Run ECS task
      const command = new RunTaskCommand({
        cluster: process.env.AWS_ECS_CLUSTER_ARN!,
        taskDefinition: process.env.AWS_ECS_TASK_DEFINITION!,
        launchType: "FARGATE",
        networkConfiguration: {
          awsvpcConfiguration: {
            subnets: process.env.AWS_ECS_SUBNETS!.split(","),
            securityGroups: [process.env.AWS_ECS_SECURITY_GROUP!],
            assignPublicIp: "DISABLED", // Use NAT gateway for egress
          },
        },
        overrides: {
          containerOverrides: [
            {
              name: "agent-test-container",
              environment,
            },
          ],
        },
        enableExecuteCommand: true, // Allow debugging via ECS Exec
        tags: [
          { key: "TestId", value: args.testId },
          { key: "Environment", value: "test" },
        ],
      });

      const result = await ecsClient.send(command);

      if (!result.tasks || result.tasks.length === 0) {
        throw new Error(`Failed to start ECS task: ${result.failures?.[0]?.reason || "Unknown error"}`);
      }

      const task = result.tasks[0];
      const taskArn = task.taskArn!;

      console.log(`✅ ECS task started: ${taskArn}`);
      console.log(`📊 Log stream: ${logGroup}/${logStream}`);

      // Schedule log polling to start
      await ctx.scheduler.runAfter(2000, internal.containerOrchestrator.pollLogs, {
        testId: args.testId,
        logGroup,
        logStream,
      });

      // Schedule timeout handler
      await ctx.scheduler.runAfter(args.timeout, internal.containerOrchestrator.handleTimeout, {
        testId: args.testId,
        taskArn,
      });

      return {
        taskArn,
        taskId,
        logGroup,
        logStream,
      };
    } catch (error: any) {
      console.error("❌ Failed to start ECS task:", error);
      return {
        error: `ECS task start failed: ${error.message}`,
      };
    }
  },
});

/**
 * Poll CloudWatch Logs for real-time log streaming
 */
export const pollLogs = internalAction({
  args: {
    testId: v.id("testExecutions"),
    logGroup: v.string(),
    logStream: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const { CloudWatchLogsClient, GetLogEventsCommand } = await import("@aws-sdk/client-cloudwatch-logs");

      const logsClient = new CloudWatchLogsClient({
        region: process.env.AWS_S3_REGION || "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      // Get test to check status and last fetched timestamp
      const test = await ctx.runQuery(internal.testExecution.getTestByIdInternal, { testId: args.testId });

      if (!test || test.status === "COMPLETED" || test.status === "FAILED") {
        // Test finished, stop polling
        return;
      }

      // Fetch logs
      const command = new GetLogEventsCommand({
        logGroupName: args.logGroup,
        logStreamName: args.logStream,
        startFromHead: true,
        startTime: test.lastLogFetchedAt || test.submittedAt,
      });

      const result = await logsClient.send(command);

      if (result.events && result.events.length > 0) {
        // Append new log lines to test
        const newLogs = result.events.map((e: any) => e.message || "").filter((m: string) => m.trim());

        if (newLogs.length > 0) {
          await ctx.runMutation(internal.testExecution.appendLogs, {
            testId: args.testId,
            logs: newLogs,
            timestamp: Date.now(),
          });

          // Check for completion markers in logs
          const logsText = newLogs.join("\n");
          if (logsText.includes("TEST COMPLETED SUCCESSFULLY")) {
            await ctx.runMutation(internal.testExecution.updateStatus, {
              testId: args.testId,
              status: "COMPLETED",
              success: true,
            });
            return; // Stop polling
          } else if (logsText.includes("TEST FAILED")) {
            await ctx.runMutation(internal.testExecution.updateStatus, {
              testId: args.testId,
              status: "FAILED",
              success: false,
            });
            return; // Stop polling
          }
        }
      }

      // Schedule next poll in 2 seconds
      await ctx.scheduler.runAfter(2000, internal.containerOrchestrator.pollLogs, {
        testId: args.testId,
        logGroup: args.logGroup,
        logStream: args.logStream,
      });
    } catch (error: any) {
      console.error("❌ Log polling error:", error);

      // Retry with exponential backoff (up to 3 attempts)
      const test = await ctx.runQuery(internal.testExecution.getTestByIdInternal, { testId: args.testId });
      const attempts = (test?.logs?.filter((l: string) => l.includes("Log polling error")).length || 0) + 1;

      if (attempts < 3) {
        await ctx.scheduler.runAfter(Math.min(5000 * attempts, 15000), internal.containerOrchestrator.pollLogs, {
          testId: args.testId,
          logGroup: args.logGroup,
          logStream: args.logStream,
        });
      }
    }
  },
});

/**
 * Handle test timeout
 */
export const handleTimeout = internalAction({
  args: {
    testId: v.id("testExecutions"),
    taskArn: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if test is still running
    const test = await ctx.runQuery(internal.testExecution.getTestByIdInternal, { testId: args.testId });

    if (!test || test.status === "COMPLETED" || test.status === "FAILED") {
      return; // Already finished
    }

    console.log(`⏰ Test ${args.testId} timed out, stopping ECS task...`);

    try {
      const { ECSClient, StopTaskCommand } = await import("@aws-sdk/client-ecs");

      const ecsClient = new ECSClient({
        region: process.env.AWS_S3_REGION || "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      await ecsClient.send(new StopTaskCommand({
        cluster: process.env.AWS_ECS_CLUSTER_ARN!,
        task: args.taskArn,
        reason: "Test timeout exceeded",
      }));

      await ctx.runMutation(internal.testExecution.updateStatus, {
        testId: args.testId,
        status: "FAILED",
        success: false,
        error: "Test execution timeout (exceeded maximum allowed time)",
        errorStage: "runtime",
      });

      await ctx.runMutation(internal.testExecution.appendLogs, {
        testId: args.testId,
        logs: ["⏰ Test timed out and was cancelled"],
        timestamp: Date.now(),
      });
    } catch (error: any) {
      console.error("❌ Failed to stop timed-out task:", error);
    }
  },
});

/**
 * Stop a running ECS task (for cancellation)
 */
export const stopTestContainer = internalAction({
  args: {
    testId: v.id("testExecutions"),
    taskArn: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const { ECSClient, StopTaskCommand } = await import("@aws-sdk/client-ecs");

      const ecsClient = new ECSClient({
        region: process.env.AWS_S3_REGION || "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      await ecsClient.send(new StopTaskCommand({
        cluster: process.env.AWS_ECS_CLUSTER_ARN!,
        task: args.taskArn,
        reason: "User cancelled test",
      }));

      await ctx.runMutation(internal.testExecution.updateStatus, {
        testId: args.testId,
        status: "FAILED",
        success: false,
        error: "Test cancelled by user",
        errorStage: "runtime",
      });

      await ctx.runMutation(internal.testExecution.appendLogs, {
        testId: args.testId,
        logs: ["🛑 Test cancelled by user"],
        timestamp: Date.now(),
      });

      return { success: true };
    } catch (error: any) {
      console.error("❌ Failed to stop task:", error);
      return { error: error.message };
    }
  },
});

/**
 * Get ECS task status
 */
export const getTaskStatus = action({
  args: {
    taskArn: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const { ECSClient, DescribeTasksCommand } = await import("@aws-sdk/client-ecs");

      const ecsClient = new ECSClient({
        region: process.env.AWS_S3_REGION || "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      const result = await ecsClient.send(new DescribeTasksCommand({
        cluster: process.env.AWS_ECS_CLUSTER_ARN!,
        tasks: [args.taskArn],
      }));

      const task = result.tasks?.[0];
      if (!task) {
        return { status: "UNKNOWN" };
      }

      return {
        status: task.lastStatus,
        desiredStatus: task.desiredStatus,
        cpu: task.cpu,
        memory: task.memory,
        containers: task.containers?.map((c: any) => ({
          name: c.name,
          status: c.lastStatus,
          exitCode: c.exitCode,
        })),
      };
    } catch (error: any) {
      console.error("❌ Failed to get task status:", error);
      return { error: error.message };
    }
  },
});
