// AWS CloudWatch Logs client wrapper for real-time log streaming
import {
  CloudWatchLogsClient,
  GetLogEventsCommand,
  type GetLogEventsCommandInput,
} from "@aws-sdk/client-cloudwatch-logs";

// Get AWS credentials from environment
const AWS_REGION = process.env.AWS_S3_REGION || "us-east-1";
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

// Initialize CloudWatch Logs client
export const cloudwatchClient = new CloudWatchLogsClient({
  region: AWS_REGION,
  credentials: AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

const LOG_GROUP = process.env.CLOUDWATCH_LOG_GROUP || "/ecs/agent-tests";

/**
 * Fetch new log events from CloudWatch Logs
 */
export async function fetchLogEvents(params: {
  logStreamName: string;
  nextToken?: string;
  startTime?: number;
}): Promise<{
  events: Array<{ timestamp: number; message: string }>;
  nextForwardToken?: string;
  nextBackwardToken?: string;
}> {
  const input: GetLogEventsCommandInput = {
    logGroupName: LOG_GROUP,
    logStreamName: params.logStreamName,
    nextToken: params.nextToken,
    startTime: params.startTime,
    startFromHead: true, // Read from beginning
  };

  const command = new GetLogEventsCommand(input);
  const response = await cloudwatchClient.send(command);

  return {
    events: (response.events || []).map((event) => ({
      timestamp: event.timestamp || 0,
      message: event.message || "",
    })),
    nextForwardToken: response.nextForwardToken,
    nextBackwardToken: response.nextBackwardToken,
  };
}

/**
 * Poll for new log events (used in Convex scheduled action)
 */
export async function pollNewLogs(params: {
  logStreamName: string;
  lastFetchedToken?: string;
}): Promise<{
  newLogs: string[];
  nextToken?: string;
}> {
  try {
    const result = await fetchLogEvents({
      logStreamName: params.logStreamName,
      nextToken: params.lastFetchedToken,
    });

    // Filter out duplicate logs (CloudWatch sometimes returns same events)
    const newLogs = result.events.map((event) => event.message);

    return {
      newLogs,
      nextToken: result.nextForwardToken,
    };
  } catch (error: any) {
    // Log stream might not exist yet
    if (error.name === "ResourceNotFoundException") {
      return { newLogs: [], nextToken: undefined };
    }
    throw error;
  }
}

/**
 * Generate log stream name from test ID
 */
export function getLogStreamName(taskId: string): string {
  // ECS log stream format: {prefix}/{container-name}/{task-id}
  return `agent-test/agent-test-container/${taskId}`;
}
