import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();

// Authentication routes
auth.addHttpRoutes(http);

// AWS STS AssumeRole
http.route({
  path: "/aws/assumeRole",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${process.env.AWS_API_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const { roleArn, externalId, sessionName, durationSeconds } = body;

    try {
      const AWS = await import("@aws-sdk/client-sts");
      const sts = new AWS.STSClient({
        region: process.env.AWS_REGION || "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      const command = new AWS.AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: sessionName,
        ExternalId: externalId,
        DurationSeconds: durationSeconds || 3600,
      });

      const response = await sts.send(command);

      return new Response(
        JSON.stringify({
          AccessKeyId: response.Credentials!.AccessKeyId,
          SecretAccessKey: response.Credentials!.SecretAccessKey,
          SessionToken: response.Credentials!.SessionToken,
          Expiration: response.Credentials!.Expiration,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message, code: error.Code }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// AWS ECS RunTask
http.route({
  path: "/aws/runTask",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${process.env.AWS_API_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const { credentials, region, cluster, taskDefinition, subnets, securityGroups, containerOverrides } = body;

    try {
      const AWS = await import("@aws-sdk/client-ecs");
      const ecs = new AWS.ECSClient({
        region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken,
        },
      });

      const command = new AWS.RunTaskCommand({
        cluster,
        taskDefinition,
        launchType: "FARGATE",
        networkConfiguration: {
          awsvpcConfiguration: { subnets, securityGroups, assignPublicIp: "ENABLED" },
        },
        overrides: { containerOverrides: [containerOverrides] },
      });

      const response = await ecs.send(command);
      if (!response.tasks || response.tasks.length === 0) {
        throw new Error("No tasks were created");
      }

      const task = response.tasks[0];
      return new Response(
        JSON.stringify({ taskArn: task.taskArn, taskId: task.taskArn?.split("/").pop(), status: task.lastStatus }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message, code: error.Code }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// Validate Role
http.route({
  path: "/validateRole",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const { roleArn, externalId } = body;

    try {
      const AWS = await import("@aws-sdk/client-sts");
      const sts = new AWS.STSClient({
        region: process.env.AWS_REGION || "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      const command = new AWS.AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: "validation-test",
        ExternalId: externalId,
        DurationSeconds: 900,
      });

      await sts.send(command);
      return new Response(
        JSON.stringify({ valid: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({ valid: false, error: error.message }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

export default http;
