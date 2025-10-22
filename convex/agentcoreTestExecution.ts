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

      // Execute the user's generated agent code directly
      // This runs THEIR agent with THEIR chosen model, not ours
      const result = await executeUserAgentCode({
        agentCode: agent.generatedCode,
        input: args.input,
        modelId: agent.model,
        tools: agent.tools || [],
      });

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
 * Execute user's generated agent code
 * This runs THEIR agent with THEIR model, not ours
 */
async function executeUserAgentCode(params: {
  agentCode: string;
  input: string;
  modelId: string;
  tools: any[];
}): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    // In production, this would:
    // 1. Write agent code to temp file
    // 2. Run: echo '{"prompt":"input"}' | python agent.py
    // 3. Capture output
    // 4. Parse response
    
    // For now, we'll use a subprocess to run the agent
    const { spawn } = await import("child_process");
    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");
    
    // Create temp directory
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "agent-test-"));
    const agentFile = path.join(tempDir, "agent.py");
    
    // Write agent code
    await fs.promises.writeFile(agentFile, params.agentCode);
    
    // Prepare input
    const input = JSON.stringify({ prompt: params.input });
    
    // Run agent
    return new Promise((resolve) => {
      const childProcess = spawn("python", [agentFile], {
        cwd: tempDir,
        env: {
          ...process.env,
          BYPASS_TOOL_CONSENT: "true",
          AWS_REGION: process.env.AWS_REGION || "us-east-1",
          AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
          AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
        }
      });
      
      let stdout = "";
      let stderr = "";
      
      childProcess.stdout.on("data", (data: any) => {
        stdout += data.toString();
      });
      
      childProcess.stderr.on("data", (data: any) => {
        stderr += data.toString();
      });
      
      // Send input
      childProcess.stdin.write(input);
      childProcess.stdin.end();
      
      // Handle completion
      childProcess.on("close", async (code: any) => {
        // Cleanup
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        
        if (code !== 0) {
          resolve({
            success: false,
            error: `Agent exited with code ${code}: ${stderr}`
          });
          return;
        }
        
        try {
          // Parse response (agent outputs JSON events)
          const lines = stdout.split("\n").filter(l => l.trim());
          const lastLine = lines[lines.length - 1];
          const response = JSON.parse(lastLine);
          
          resolve({
            success: true,
            result: { response }
          });
        } catch (e) {
          resolve({
            success: true,
            result: { response: stdout }
          });
        }
      });
      
      // Timeout after 5 minutes
      setTimeout(() => {
        childProcess.kill();
        resolve({
          success: false,
          error: "Agent execution timeout (5 minutes)"
        });
      }, 300000);
    });
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}
