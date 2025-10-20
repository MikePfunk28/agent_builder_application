"use node";

/**
 * Lambda-based Agent Testing
 * Fast, serverless testing using AWS Lambda
 */

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Execute agent test using Lambda (fast, cheap)
 */
export const executeLambdaTest = internalAction({
  args: {
    testId: v.id("testExecutions"),
    agentCode: v.string(),
    requirements: v.string(),
    testQuery: v.string(),
    modelId: v.string(),
    conversationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      // Import AWS SDK
      const { LambdaClient, InvokeCommand } = await import("@aws-sdk/client-lambda");

      const lambdaClient = new LambdaClient({
        region: process.env.AWS_REGION || "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      // Get conversation history from Convex
      const conversationHistory = args.conversationId
        ? await ctx.runQuery(internal.conversations.getHistory, {
            conversationId: args.conversationId,
          })
        : [];

      // Prepare Lambda payload
      const payload = {
        action: "test_agent",
        agent_code: args.agentCode,
        requirements: args.requirements,
        input: args.testQuery,
        model_id: args.modelId,
        conversation_history: conversationHistory,
        test_id: args.testId,
      };

      // Update test status
      await ctx.runMutation(internal.testExecution.updateStatus, {
        testId: args.testId,
        status: "RUNNING",
      });
      
      await ctx.runMutation(internal.testExecution.appendLogs, {
        testId: args.testId,
        logs: ["🚀 Invoking Lambda function...", `📝 Model: ${args.modelId}`],
        timestamp: Date.now(),
      });

      // Invoke Lambda
      const command = new InvokeCommand({
        FunctionName: process.env.AGENT_TEST_LAMBDA_FUNCTION || "agent-builder-test-runner",
        InvocationType: "RequestResponse", // Synchronous
        Payload: Buffer.from(JSON.stringify(payload)),
      });

      const startTime = Date.now();
      const response = await lambdaClient.send(command);
      const executionTime = Date.now() - startTime;

      // Parse response
      const result = JSON.parse(Buffer.from(response.Payload || new Uint8Array()).toString());

      if (result.statusCode === 200) {
        const body = JSON.parse(result.body);

        // Save conversation to Convex
        if (args.conversationId) {
          await ctx.runMutation(internal.conversations.addMessageInternal, {
            conversationId: args.conversationId,
            role: "user",
            content: args.testQuery,
          });
          await ctx.runMutation(internal.conversations.addMessageInternal, {
            conversationId: args.conversationId,
            role: "assistant",
            content: body.response,
          });
        }

        // Update test with success
        await ctx.runMutation(internal.testExecution.updateStatus, {
          testId: args.testId,
          status: "COMPLETED",
          success: true,
        });
        
        await ctx.runMutation(internal.testExecution.appendLogs, {
          testId: args.testId,
          logs: [
            "✅ Lambda invocation successful",
            `⏱️  Execution time: ${executionTime}ms`,
            `💬 Response: ${body.response}`,
          ],
          timestamp: Date.now(),
        });

        return { success: true, response: body.response };
      } else {
        throw new Error(result.body || "Lambda invocation failed");
      }
    } catch (error: any) {
      // Update test with failure
      await ctx.runMutation(internal.testExecution.updateStatus, {
        testId: args.testId,
        status: "FAILED",
        success: false,
        error: error.message,
        errorStage: "lambda_execution",
      });
      
      await ctx.runMutation(internal.testExecution.appendLogs, {
        testId: args.testId,
        logs: [`❌ Error: ${error.message}`],
        timestamp: Date.now(),
      });

      return { success: false, error: error.message };
    }
  },
});

/**
 * Execute agent test using Bedrock AgentCore (production-grade)
 */
export const executeAgentCoreTest = internalAction({
  args: {
    testId: v.id("testExecutions"),
    agentId: v.id("agents"),
    testQuery: v.string(),
    conversationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      // Import AWS SDK
      const { BedrockAgentRuntimeClient, InvokeAgentCommand } = await import(
        "@aws-sdk/client-bedrock-agent-runtime"
      );

      const client = new BedrockAgentRuntimeClient({
        region: process.env.AWS_REGION || "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      // Get or create AgentCore runtime
      const agentCoreId = await getOrCreateAgentCoreRuntime(ctx, args.agentId);

      // Get conversation history
      const conversationHistory = args.conversationId
        ? await ctx.runQuery(internal.conversations.getHistory, {
            conversationId: args.conversationId,
          })
        : [];

      // Update test status
      await ctx.runMutation(internal.testExecution.updateStatus, {
        testId: args.testId,
        status: "RUNNING",
      });
      
      await ctx.runMutation(internal.testExecution.appendLogs, {
        testId: args.testId,
        logs: [
          "🚀 Invoking Bedrock AgentCore...",
          `🤖 AgentCore ID: ${agentCoreId}`,
        ],
        timestamp: Date.now(),
      });

      // Invoke AgentCore with streaming
      const command = new InvokeAgentCommand({
        agentId: agentCoreId,
        agentAliasId: "TSTALIASID", // Test alias
        sessionId: args.conversationId || `test-${args.testId}`,
        inputText: args.testQuery,
      });

      const startTime = Date.now();
      const response = await client.send(command);
      const executionTime = Date.now() - startTime;

      // Process streaming response
      let fullResponse = "";
      const logs: string[] = [
        "🚀 Invoking Bedrock AgentCore...",
        `🤖 AgentCore ID: ${agentCoreId}`,
      ];

      if (response.completion) {
        for await (const event of response.completion) {
          if (event.chunk?.bytes) {
            const chunk = new TextDecoder().decode(event.chunk.bytes);
            fullResponse += chunk;
            logs.push(`📝 Chunk: ${chunk.substring(0, 50)}...`);
          }
        }
      }

      // Save conversation to Convex
      if (args.conversationId) {
        await ctx.runMutation(internal.conversations.addMessageInternal, {
          conversationId: args.conversationId,
          role: "user",
          content: args.testQuery,
        });
        await ctx.runMutation(internal.conversations.addMessageInternal, {
          conversationId: args.conversationId,
          role: "assistant",
          content: fullResponse,
        });
      }

      // Update test with success
      await ctx.runMutation(internal.testExecution.updateStatus, {
        testId: args.testId,
        status: "COMPLETED",
        success: true,
      });
      
      await ctx.runMutation(internal.testExecution.appendLogs, {
        testId: args.testId,
        logs: [
          "✅ AgentCore invocation successful",
          `⏱️  Execution time: ${executionTime}ms`,
          `💬 Response: ${fullResponse}`,
        ],
        timestamp: Date.now(),
      });

      return { success: true, response: fullResponse };
    } catch (error: any) {
      await ctx.runMutation(internal.testExecution.updateStatus, {
        testId: args.testId,
        status: "FAILED",
        success: false,
        error: error.message,
        errorStage: "agentcore_execution",
      });
      
      await ctx.runMutation(internal.testExecution.appendLogs, {
        testId: args.testId,
        logs: [`❌ Error: ${error.message}`],
        timestamp: Date.now(),
      });

      return { success: false, error: error.message };
    }
  },
});

/**
 * Get or create AgentCore runtime for an agent
 */
async function getOrCreateAgentCoreRuntime(ctx: any, agentId: any): Promise<string> {
  // For now, return a placeholder
  // In production, this would check for existing AgentCore deployment
  // and create one if it doesn't exist
  
  // TODO: Implement proper AgentCore deployment lookup
  // const deployment = await ctx.runQuery(internal.awsDeployment.listUserDeployments, {
  //   limit: 1
  // });
  
  // For testing, create a new AgentCore runtime
  const { BedrockAgentClient, CreateAgentCommand } = await import("@aws-sdk/client-bedrock-agent");

  const client = new BedrockAgentClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  const agent = await ctx.runQuery(internal.agents.getInternal, { id: agentId });

  const command = new CreateAgentCommand({
    agentName: agent.name.replace(/[^a-zA-Z0-9-]/g, "-"),
    foundationModel: agent.model,
    instruction: agent.systemPrompt,
    agentResourceRoleArn: process.env.BEDROCK_AGENT_ROLE_ARN,
  });

  const response = await client.send(command);

  // TODO: Save AgentCore ID to deployment record
  // await ctx.runMutation(internal.awsDeployment.createDeploymentInternal, {
  //   agentId,
  //   userId: agent.createdBy,
  //   tier: "freemium",
  //   deploymentConfig: { ... },
  // });

  return response.agent!.agentId!;
}
