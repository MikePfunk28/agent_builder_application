// AWS ECS client wrapper for container orchestration
import {
  ECSClient,
  RunTaskCommand,
  StopTaskCommand,
  DescribeTasksCommand,
  RegisterTaskDefinitionCommand,
  type RunTaskCommandInput,
  type RegisterTaskDefinitionCommandInput,
} from "@aws-sdk/client-ecs";

// Get AWS credentials from environment
const AWS_REGION = process.env.AWS_S3_REGION || "us-east-1";
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

// Initialize ECS client
export const ecsClient = new ECSClient({
  region: AWS_REGION,
  credentials: AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      }
    : undefined, // Falls back to IAM role if no explicit credentials
});

/**
 * Start a new Fargate task for agent testing
 */
export async function startFargateTask(params: {
  testId: string;
  agentCode: string;
  requirements: string;
  dockerfile: string;
  testQuery: string;
  modelProvider: string;
  modelConfig: {
    baseUrl?: string;
    modelId?: string;
    region?: string;
  };
}): Promise<{ taskArn: string; taskId: string }> {
  const clusterArn = process.env.AWS_ECS_CLUSTER_ARN;
  const taskDefinition = process.env.AWS_ECS_TASK_DEFINITION;
  const subnets = process.env.AWS_ECS_SUBNETS?.split(",") || [];
  const securityGroup = process.env.AWS_ECS_SECURITY_GROUP;

  if (!clusterArn || !taskDefinition || subnets.length === 0 || !securityGroup) {
    throw new Error(
      "Missing required ECS configuration. Check AWS_ECS_CLUSTER_ARN, AWS_ECS_TASK_DEFINITION, AWS_ECS_SUBNETS, AWS_ECS_SECURITY_GROUP environment variables."
    );
  }

  // Build environment variables for the container
  const environment = [
    { name: "TEST_ID", value: params.testId },
    { name: "MODEL_PROVIDER", value: params.modelProvider },
    { name: "TEST_QUERY", value: params.testQuery },
  ];

  if (params.modelProvider === "ollama" && params.modelConfig.baseUrl) {
    environment.push({ name: "OLLAMA_BASE_URL", value: params.modelConfig.baseUrl });
    environment.push({ name: "OLLAMA_MODEL", value: params.modelConfig.modelId || "llama2" });
  } else if (params.modelProvider === "bedrock") {
    environment.push({ name: "AWS_REGION", value: params.modelConfig.region || AWS_REGION });
    environment.push({ name: "BEDROCK_MODEL_ID", value: params.modelConfig.modelId || "anthropic.claude-3-sonnet-20240229-v1:0" });
  }

  const runTaskInput: RunTaskCommandInput = {
    cluster: clusterArn,
    taskDefinition: taskDefinition,
    launchType: "FARGATE",
    capacityProviderStrategy: [
      {
        capacityProvider: "FARGATE_SPOT",
        weight: 2,
        base: 0,
      },
      {
        capacityProvider: "FARGATE",
        weight: 1,
        base: 1,
      },
    ],
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: subnets,
        securityGroups: [securityGroup],
        assignPublicIp: "DISABLED", // Private subnet with NAT gateway
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: "agent-test-container",
          environment: environment,
        },
      ],
    },
    tags: [
      { key: "TestId", value: params.testId },
      { key: "ModelProvider", value: params.modelProvider },
    ],
  };

  const command = new RunTaskCommand(runTaskInput);
  const response = await ecsClient.send(command);

  if (!response.tasks || response.tasks.length === 0) {
    throw new Error("Failed to start ECS task: no tasks returned");
  }

  const task = response.tasks[0];
  const taskArn = task.taskArn!;
  const taskId = taskArn.split("/").pop()!;

  return { taskArn, taskId };
}

/**
 * Stop a running Fargate task
 */
export async function stopFargateTask(params: {
  taskArn: string;
  reason: string;
}): Promise<void> {
  const clusterArn = process.env.AWS_ECS_CLUSTER_ARN;

  if (!clusterArn) {
    throw new Error("Missing AWS_ECS_CLUSTER_ARN environment variable");
  }

  const command = new StopTaskCommand({
    cluster: clusterArn,
    task: params.taskArn,
    reason: params.reason,
  });

  await ecsClient.send(command);
}

/**
 * Get task status
 */
export async function getTaskStatus(taskArn: string): Promise<{
  status: string;
  stoppedReason?: string;
  containers: Array<{
    name: string;
    exitCode?: number;
    reason?: string;
  }>;
}> {
  const clusterArn = process.env.AWS_ECS_CLUSTER_ARN;

  if (!clusterArn) {
    throw new Error("Missing AWS_ECS_CLUSTER_ARN environment variable");
  }

  const command = new DescribeTasksCommand({
    cluster: clusterArn,
    tasks: [taskArn],
  });

  const response = await ecsClient.send(command);

  if (!response.tasks || response.tasks.length === 0) {
    throw new Error(`Task not found: ${taskArn}`);
  }

  const task = response.tasks[0];

  return {
    status: task.lastStatus || "UNKNOWN",
    stoppedReason: task.stoppedReason,
    containers: (task.containers || []).map((container) => ({
      name: container.name || "unknown",
      exitCode: container.exitCode,
      reason: container.reason,
    })),
  };
}

/**
 * Count currently running tasks to check capacity
 */
export async function getRunningTaskCount(): Promise<number> {
  const clusterArn = process.env.AWS_ECS_CLUSTER_ARN;

  if (!clusterArn) {
    return 0;
  }

  // In a real implementation, you would list tasks with status RUNNING
  // For now, this is a placeholder that would need AWS SDK listTasks call
  // and filtering by the agent-test tag

  // This is simplified - actual implementation would use ListTasksCommand
  // with desiredStatus: "RUNNING" and filter by tags
  return 0; // TODO: Implement actual task counting
}
