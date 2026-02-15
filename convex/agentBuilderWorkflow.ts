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

  // Stage 3: AST / Codebase Analysis (Traycer pattern)
  AST_ANALYSIS: {
    name: "ast_analysis",
    systemPrompt: `You are an expert codebase analyst performing structural analysis.

Given the architecture specification, analyze the target codebase structure to inform implementation.

Analyze and report:
1. Existing patterns and conventions to reuse (naming, folder structure, import style)
2. Dependency graph — which modules interact and how
3. Type constraints — existing TypeScript/Python types the agent must conform to
4. Integration points — APIs, hooks, events the agent should connect to
5. Potential conflicts — files, functions, or patterns that overlap with the new agent
6. Reusable utilities — existing helper functions, shared modules, or common abstractions

Output a structured AST analysis report with:
- File tree of relevant existing code
- Dependency map (module → dependencies)
- Type signatures to match
- Recommended patterns to follow
- Warnings about potential conflicts`,
    outputFormat: "ast_analysis_report"
  },

  // Stage 4: Tool Design
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

  // Stage 6: Test Generation (Traycer pattern — tests FROM the plan)
  TEST_GENERATION: {
    name: "test_generation",
    systemPrompt: `You are an expert test engineer building tests BEFORE code generation.

Given the implementation plan and tool specifications, generate comprehensive test specifications
that will CONSTRAIN the code generation step. Tests must be strict enough that any deviation
from the plan causes a failure.

Generate for EACH component:
1. Unit tests — individual function behavior, edge cases, error handling
2. Integration tests — component interactions, data flow, API contracts
3. Assertion patterns — specific values, types, and behaviors to verify
4. Security tests — input sanitization, injection prevention, auth checks
5. Performance constraints — response time limits, memory bounds

Output format:
- test_agent.py — pytest test file with all test cases
- Test manifest (JSON) listing every test with expected outcome
- Coverage requirements (which functions/lines must be tested)

CRITICAL: These tests will be included in the deployment package alongside the code.
The code generation step MUST produce code that passes ALL of these tests.`,
    outputFormat: "test_specifications"
  },

  // Stage 7: Code Generation
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
  },

  // Stage 9: Verification (Traycer pattern — verify build against tests)
  VERIFICATION: {
    name: "verification",
    systemPrompt: `You are an expert verification engineer performing final validation.

Given the generated code AND the test specifications from earlier stages, perform a comprehensive
verification that the implementation is complete and correct.

Verify:
1. All generated tests would pass against the generated code (trace through logic)
2. No type errors — all TypeScript/Python types match their contracts
3. Security checks pass — no dangerous dynamic code evaluation, no unsanitized user input in shell commands
4. All deployment files are present and syntactically valid (agent.py, requirements.txt, Dockerfile, mcp.json)
5. All integration points connect correctly (APIs, tools, MCP servers)
6. Error handling is complete — every external call has try/catch or equivalent
7. The agent matches the original requirements specification from Stage 1

Output a verification report with:
- Pass/fail status for each check
- Specific line references for any issues found
- Remediation steps for failures
- Final deployment readiness score (0-100)
- Sign-off recommendation (READY / NEEDS_FIXES / BLOCKED)`,
    outputFormat: "verification_report"
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

    // Rate limit: prevent burst abuse per user
    const { checkRateLimit, buildTierRateLimitConfig } = await import( "./rateLimiter" );
    const { getTierConfig } = await import( "./lib/tierConfig" );
    const rlCfg = buildTierRateLimitConfig( getTierConfig( gateResult.tier ).maxConcurrentTests, "agentExecution" );
    const rlResult = await checkRateLimit( ctx, String( gateResult.userId ), "agentExecution", rlCfg );
    if ( !rlResult.allowed ) {
      throw new Error( rlResult.reason ?? "Rate limit exceeded. Please try again later." );
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
      } catch ( error_ ) {
        console.error( "agentBuilderWorkflow: billing failed (non-fatal)", {
          userId: gateResult.userId, modelId: effectiveModelId,
          inputTokens: result.inputTokens, outputTokens: result.outputTokens,
          error: error_ instanceof Error ? error_.message : error_,
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

    // Rate limit: prevent burst abuse per user
    {
      const { checkRateLimit, buildTierRateLimitConfig } = await import( "./rateLimiter" );
      const { getTierConfig } = await import( "./lib/tierConfig" );
      const rlCfg = buildTierRateLimitConfig( getTierConfig( gateResult.tier ).maxConcurrentTests, "agentExecution" );
      const rlResult = await checkRateLimit( ctx, String( gateResult.userId ), "agentExecution", rlCfg );
      if ( !rlResult.allowed ) {
        throw new Error( rlResult.reason ?? "Rate limit exceeded. Please try again later." );
      }
    }

    const workflowResults: Array<{
      stage: string;
      output: string;
      usage: { inputTokens: number; outputTokens: number };
    }> = [];

    const stages = [
      "REQUIREMENTS",
      "ARCHITECTURE",
      "AST_ANALYSIS",
      "TOOL_DESIGN",
      "IMPLEMENTATION",
      "TEST_GENERATION",
      "CODE_GENERATION",
      "VALIDATION",
      "VERIFICATION",
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
      finalOutput: workflowResults.at( -1 )?.output ?? ""
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

    // Rate limit: prevent burst abuse per user
    {
      const { checkRateLimit, buildTierRateLimitConfig } = await import( "./rateLimiter" );
      const { getTierConfig } = await import( "./lib/tierConfig" );
      const rlCfg = buildTierRateLimitConfig( getTierConfig( gateResult.tier ).maxConcurrentTests, "agentExecution" );
      const rlResult = await checkRateLimit( ctx, String( gateResult.userId ), "agentExecution", rlCfg );
      if ( !rlResult.allowed ) {
        throw new Error( rlResult.reason ?? "Rate limit exceeded. Please try again later." );
      }
    }

    const { resolveBedrockModelId } = await import( "./modelRegistry.js" );
    const resolvedModelId = resolveBedrockModelId( effectiveModelId );

    const stages = [
      "REQUIREMENTS",
      "ARCHITECTURE",
      "AST_ANALYSIS",
      "TOOL_DESIGN",
      "IMPLEMENTATION",
      "TEST_GENERATION",
      "CODE_GENERATION",
      "VALIDATION",
      "VERIFICATION",
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

      // Use invokeWorkflowModel — routes to Claude-specific or ConverseCommand path automatically
      const result = await invokeWorkflowModel( {
        modelId: resolvedModelId,
        stageName: stage.name,
        systemPrompt: stage.systemPrompt,
        userPrompt: fullPrompt,
      } );

      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;

      workflowContext.push( {
        stage: stage.name,
        output: result.outputText,
      } );
    }

    // Bill accumulated usage across all 9 stages (non-fatal)
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
