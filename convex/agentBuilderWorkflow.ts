"use node";

/**
 * Agent Builder Workflow System
 *
 * Multi-stage prompt chaining workflow that guides Claude through
 * intelligent agent design and implementation.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

const WORKFLOW_REGION =
  process.env.BEDROCK_REGION ||
  process.env.AWS_REGION ||
  "us-east-1";

const bedrockClient = new BedrockRuntimeClient( {
  region: WORKFLOW_REGION,
} );

// Recommended default: Haiku 4.5 (cheapest Claude model — good for multi-stage workflows).
// User can override with any Bedrock model from the UI.
const DEFAULT_WORKFLOW_MODEL = "anthropic.claude-haiku-4-5-20251001-v1:0";

type WorkflowModelPayload = {
  modelId: string;
  stageName: string;
  systemPrompt: string;
  userPrompt: string;
};

type WorkflowModelResult = {
  outputText: string;
  inputTokens: number;
  outputTokens: number;
};

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
export const executeWorkflowStage = action( {
  args: {
    modelId: v.optional( v.string() ),
    stage: v.string(),
    userInput: v.string(),
    previousContext: v.optional( v.array( v.object( {
      stage: v.string(),
      output: v.string()
    } ) ) ),
    conversationId: v.optional( v.string() )
  },
  handler: async ( ctx, args ) => {
    const effectiveModelId = args.modelId || DEFAULT_WORKFLOW_MODEL;

    // Gate: enforce tier-based Bedrock access
    const { requireBedrockAccess } = await import( "./lib/bedrockGate" );
    const gateResult = await requireBedrockAccess(
      ctx, effectiveModelId,
      async ( lookupArgs ) => ctx.runQuery( internal.users.getInternal, lookupArgs ),
    );
    if ( !gateResult.allowed ) {
      throw new Error( gateResult.reason );
    }

    const stage = WORKFLOW_STAGES[args.stage as keyof typeof WORKFLOW_STAGES];
    if ( !stage ) {
      throw new Error( `Invalid workflow stage: ${args.stage}` );
    }

    // Build context from previous stages
    let contextPrompt = "";
    if ( args.previousContext && args.previousContext.length > 0 ) {
      contextPrompt = "\n\nPREVIOUS WORKFLOW OUTPUTS:\n\n";
      for ( const prevCtx of args.previousContext ) {
        contextPrompt += `=== ${prevCtx.stage.toUpperCase()} ===\n${prevCtx.output}\n\n`;
      }
    }

    const fullPrompt = `${contextPrompt}USER REQUEST:\n${args.userInput}\n\nYour task: ${stage.systemPrompt}`;

    const result = await invokeWorkflowModel( {
      modelId: effectiveModelId,
      stageName: stage.name,
      systemPrompt: stage.systemPrompt,
      userPrompt: fullPrompt,
    } );

    // Meter: token-based billing for this workflow stage (non-fatal)
    if ( result.inputTokens > 0 || result.outputTokens > 0 ) {
      try {
        await ctx.runMutation( internal.stripeMutations.incrementUsageAndReportOverage, {
          userId: gateResult.userId,
          modelId: effectiveModelId,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        } );
      } catch ( billingErr ) {
        console.error( "agentBuilderWorkflow: billing failed (non-fatal)", {
          userId: gateResult.userId, modelId: effectiveModelId,
          inputTokens: result.inputTokens, outputTokens: result.outputTokens,
          error: billingErr instanceof Error ? billingErr.message : billingErr,
        } );
      }
    }

    return {
      stage: stage.name,
      output: result.outputText,
      usage: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens
      }
    };
  }
} );

/**
 * Model-aware workflow invocation.
 * - Claude models → InvokeModelCommand with anthropic_version (supports thinking)
 * - All other models → ConverseCommand (universal Bedrock API)
 */
async function invokeWorkflowModel( payload: WorkflowModelPayload ): Promise<WorkflowModelResult> {
  const { modelId, stageName, systemPrompt, userPrompt } = payload;

  const { resolveBedrockModelId, getModelThinkingConfig } = await import( "./modelRegistry.js" );
  const resolvedModelId = resolveBedrockModelId( modelId );
  const thinkingConfig = getModelThinkingConfig( resolvedModelId );

  // Claude models: use InvokeModelCommand with anthropic_version for best results
  if ( thinkingConfig.apiPath === "anthropic-invoke" ) {
    return invokeViaClaude( resolvedModelId, stageName, systemPrompt, userPrompt );
  }

  // All other models: use ConverseCommand (universal Bedrock API)
  return invokeViaConverse( resolvedModelId, stageName, systemPrompt, userPrompt );
}

/** Claude-specific path: InvokeModelCommand with anthropic_version header */
async function invokeViaClaude(
  resolvedModelId: string, stageName: string, systemPrompt: string, userPrompt: string,
): Promise<WorkflowModelResult> {
  const { InvokeModelCommand } = await import( "@aws-sdk/client-bedrock-runtime" );

  const requestBody = {
    anthropic_version: "bedrock-2023-05-31",
    system: systemPrompt,
    max_tokens: 8000,
    temperature: 0.7,
    messages: [
      { role: "user", content: [{ type: "text", text: userPrompt }] },
    ],
  };

  const command = new InvokeModelCommand( {
    modelId: resolvedModelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify( requestBody ),
  } );

  try {
    const response = await bedrockClient.send( command );
    const decoded = new TextDecoder().decode( response.body );
    const json = JSON.parse( decoded );
    const contentBlocks = Array.isArray( json.content ) ? json.content : [];
    const outputText = contentBlocks
      .filter( ( block: any ) => block?.type === "text" && typeof block.text === "string" )
      .map( ( block: any ) => block.text as string )
      .join( "\n\n" )
      .trim();

    if ( !outputText ) {
      throw new Error( "Bedrock response did not include text content" );
    }

    const usage = json.usage ?? {};
    return {
      outputText,
      inputTokens: usage.input_tokens ?? usage.inputTokens ?? 0,
      outputTokens: usage.output_tokens ?? usage.outputTokens ?? 0,
    };
  } catch ( error: any ) {
    console.error( "Bedrock workflow invocation failed (Claude path)", {
      stageName, modelId: resolvedModelId, region: WORKFLOW_REGION, error: error?.message,
    } );
    throw new Error(
      `Bedrock workflow stage "${stageName}" failed: ${error?.message || "Unknown error"}`
    );
  }
}

/** Universal path: ConverseCommand works with ALL Bedrock models */
async function invokeViaConverse(
  resolvedModelId: string, stageName: string, systemPrompt: string, userPrompt: string,
): Promise<WorkflowModelResult> {
  const { ConverseCommand } = await import( "@aws-sdk/client-bedrock-runtime" );

  const command = new ConverseCommand( {
    modelId: resolvedModelId,
    messages: [{ role: "user", content: [{ text: userPrompt }] }],
    system: [{ text: systemPrompt }],
    inferenceConfig: { maxTokens: 8000, temperature: 0.7 },
  } );

  try {
    const response = await bedrockClient.send( command );
    const outputText = response.output?.message?.content?.[0]?.text || "";

    if ( !outputText ) {
      throw new Error( "Bedrock response did not include text content" );
    }

    const usage = response.usage ?? { inputTokens: 0, outputTokens: 0 };
    return {
      outputText,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
    };
  } catch ( error: any ) {
    console.error( "Bedrock workflow invocation failed (Converse path)", {
      stageName, modelId: resolvedModelId, region: WORKFLOW_REGION, error: error?.message,
    } );
    throw new Error(
      `Bedrock workflow stage "${stageName}" failed: ${error?.message || "Unknown error"}`
    );
  }
}

/**
 * Execute the complete agent building workflow
 */
export const executeCompleteWorkflow = action( {
  args: {
    modelId: v.optional( v.string() ),
    userRequest: v.string(),
    conversationId: v.optional( v.string() )
  },
  handler: async ( ctx, args ) => {
    const effectiveModelId = args.modelId || DEFAULT_WORKFLOW_MODEL;

    // Gate: enforce tier-based Bedrock access
    const { requireBedrockAccess } = await import( "./lib/bedrockGate" );
    const gateResult = await requireBedrockAccess(
      ctx, effectiveModelId,
      async ( lookupArgs ) => ctx.runQuery( internal.users.getInternal, lookupArgs ),
    );
    if ( !gateResult.allowed ) {
      throw new Error( gateResult.reason );
    }

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
    for ( const stageName of stages ) {
      const result = await ctx.runAction( api.agentBuilderWorkflow.executeWorkflowStage, {
        modelId: effectiveModelId,
        stage: stageName,
        userInput: args.userRequest,
        previousContext: workflowResults.map( r => ( {
          stage: r.stage,
          output: r.output
        } ) ),
        conversationId: args.conversationId
      } );

      workflowResults.push( result );
    }

    // Calculate total usage
    const totalUsage = workflowResults.reduce(
      ( acc, r ) => ( {
        inputTokens: acc.inputTokens + r.usage.inputTokens,
        outputTokens: acc.outputTokens + r.usage.outputTokens
      } ),
      { inputTokens: 0, outputTokens: 0 }
    );

    return {
      success: true,
      workflow: workflowResults,
      totalUsage,
      finalOutput: workflowResults[workflowResults.length - 1].output
    };
  }
} );

/**
 * Stream workflow execution with real-time updates
 * Uses Bedrock Converse API (works with ALL Bedrock models) with token billing.
 */
export const streamWorkflowExecution = action( {
  args: {
    userRequest: v.string(),
    modelId: v.optional( v.string() ), // User selects model; falls back to platform default
    conversationId: v.optional( v.string() ),
  },
  handler: async ( ctx, args ) => {
    const effectiveModelId = args.modelId || DEFAULT_WORKFLOW_MODEL;

    // Gate: enforce tier-based Bedrock access
    const { requireBedrockAccess } = await import( "./lib/bedrockGate" );
    const gateResult = await requireBedrockAccess(
      ctx, effectiveModelId,
      async ( lookupArgs ) => ctx.runQuery( internal.users.getInternal, lookupArgs ),
    );
    if ( !gateResult.allowed ) {
      throw new Error( gateResult.reason );
    }

    const { ConverseCommand } = await import( "@aws-sdk/client-bedrock-runtime" );
    const { resolveBedrockModelId } = await import( "./modelRegistry.js" );
    const resolvedModelId = resolveBedrockModelId( effectiveModelId );

    const stages = [
      "REQUIREMENTS",
      "ARCHITECTURE",
      "TOOL_DESIGN",
      "IMPLEMENTATION",
      "CODE_GENERATION",
      "VALIDATION",
    ];

    const workflowContext: Array<{ stage: string; output: string }> = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for ( const stageName of stages ) {
      const stage = WORKFLOW_STAGES[stageName as keyof typeof WORKFLOW_STAGES];

      // Build context from previous stages
      let contextPrompt = "";
      if ( workflowContext.length > 0 ) {
        contextPrompt = "\n\nPREVIOUS WORKFLOW OUTPUTS:\n\n";
        for ( const prevCtx of workflowContext ) {
          contextPrompt += `=== ${prevCtx.stage.toUpperCase()} ===\n${prevCtx.output}\n\n`;
        }
      }

      const fullPrompt = `${contextPrompt}USER REQUEST:\n${args.userRequest}\n\nYour task: ${stage.systemPrompt}`;

      // Use Converse API — works with ALL Bedrock models (Claude, DeepSeek, Kimi, Llama, etc.)
      const command = new ConverseCommand( {
        modelId: resolvedModelId,
        messages: [{ role: "user", content: [{ text: fullPrompt }] }],
        system: [{ text: stage.systemPrompt }],
        inferenceConfig: {
          maxTokens: 8000,
          temperature: 0.7,
        },
      } );

      const response = await bedrockClient.send( command );

      // Extract response text
      const stageOutput = response.output?.message?.content?.[0]?.text || "";

      // Accumulate tokens across all stages
      const usage = response.usage ?? { inputTokens: 0, outputTokens: 0 };
      totalInputTokens += usage.inputTokens || 0;
      totalOutputTokens += usage.outputTokens || 0;

      workflowContext.push( {
        stage: stage.name,
        output: stageOutput,
      } );
    }

    // Bill accumulated usage across all 6 stages (non-fatal)
    if ( totalInputTokens > 0 || totalOutputTokens > 0 ) {
      try {
        await ctx.runMutation( internal.stripeMutations.incrementUsageAndReportOverage, {
          userId: gateResult.userId,
          modelId: resolvedModelId,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        } );
      } catch ( error_ ) {
        console.error( "streamWorkflowExecution: billing failed (non-fatal)", {
          userId: gateResult.userId, modelId: resolvedModelId,
          inputTokens: totalInputTokens, outputTokens: totalOutputTokens,
          error: error_ instanceof Error ? error_.message : error_,
        } );
      }
    }

    return {
      success: true,
      workflow: workflowContext,
      totalUsage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      },
    };
  },
} );
