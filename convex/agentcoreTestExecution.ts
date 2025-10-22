"use node";

/**
 * AgentCore Test Execution
 * Executes agent tests in Bedrock AgentCore sandbox (for Bedrock models)
 */

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

/**
 * Execute agent test in AgentCore sandbox
 * Called by queueProcessor for Bedrock models
 */
export const executeAgentCoreTest = internalAction({
  args: {
    testId: v.id("testExecutions"),
    agentId: v.id("agents"),
    input: v.string(),
    conversationHistory: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args): Promise<{ success: boolean; response?: string; error?: string; executionTime?: number }> => {
    const startTime = Date.now();

    try {
      // Get agent
      const agent: any = await ctx.runQuery(internal.agents.getInternal, { id: args.agentId });
      if (!agent) {
        throw new Error("Agent not found");
      }

      // Update test status to running
      await ctx.runMutation(internal.testExecution.updateStatus, {
        testId: args.testId,
        status: "RUNNING",
      });

      // Try Lambda first (runs actual agent code with @app.entrypoint)
      let result = await executeViaLambda({
        agentCode: agent.generatedCode,
        input: args.input,
        modelId: agent.model,
        tools: agent.tools || [],
      });
      
      if (!result.success) {
        const isTimeout = result.error?.includes("timeout");
        const is4xxOr5xx = result.error?.includes("4") || result.error?.includes("5");
        
        if (isTimeout) {
          // 200 but no response - wait 2s and retry Lambda once
          await new Promise(resolve => setTimeout(resolve, 2000));
          result = await executeViaLambda({
            agentCode: agent.generatedCode,
            input: args.input,
            modelId: agent.model,
            tools: agent.tools || [],
          });
          
          // If still timeout, fail
          if (!result.success) {
            return { success: false, error: result.error, executionTime: Date.now() - startTime };
          }
        } else if (is4xxOr5xx) {
          // 4xx/5xx - try Bedrock fallback once
          result = await executeViaDirectBedrock({
            input: args.input,
            modelId: agent.model,
            systemPrompt: agent.systemPrompt,
          });
        }
      }

      const executionTime = Date.now() - startTime;

      if (!result.success) {
        await ctx.runMutation(internal.testExecution.updateStatus, {
          testId: args.testId,
          status: "FAILED",
          success: false,
          error: result.error || "AgentCore execution failed",
        });
        return { success: false, error: result.error, executionTime };
      }

      // Update test with success
      await ctx.runMutation(internal.testExecution.updateStatus, {
        testId: args.testId,
        status: "COMPLETED",
        success: true,
        response: (result as any).result?.response || "No response",
      });

      return {
        success: true,
        response: (result as any).result?.response,
        executionTime,
      };
    } catch (error: any) {
      await ctx.runMutation(internal.testExecution.updateStatus, {
        testId: args.testId,
        status: "FAILED",
        success: false,
        error: error.message,
      });
      return { success: false, error: error.message, executionTime: Date.now() - startTime };
    }
  },
});


/**
 * Execute via Lambda (runs actual agent code with @app.entrypoint)
 */
async function executeViaLambda(params: {
  agentCode: string;
  input: string;
  modelId: string;
  tools: any[];
}): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const { LambdaClient, InvokeCommand } = await import("@aws-sdk/client-lambda");
    
    const client = new LambdaClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    
    const command = new InvokeCommand({
      FunctionName: process.env.AGENT_TEST_LAMBDA_FUNCTION || "agent-builder-test-runner",
      InvocationType: "RequestResponse",
      Payload: JSON.stringify({
        agentCode: params.agentCode,
        input: params.input,
        modelId: params.modelId,
        tools: params.tools,
      }),
    });
    
    // Set 30s timeout for Lambda response
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error("timeout")), 30000)
    );
    
    const response = await Promise.race([
      client.send(command),
      timeoutPromise
    ]);
    const statusCode = response.StatusCode || 500;
    
    // Lambda execution failed (agent code error)
    if (response.FunctionError) {
      const errorPayload = JSON.parse(new TextDecoder().decode(response.Payload));
      return {
        success: false,
        error: `Lambda 400: ${errorPayload.errorMessage || "agent code failed"}`,
      };
    }
    
    // Lambda invocation failed (service error)
    if (statusCode !== 200 && statusCode !== 202) {
      return {
        success: false,
        error: `Lambda ${statusCode}: invocation failed`,
      };
    }
    
    const result = JSON.parse(new TextDecoder().decode(response.Payload));
    return {
      success: true,
      result: { response: result.response || result.body },
    };
  } catch (error: any) {
    if (error.message === "timeout") {
      return { success: false, error: `Lambda timeout: no response after 30s` };
    }
    if (error.code === "ResourceNotFoundException") {
      return { success: false, error: `Lambda 404: function not found` };
    }
    if (error.code === "AccessDeniedException") {
      return { success: false, error: `Lambda 403: access denied` };
    }
    return { success: false, error: `Lambda 500: ${error.message}` };
  }
}

/**
 * Fallback: Execute via direct Bedrock API (doesn't run agent code, just model)
 */
async function executeViaDirectBedrock(params: {
  input: string;
  modelId: string;
  systemPrompt: string;
}): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const { BedrockRuntimeClient, InvokeModelCommand } = await import("@aws-sdk/client-bedrock-runtime");
    
    const client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    
    let modelId = params.modelId;
    if (!modelId.includes(":") && !modelId.startsWith("us.") && !modelId.startsWith("anthropic.")) {
      const modelMap: Record<string, string> = {
        "claude-3-5-sonnet-20241022": "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
        "claude-3-5-haiku-20241022": "us.anthropic.claude-3-5-haiku-20241022-v1:0",
      };
      modelId = modelMap[params.modelId] || "us.anthropic.claude-3-5-haiku-20241022-v1:0";
    }
    
    const command = new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 4096,
        system: params.systemPrompt,
        messages: [{ role: "user", content: [{ type: "text", text: params.input }] }],
      }),
    });
    
    const response = await client.send(command);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    const content = body.content?.find((c: any) => c.type === "text")?.text || "";
    
    return {
      success: true,
      result: { response: content },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Bedrock API failed: ${error.message}`,
    };
  }
}
