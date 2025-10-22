"use node";

/**
 * Agent Builder Workflow System
 * 
 * Multi-stage prompt chaining workflow that guides Claude through
 * intelligent agent design and implementation.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

// Workflow stages for agent building
export const WORKFLOW_STAGES = {
  // Stage 1: Requirements Analysis
  REQUIREMENTS: {
    name: "requirements_analysis",
    systemPrompt: `You are an expert AI agent architect analyzing requirements.

Your ONLY job is to deeply understand what the user wants to build.

Extract and clarify:
1. Agent purpose and primary goal
2. Required capabilities and tools
3. Expected inputs and outputs
4. Success criteria
5. Constraints and limitations
6. Integration requirements

Ask clarifying questions if needed. Output a structured requirements document.`,
    outputFormat: "requirements_document"
  },

  // Stage 2: Architecture Design
  ARCHITECTURE: {
    name: "architecture_design",
    systemPrompt: `You are an expert AI agent architect designing system architecture.

Given the requirements, design the optimal agent architecture.

Consider:
1. Agent type (conversational, task-oriented, autonomous)
2. Tool requirements (what tools does it need?)
3. Memory and state management
4. Error handling and fallback strategies
5. Model selection (Bedrock, Ollama, Docker)
6. Performance and cost optimization

Output a detailed architecture specification with:
- Agent workflow diagram (as text)
- Tool specifications
- Data flow
- Integration points
- Deployment strategy`,
    outputFormat: "architecture_specification"
  },

  // Stage 3: Tool Design
  TOOL_DESIGN: {
    name: "tool_design",
    systemPrompt: `You are an expert tool designer for AI agents.

Given the architecture, design the specific tools the agent needs.

For each tool:
1. Tool name and purpose
2. Input schema (parameters)
3. Output schema
4. Implementation approach (API, MCP, custom code)
5. Error handling
6. Rate limits and constraints

If tools don't exist, design them from scratch.
Consider using MCP servers, APIs, or custom Python implementations.

Output detailed tool specifications ready for implementation.`,
    outputFormat: "tool_specifications"
  },

  // Stage 4: Implementation Planning
  IMPLEMENTATION: {
    name: "implementation_planning",
    systemPrompt: `You are an expert implementation planner for AI agents.

Given the architecture and tools, create a detailed implementation plan.

Plan should include:
1. File structure and organization
2. Dependencies and requirements
3. Code modules and their responsibilities
4. Configuration files needed
5. Testing strategy
6. Deployment checklist

Output a step-by-step implementation plan.`,
    outputFormat: "implementation_plan"
  },

  // Stage 5: Code Generation
  CODE_GENERATION: {
    name: "code_generation",
    systemPrompt: `You are an expert Python developer implementing AI agents.

Given the implementation plan, generate production-ready code.

Generate:
1. agent.py - Complete agent implementation with @agent decorator
2. Custom tools (if needed) with @tool decorator
3. requirements.txt - All dependencies with versions
4. mcp.json - MCP server configuration
5. Dockerfile - Container configuration
6. cloudformation.yaml OR deploy.sh - Deployment infrastructure

Code must be:
- Production-ready and robust
- Well-documented with docstrings
- Include error handling
- Follow best practices
- Include preprocessing/postprocessing hooks
- Use proper type hints

Output complete, runnable code for all files.`,
    outputFormat: "code_files"
  },

  // Stage 6: Testing & Validation
  VALIDATION: {
    name: "testing_validation",
    systemPrompt: `You are an expert QA engineer validating AI agent implementations.

Review the generated code and create a comprehensive test plan.

Validate:
1. Code correctness and completeness
2. Tool implementations
3. Error handling
4. Edge cases
5. Performance considerations
6. Security best practices

Output:
- Test scenarios
- Expected behaviors
- Potential issues and fixes
- Deployment readiness checklist`,
    outputFormat: "validation_report"
  }
};

/**
 * Execute a single workflow stage
 */
export const executeWorkflowStage = action({
  args: {
    stage: v.string(),
    userInput: v.string(),
    previousContext: v.optional(v.array(v.object({
      stage: v.string(),
      output: v.string()
    }))),
    conversationId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const stage = WORKFLOW_STAGES[args.stage as keyof typeof WORKFLOW_STAGES];
    if (!stage) {
      throw new Error(`Invalid workflow stage: ${args.stage}`);
    }

    // Build context from previous stages
    let contextPrompt = "";
    if (args.previousContext && args.previousContext.length > 0) {
      contextPrompt = "\n\nPREVIOUS WORKFLOW OUTPUTS:\n\n";
      for (const ctx of args.previousContext) {
        contextPrompt += `=== ${ctx.stage.toUpperCase()} ===\n${ctx.output}\n\n`;
      }
    }

    const fullPrompt = `${contextPrompt}USER REQUEST:\n${args.userInput}\n\nYour task: ${stage.systemPrompt}`;

    const response = await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 8000,
      temperature: 0.7,
      system: stage.systemPrompt,
      messages: [{
        role: "user",
        content: fullPrompt
      }]
    });

    const output = response.content[0].type === "text" 
      ? response.content[0].text 
      : "";

    return {
      stage: stage.name,
      output,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      }
    };
  }
});

/**
 * Execute the complete agent building workflow
 */
export const executeCompleteWorkflow = action({
  args: {
    userRequest: v.string(),
    conversationId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const workflowResults: Array<{
      stage: string;
      output: string;
      usage: { inputTokens: number; outputTokens: number };
    }> = [];

    const stages = [
      "REQUIREMENTS",
      "ARCHITECTURE", 
      "TOOL_DESIGN",
      "IMPLEMENTATION",
      "CODE_GENERATION",
      "VALIDATION"
    ];

    // Execute each stage sequentially, passing context forward
    for (const stageName of stages) {
      const result = await ctx.runAction(api.agentBuilderWorkflow.executeWorkflowStage, {
        stage: stageName,
        userInput: args.userRequest,
        previousContext: workflowResults.map(r => ({
          stage: r.stage,
          output: r.output
        })),
        conversationId: args.conversationId
      });

      workflowResults.push(result);
    }

    // Calculate total usage
    const totalUsage = workflowResults.reduce(
      (acc, r) => ({
        inputTokens: acc.inputTokens + r.usage.inputTokens,
        outputTokens: acc.outputTokens + r.usage.outputTokens
      }),
      { inputTokens: 0, outputTokens: 0 }
    );

    return {
      success: true,
      workflow: workflowResults,
      totalUsage,
      finalOutput: workflowResults[workflowResults.length - 1].output
    };
  }
});

/**
 * Stream workflow execution with real-time updates
 */
export const streamWorkflowExecution = action({
  args: {
    userRequest: v.string(),
    conversationId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const stages = [
      "REQUIREMENTS",
      "ARCHITECTURE",
      "TOOL_DESIGN", 
      "IMPLEMENTATION",
      "CODE_GENERATION",
      "VALIDATION"
    ];

    const workflowContext: Array<{ stage: string; output: string }> = [];

    for (const stageName of stages) {
      const stage = WORKFLOW_STAGES[stageName as keyof typeof WORKFLOW_STAGES];
      
      // Build context
      let contextPrompt = "";
      if (workflowContext.length > 0) {
        contextPrompt = "\n\nPREVIOUS WORKFLOW OUTPUTS:\n\n";
        for (const ctx of workflowContext) {
          contextPrompt += `=== ${ctx.stage.toUpperCase()} ===\n${ctx.output}\n\n`;
        }
      }

      const fullPrompt = `${contextPrompt}USER REQUEST:\n${args.userRequest}\n\nYour task: ${stage.systemPrompt}`;

      // Stream this stage
      const stream = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 8000,
        temperature: 0.7,
        system: stage.systemPrompt,
        messages: [{
          role: "user",
          content: fullPrompt
        }],
        stream: true
      });

      let stageOutput = "";
      
      for await (const event of stream) {
        if (event.type === "content_block_delta" && 
            event.delta.type === "text_delta") {
          stageOutput += event.delta.text;
        }
      }

      workflowContext.push({
        stage: stage.name,
        output: stageOutput
      });
    }

    return {
      success: true,
      workflow: workflowContext
    };
  }
});
