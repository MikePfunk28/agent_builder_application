import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { api } from "./_generated/api";

const http = httpRouter();

// CORS configuration for Cloudflare Pages
http.route({
  path: "/*",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }),
});

// Authentication routes
auth.addHttpRoutes(http);

// MCP Protocol Endpoints - Expose agents as MCP tools
http.route({
  path: "/mcp/tools/list",
  method: "POST",
  handler: httpAction(async (ctx, _request) => {
    try {
      // Get all agents marked as exposable
      const agents = await ctx.runQuery(api.agents.listExposableAgents);
      
      // Return in MCP protocol format
      return new Response(
        JSON.stringify({
          tools: agents.map(agent => ({
            name: agent.name,
            description: agent.description,
            inputSchema: agent.inputSchema
          }))
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({ 
          error: "Failed to list tools",
          message: error.message 
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

http.route({
  path: "/mcp/tools/call",
  method: "POST",
  handler: httpAction(async (ctx, _request) => {
    try {
      const body = await _request.json();
      const { name, arguments: args } = body;

      if (!name) {
        return new Response(
          JSON.stringify({ 
            error: "Missing required field: name" 
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Find agent by MCP tool name
      const agent: any = await ctx.runQuery(api.agents.getByMCPToolName, { name });

      if (!agent) {
        return new Response(
          JSON.stringify({ 
            error: "Agent not found",
            message: `No agent found with MCP tool name: ${name}` 
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (!agent.exposableAsMCPTool) {
        return new Response(
          JSON.stringify({ 
            error: "Agent not exposable",
            message: `Agent ${name} is not configured to be exposed as an MCP tool` 
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Execute agent with provided arguments
      // Note: This assumes there's an agent execution action available
      // We'll need to create or reference the appropriate execution method
      const result = await ctx.runAction(api.testExecution.executeAgent, {
        agentId: agent._id,
        input: args?.input || JSON.stringify(args),
      });

      // Return result in MCP protocol format
      return new Response(
        JSON.stringify({ 
          content: [{
            type: "text",
            text: result.response || result.error || "No response"
          }]
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({ 
          error: "Failed to execute agent",
          message: error.message 
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

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
