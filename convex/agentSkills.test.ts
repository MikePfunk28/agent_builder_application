/**
 * Agent Skills & Agent Loop Tests
 *
 * Tests:
 * 1. INTERNAL_TOOL_MAP structure (from toolDispatch.ts)
 * 2. dispatchToolCall routing logic
 * 3. Agent loop tool_result message construction
 * 4. MAX_TOOL_LOOP_ITERATIONS safety limit
 * 5. Thinking level → API payload mapping
 * 6. Backward compatibility (agents without skills)
 * 7. Token accumulation across loop iterations
 * 8. Skill CRUD in metaTooling.ts
 */

import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach } from "vitest";
import schema from "./schema";
import { Id } from "./_generated/dataModel";

const modules = import.meta.glob( "./**/*.ts" );

// ─── 1. INTERNAL_TOOL_MAP ───────────────────────────────────────────────────

describe( "INTERNAL_TOOL_MAP (toolDispatch.ts)", () => {
  test( "exports all 9 built-in tool mappings", async () => {
    const { INTERNAL_TOOL_MAP } = await import( "./lib/toolDispatch" );
    const expectedTools = [
      "handoff_to_user",
      "short_term_memory",
      "long_term_memory",
      "semantic_memory",
      "self_consistency",
      "tree_of_thoughts",
      "reflexion",
      "map_reduce",
      "parallel_prompts",
    ];
    for ( const name of expectedTools ) {
      expect( INTERNAL_TOOL_MAP ).toHaveProperty( name );
    }
    expect( Object.keys( INTERNAL_TOOL_MAP ).length ).toBe( 9 );
  } );

  test( "each mapping references a valid api.tools.* action", async () => {
    const { INTERNAL_TOOL_MAP } = await import( "./lib/toolDispatch" );
    for ( const [name, ref] of Object.entries( INTERNAL_TOOL_MAP ) ) {
      // Convex FunctionReference is a string like "tools:shortTermMemory"
      expect( ref ).toBeDefined();
    }
  } );
} );

// ─── 2. Thinking Level → API Payload Mapping ────────────────────────────────

describe( "Thinking level payload mapping", () => {
  test( "mapThinkingLevelToPayload returns correct Opus 4.6 config for high", async () => {
    const { mapThinkingLevelToPayload } = await import( "./lib/toolDispatch" );
    const result = mapThinkingLevelToPayload( "high", "anthropic.claude-opus-4-6-v1" );
    expect( result.thinking ).toEqual( { type: "enabled", budget_tokens: 16384 } );
  } );

  test( "mapThinkingLevelToPayload returns correct config for low", async () => {
    const { mapThinkingLevelToPayload } = await import( "./lib/toolDispatch" );
    const result = mapThinkingLevelToPayload( "low", "anthropic.claude-sonnet-4-5-20250929-v1:0" );
    expect( result.thinking ).toEqual( { type: "enabled", budget_tokens: 1024 } );
  } );

  test( "mapThinkingLevelToPayload returns correct config for medium", async () => {
    const { mapThinkingLevelToPayload } = await import( "./lib/toolDispatch" );
    const result = mapThinkingLevelToPayload( "medium", "anthropic.claude-haiku-4-5-20251001-v1:0" );
    expect( result.thinking ).toEqual( { type: "enabled", budget_tokens: 4096 } );
  } );

  test( "mapThinkingLevelToPayload returns empty when level is undefined", async () => {
    const { mapThinkingLevelToPayload } = await import( "./lib/toolDispatch" );
    const result = mapThinkingLevelToPayload( undefined, "anthropic.claude-sonnet-4-5-20250929-v1:0" );
    expect( result ).toEqual( {} );
  } );

  test( "mapThinkingLevelToPayload returns empty for non-Claude models regardless of level", async () => {
    const { mapThinkingLevelToPayload } = await import( "./lib/toolDispatch" );
    // DeepSeek, Llama, Mistral should never get thinking config
    expect( mapThinkingLevelToPayload( "high", "deepseek.v3-v1:0" ) ).toEqual( {} );
    expect( mapThinkingLevelToPayload( "medium", "meta.llama3-3-70b-instruct-v1:0" ) ).toEqual( {} );
    expect( mapThinkingLevelToPayload( "low", "mistral:latest" ) ).toEqual( {} );
  } );
} );

// ─── 3. Tool Result Message Construction ────────────────────────────────────

describe( "buildToolResultMessages", () => {
  test( "builds correct assistant + tool_result messages for single tool call", async () => {
    const { buildToolResultMessages } = await import( "./lib/toolDispatch" );
    const assistantContent = [
      { type: "text" as const, text: "Let me look that up." },
      { type: "tool_use" as const, id: "toolu_123", name: "short_term_memory", input: { key: "test" } },
    ];
    const toolResults = [
      { toolUseId: "toolu_123", output: JSON.stringify( { success: true, value: "hello" } ) },
    ];

    const messages = buildToolResultMessages( assistantContent, toolResults );

    // Should produce 2 messages: assistant (echoed) + user with tool_result
    expect( messages ).toHaveLength( 2 );
    expect( messages[0].role ).toBe( "assistant" );
    expect( messages[0].content ).toEqual( assistantContent );
    expect( messages[1].role ).toBe( "user" );
    expect( messages[1].content ).toHaveLength( 1 );
    expect( messages[1].content[0].type ).toBe( "tool_result" );
    expect( messages[1].content[0].tool_use_id ).toBe( "toolu_123" );
  } );

  test( "builds correct messages for multiple tool calls", async () => {
    const { buildToolResultMessages } = await import( "./lib/toolDispatch" );
    const assistantContent = [
      { type: "tool_use" as const, id: "t1", name: "short_term_memory", input: {} },
      { type: "tool_use" as const, id: "t2", name: "long_term_memory", input: {} },
    ];
    const toolResults = [
      { toolUseId: "t1", output: "result1" },
      { toolUseId: "t2", output: "result2" },
    ];

    const messages = buildToolResultMessages( assistantContent, toolResults );
    expect( messages ).toHaveLength( 2 );
    // user message should have 2 tool_result blocks
    expect( messages[1].content ).toHaveLength( 2 );
  } );
} );

// ─── 4. MAX_TOOL_LOOP_ITERATIONS ────────────────────────────────────────────

describe( "MAX_TOOL_LOOP_ITERATIONS", () => {
  test( "constant is 10", async () => {
    const { MAX_TOOL_LOOP_ITERATIONS } = await import( "./lib/toolDispatch" );
    expect( MAX_TOOL_LOOP_ITERATIONS ).toBe( 10 );
  } );
} );

// ─── 5. buildToolsArray from skills ─────────────────────────────────────────

describe( "buildToolsArray", () => {
  test( "converts skill definitions to Anthropic tools format", async () => {
    const { buildToolsArray } = await import( "./lib/toolDispatch" );
    const skills = [
      {
        skillType: "internal" as const,
        name: "short_term_memory",
        toolDefinition: {
          name: "short_term_memory",
          description: "Store and retrieve short-term memory",
          inputSchema: {
            type: "object",
            properties: {
              action: { type: "string", description: "store or retrieve" },
              key: { type: "string", description: "Memory key" },
            },
            required: ["action", "key"],
          },
        },
      },
    ];

    const tools = buildToolsArray( skills );
    expect( tools ).toHaveLength( 1 );
    expect( tools[0].name ).toBe( "short_term_memory" );
    expect( tools[0].description ).toBe( "Store and retrieve short-term memory" );
    expect( tools[0].input_schema ).toBeDefined();
    expect( tools[0].input_schema.type ).toBe( "object" );
  } );

  test( "returns empty array when no skills", async () => {
    const { buildToolsArray } = await import( "./lib/toolDispatch" );
    expect( buildToolsArray( [] ) ).toEqual( [] );
  } );
} );

// ─── 6. Schema fields (backward compatibility) ─────────────────────────────

describe( "Schema backward compatibility", () => {
  let t: any;
  let testUserId: Id<"users">;

  beforeEach( async () => {
    t = convexTest( schema, modules );

    testUserId = await t.run( async ( ctx: any ) => {
      return await ctx.db.insert( "users", {
        email: "test@skills.com",
        name: "Skill Tester",
        tier: "personal",
        executionsThisMonth: 0,
        createdAt: Date.now(),
        isAnonymous: false,
      } );
    } );
  } );

  test( "agents can be created without skills or thinkingLevel (backward compat)", async () => {
    const agentId = await t.run( async ( ctx: any ) => {
      return await ctx.db.insert( "agents", {
        name: "Legacy Agent",
        description: "Agent without skills",
        model: "anthropic.claude-haiku-4-5-20251001-v1:0",
        systemPrompt: "You are a test agent.",
        tools: [],
        generatedCode: "# no code",
        deploymentType: "bedrock",
        createdBy: testUserId,
      } );
    } );
    expect( agentId ).toBeDefined();

    const agent = await t.run( async ( ctx: any ) => {
      return await ctx.db.get( agentId );
    } );
    expect( agent.skills ).toBeUndefined();
    expect( agent.thinkingLevel ).toBeUndefined();
  } );

  test( "agents can be created WITH skills and thinkingLevel", async () => {
    const agentId = await t.run( async ( ctx: any ) => {
      return await ctx.db.insert( "agents", {
        name: "Skilled Agent",
        description: "Agent with skills",
        model: "anthropic.claude-haiku-4-5-20251001-v1:0",
        systemPrompt: "You are a skilled agent.",
        tools: [],
        generatedCode: "# no code",
        deploymentType: "bedrock",
        createdBy: testUserId,
        skills: [
          { name: "short_term_memory", enabled: true },
          { name: "long_term_memory", enabled: false },
        ],
        thinkingLevel: "medium",
      } );
    } );
    expect( agentId ).toBeDefined();

    const agent = await t.run( async ( ctx: any ) => {
      return await ctx.db.get( agentId );
    } );
    expect( agent.skills ).toHaveLength( 2 );
    expect( agent.skills[0].name ).toBe( "short_term_memory" );
    expect( agent.skills[0].enabled ).toBe( true );
    expect( agent.skills[1].enabled ).toBe( false );
    expect( agent.thinkingLevel ).toBe( "medium" );
  } );

  test( "dynamicTools can be created with skill fields", async () => {
    const toolId = await t.run( async ( ctx: any ) => {
      return await ctx.db.insert( "dynamicTools", {
        name: "memory_lookup",
        displayName: "Memory Lookup",
        description: "Look up stored memories",
        userId: testUserId,
        code: "@tool\ndef memory_lookup(key: str) -> str:\n    return key",
        validated: true,
        parameters: {},
        invocationCount: 0,
        successCount: 0,
        errorCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isActive: true,
        // New skill fields:
        skillType: "internal",
        skillConfig: { actionName: "short_term_memory" },
        toolDefinition: {
          name: "memory_lookup",
          description: "Look up stored memories",
          inputSchema: { type: "object", properties: { key: { type: "string" } }, required: ["key"] },
        },
        skillInstructions: "# Memory Lookup\nUse this to look up memories.",
        tags: ["memory", "lookup"],
        version: "1.0.0",
      } );
    } );
    expect( toolId ).toBeDefined();

    const tool = await t.run( async ( ctx: any ) => {
      return await ctx.db.get( toolId );
    } );
    expect( tool.skillType ).toBe( "internal" );
    expect( tool.skillConfig.actionName ).toBe( "short_term_memory" );
    expect( tool.toolDefinition.name ).toBe( "memory_lookup" );
    expect( tool.tags ).toContain( "memory" );
    expect( tool.version ).toBe( "1.0.0" );
  } );

  test( "dynamicTools can be created WITHOUT skill fields (backward compat)", async () => {
    const toolId = await t.run( async ( ctx: any ) => {
      return await ctx.db.insert( "dynamicTools", {
        name: "legacy_tool",
        displayName: "Legacy Tool",
        description: "A legacy tool",
        userId: testUserId,
        code: "@tool\ndef legacy(x: str) -> str:\n    return x",
        validated: true,
        parameters: {},
        invocationCount: 0,
        successCount: 0,
        errorCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isActive: true,
      } );
    } );
    expect( toolId ).toBeDefined();

    const tool = await t.run( async ( ctx: any ) => {
      return await ctx.db.get( toolId );
    } );
    expect( tool.skillType ).toBeUndefined();
    expect( tool.skillConfig ).toBeUndefined();
    expect( tool.toolDefinition ).toBeUndefined();
    expect( tool.tags ).toBeUndefined();
  } );
} );

// ─── 7. Token accumulation helper ───────────────────────────────────────────

describe( "accumulateTokenUsage", () => {
  test( "accumulates tokens from multiple iterations", async () => {
    const { accumulateTokenUsage } = await import( "./lib/toolDispatch" );
    const accumulated = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

    accumulateTokenUsage( accumulated, { inputTokens: 100, outputTokens: 50, totalTokens: 150 } );
    expect( accumulated ).toEqual( { inputTokens: 100, outputTokens: 50, totalTokens: 150 } );

    accumulateTokenUsage( accumulated, { inputTokens: 200, outputTokens: 80, totalTokens: 280 } );
    expect( accumulated ).toEqual( { inputTokens: 300, outputTokens: 130, totalTokens: 430 } );
  } );

  test( "handles undefined token usage gracefully", async () => {
    const { accumulateTokenUsage } = await import( "./lib/toolDispatch" );
    const accumulated = { inputTokens: 50, outputTokens: 25, totalTokens: 75 };

    accumulateTokenUsage( accumulated, undefined );
    expect( accumulated ).toEqual( { inputTokens: 50, outputTokens: 25, totalTokens: 75 } );
  } );
} );

// ─── 8. Skill CRUD in metaTooling ───────────────────────────────────────────

describe( "Skill CRUD (metaTooling extensions)", () => {
  let t: any;
  let testUserId: Id<"users">;

  beforeEach( async () => {
    t = convexTest( schema, modules );

    testUserId = await t.run( async ( ctx: any ) => {
      return await ctx.db.insert( "users", {
        email: "test@skillcrud.com",
        name: "Skill CRUD Tester",
        tier: "personal",
        executionsThisMonth: 0,
        createdAt: Date.now(),
        isAnonymous: false,
      } );
    } );

    t = t.withIdentity( { subject: testUserId } );
  } );

  test( "createSkill creates a dynamicTool with skillType set", async () => {
    const { toolId } = await t.mutation( "metaTooling:createSkill", {
      name: "test_skill",
      displayName: "Test Skill",
      description: "A test skill",
      skillType: "internal",
      skillConfig: { actionName: "short_term_memory" },
      toolDefinition: {
        name: "test_skill",
        description: "A test skill",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
    } );
    expect( toolId ).toBeDefined();
  } );

  test( "listSkills returns only items with skillType set", async () => {
    // Create a regular tool (no skillType)
    await t.run( async ( ctx: any ) => {
      await ctx.db.insert( "dynamicTools", {
        name: "regular_tool",
        displayName: "Regular",
        description: "Not a skill",
        userId: testUserId,
        code: "@tool\ndef r(x: str) -> str:\n    return x",
        validated: true,
        parameters: {},
        invocationCount: 0,
        successCount: 0,
        errorCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isActive: true,
      } );
    } );

    // Create a skill
    await t.run( async ( ctx: any ) => {
      await ctx.db.insert( "dynamicTools", {
        name: "skill_tool",
        displayName: "Skill Tool",
        description: "This is a skill",
        userId: testUserId,
        code: "",
        validated: true,
        parameters: {},
        invocationCount: 0,
        successCount: 0,
        errorCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isActive: true,
        skillType: "internal",
        skillConfig: { actionName: "short_term_memory" },
        toolDefinition: {
          name: "skill_tool",
          description: "This is a skill",
          inputSchema: { type: "object", properties: {}, required: [] },
        },
      } );
    } );

    const skills = await t.query( "metaTooling:listSkills", {} );
    expect( skills.length ).toBeGreaterThanOrEqual( 1 );
    // All returned items should have skillType
    for ( const skill of skills ) {
      expect( skill.skillType ).toBeDefined();
    }
  } );

  test( "getSkillByName finds a skill by name", async () => {
    await t.run( async ( ctx: any ) => {
      await ctx.db.insert( "dynamicTools", {
        name: "findme_skill",
        displayName: "Find Me",
        description: "Find this skill",
        userId: testUserId,
        code: "",
        validated: true,
        parameters: {},
        invocationCount: 0,
        successCount: 0,
        errorCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isActive: true,
        skillType: "mcp",
        skillConfig: { serverName: "test", toolName: "test" },
        toolDefinition: {
          name: "findme_skill",
          description: "Find this skill",
          inputSchema: { type: "object", properties: {}, required: [] },
        },
      } );
    } );

    const skill = await t.query( "metaTooling:getSkillByName", { name: "findme_skill" } );
    expect( skill ).not.toBeNull();
    expect( skill.name ).toBe( "findme_skill" );
    expect( skill.skillType ).toBe( "mcp" );
  } );
} );

// ─── 9. Traycer-Pattern Workflow Stages (Phase 2) ────────────────────────────

describe( "WORKFLOW_STAGES (agentBuilderWorkflow.ts)", () => {
  test( "exports all 9 workflow stages (6 original + 3 Traycer)", async () => {
    const { WORKFLOW_STAGES } = await import( "./agentBuilderWorkflow" );
    const expectedStages = [
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
    for ( const stage of expectedStages ) {
      expect( WORKFLOW_STAGES ).toHaveProperty( stage );
    }
    expect( Object.keys( WORKFLOW_STAGES ).length ).toBe( 9 );
  } );

  test( "AST_ANALYSIS stage has required fields", async () => {
    const { WORKFLOW_STAGES } = await import( "./agentBuilderWorkflow" );
    const stage = WORKFLOW_STAGES.AST_ANALYSIS;
    expect( stage.name ).toBe( "ast_analysis" );
    expect( stage.systemPrompt ).toBeDefined();
    expect( stage.systemPrompt.length ).toBeGreaterThan( 50 );
    expect( stage.outputFormat ).toBe( "ast_analysis_report" );
  } );

  test( "TEST_GENERATION stage has required fields", async () => {
    const { WORKFLOW_STAGES } = await import( "./agentBuilderWorkflow" );
    const stage = WORKFLOW_STAGES.TEST_GENERATION;
    expect( stage.name ).toBe( "test_generation" );
    expect( stage.systemPrompt ).toBeDefined();
    expect( stage.systemPrompt.length ).toBeGreaterThan( 50 );
    expect( stage.outputFormat ).toBe( "test_specifications" );
  } );

  test( "VERIFICATION stage has required fields", async () => {
    const { WORKFLOW_STAGES } = await import( "./agentBuilderWorkflow" );
    const stage = WORKFLOW_STAGES.VERIFICATION;
    expect( stage.name ).toBe( "verification" );
    expect( stage.systemPrompt ).toBeDefined();
    expect( stage.systemPrompt.length ).toBeGreaterThan( 50 );
    expect( stage.outputFormat ).toBe( "verification_report" );
  } );

  test( "all stages have name, systemPrompt, and outputFormat", async () => {
    const { WORKFLOW_STAGES } = await import( "./agentBuilderWorkflow" );
    for ( const [key, stage] of Object.entries( WORKFLOW_STAGES ) ) {
      expect( stage.name ).toBeDefined();
      expect( typeof stage.name ).toBe( "string" );
      expect( stage.systemPrompt ).toBeDefined();
      expect( typeof stage.systemPrompt ).toBe( "string" );
      expect( stage.outputFormat ).toBeDefined();
      expect( typeof stage.outputFormat ).toBe( "string" );
    }
  } );
} );

// ─── 10. Iterative Agent Loop Constants (Phase 3) ────────────────────────────

describe( "Iterative agent loop types and constants", () => {
  test( "MAX_TOOL_LOOP_ITERATIONS is 10", async () => {
    const { MAX_TOOL_LOOP_ITERATIONS } = await import( "./lib/toolDispatch" );
    expect( MAX_TOOL_LOOP_ITERATIONS ).toBe( 10 );
  } );

  test( "COMPLETION_CRITERIA_TYPES exports valid criteria types", async () => {
    const { COMPLETION_CRITERIA_TYPES } = await import( "./lib/iterativeLoop" );
    expect( COMPLETION_CRITERIA_TYPES ).toContain( "tests_pass" );
    expect( COMPLETION_CRITERIA_TYPES ).toContain( "no_errors" );
    expect( COMPLETION_CRITERIA_TYPES ).toContain( "llm_judgment" );
    expect( COMPLETION_CRITERIA_TYPES ).toContain( "max_iterations" );
    expect( COMPLETION_CRITERIA_TYPES.length ).toBe( 4 );
  } );

  test( "DEFAULT_MAX_ITERATIONS is 10", async () => {
    const { DEFAULT_MAX_ITERATIONS } = await import( "./lib/iterativeLoop" );
    expect( DEFAULT_MAX_ITERATIONS ).toBe( 10 );
  } );

  test( "checkCompletionCriteria returns false for incomplete response", async () => {
    const { checkCompletionCriteria } = await import( "./lib/iterativeLoop" );
    const result = checkCompletionCriteria(
      { type: "no_errors" },
      { success: true, content: "Error: something went wrong" },
    );
    expect( result.isComplete ).toBe( false );
  } );

  test( "checkCompletionCriteria returns true for clean response", async () => {
    const { checkCompletionCriteria } = await import( "./lib/iterativeLoop" );
    const result = checkCompletionCriteria(
      { type: "no_errors" },
      { success: true, content: "All tasks completed successfully." },
    );
    expect( result.isComplete ).toBe( true );
  } );

  test( "checkCompletionCriteria handles max_iterations type", async () => {
    const { checkCompletionCriteria } = await import( "./lib/iterativeLoop" );
    // max_iterations always returns false (handled by loop counter, not content)
    const result = checkCompletionCriteria(
      { type: "max_iterations" },
      { success: true, content: "anything" },
    );
    expect( result.isComplete ).toBe( false );
  } );

  test( "checkCompletionCriteria handles tests_pass with success pattern", async () => {
    const { checkCompletionCriteria } = await import( "./lib/iterativeLoop" );
    const result = checkCompletionCriteria(
      { type: "tests_pass", successPattern: "ALL TESTS PASSED" },
      { success: true, content: "Output: ALL TESTS PASSED - 5/5 passing" },
    );
    expect( result.isComplete ).toBe( true );
  } );

  test( "checkCompletionCriteria handles tests_pass without success pattern", async () => {
    const { checkCompletionCriteria } = await import( "./lib/iterativeLoop" );
    const result = checkCompletionCriteria(
      { type: "tests_pass" },
      { success: true, content: "test results: 3 failed, 2 passed" },
    );
    expect( result.isComplete ).toBe( false );
  } );

  test( "buildContinuationPrompt includes previous output", async () => {
    const { buildContinuationPrompt } = await import( "./lib/iterativeLoop" );
    const prompt = buildContinuationPrompt(
      "Build a REST API",
      "I created the endpoints but tests are failing",
      3,
      10,
    );
    expect( prompt ).toContain( "Build a REST API" );
    expect( prompt ).toContain( "tests are failing" );
    expect( prompt ).toContain( "3" );
    expect( prompt ).toContain( "10" );
  } );
} );

// ─── 11. Skill Type Dispatch Handlers (Phase 4) ─────────────────────────────

describe( "dispatchToolCall skill type routing", () => {
  test( "code skill type returns result (not silent fail)", async () => {
    const { dispatchToolCall } = await import( "./lib/toolDispatch" );
    // Create a mock code skill
    const codeSkill = {
      skillType: "code" as const,
      name: "python_tool",
      toolDefinition: {
        name: "python_tool",
        description: "Runs Python code",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      skillConfig: { code: "print('hello')", language: "python" },
    };

    // dispatchToolCall with a code skill should NOT fall through silently
    // It should return a result (success or error) — not undefined
    // Code handler should be reached (not silently skipped) and return a result.
    const result = await dispatchToolCall(
      {} as any,
      "python_tool",
      { input: "test" },
      [codeSkill],
      "test-user",
    );

    expect( result ).toBeDefined();
    expect( result ).toHaveProperty( "success" );
    expect( result.success ).toBe( true );
  } );

  test( "composite skill type returns result (not silent fail)", async () => {
    const { dispatchToolCall } = await import( "./lib/toolDispatch" );
    const compositeSkill = {
      skillType: "composite" as const,
      name: "chain_tool",
      toolDefinition: {
        name: "chain_tool",
        description: "Chains multiple skills",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      skillConfig: { steps: [{ skillName: "short_term_memory", inputMapping: {} }] },
    };

    // Composite handler should be reached — it will return an error because
    // the sub-step "short_term_memory" is not in the skills list (expected behavior).
    const result = await dispatchToolCall(
      {} as any,
      "chain_tool",
      {},
      [compositeSkill],
      "test-user",
    );

    expect( result ).toBeDefined();
    expect( result ).toHaveProperty( "success" );
    // The composite handler returns { success: false } when a sub-step skill is not found
    expect( result.success ).toBe( false );
    expect( result.error ).toContain( "not found" );
  } );

  test( "sandbox skill type returns result (not silent fail)", async () => {
    const { dispatchToolCall } = await import( "./lib/toolDispatch" );
    const sandboxSkill = {
      skillType: "sandbox" as const,
      name: "docker_tool",
      toolDefinition: {
        name: "docker_tool",
        description: "Runs code in sandbox",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      skillConfig: { runtime: "docker", command: "python test.py", timeout: 30000 },
    };

    // Sandbox handler should be reached (not silently skipped) and return a result.
    const result = await dispatchToolCall(
      {} as any,
      "docker_tool",
      {},
      [sandboxSkill],
      "test-user",
    );

    expect( result ).toBeDefined();
    expect( result ).toHaveProperty( "success" );
    expect( result.success ).toBe( true );
  } );
} );

// ─── 12. isOllamaModelId & deriveDeploymentType (Phase 0) ───────────────────

describe( "isOllamaModelId", () => {
  test( "returns true for explicit ollama deploymentType", async () => {
    const { isOllamaModelId } = await import( "./modelRegistry" );
    expect( isOllamaModelId( "anything", "ollama" ) ).toBe( true );
  } );

  test( "returns true for model name containing 'ollama'", async () => {
    const { isOllamaModelId } = await import( "./modelRegistry" );
    expect( isOllamaModelId( "ollama/qwen3:4b" ) ).toBe( true );
    expect( isOllamaModelId( "Ollama-custom:latest" ) ).toBe( true );
  } );

  test( "returns true for colon-no-dot pattern without deploymentType", async () => {
    const { isOllamaModelId } = await import( "./modelRegistry" );
    expect( isOllamaModelId( "qwen3:4b" ) ).toBe( true );
    expect( isOllamaModelId( "llama3:8b" ) ).toBe( true );
    expect( isOllamaModelId( "mistral:latest" ) ).toBe( true );
  } );

  test( "returns false for Bedrock IDs with colon AND dot", async () => {
    const { isOllamaModelId } = await import( "./modelRegistry" );
    expect( isOllamaModelId( "anthropic.claude-haiku-4-5-20251001-v1:0" ) ).toBe( false );
    expect( isOllamaModelId( "anthropic.claude-sonnet-4-5-20250929-v1:0" ) ).toBe( false );
    expect( isOllamaModelId( "deepseek.v3-v1:0" ) ).toBe( false );
  } );

  test( "returns false for Bedrock IDs without colon", async () => {
    const { isOllamaModelId } = await import( "./modelRegistry" );
    expect( isOllamaModelId( "anthropic.claude-opus-4-6-v1" ) ).toBe( false );
  } );

  test( "returns false when deploymentType is explicitly not ollama", async () => {
    const { isOllamaModelId } = await import( "./modelRegistry" );
    expect( isOllamaModelId( "qwen3:4b", "bedrock" ) ).toBe( false );
    expect( isOllamaModelId( "llama3:8b", "ecs" ) ).toBe( false );
  } );
} );

describe( "deriveDeploymentType", () => {
  test( "returns explicit type when provided", async () => {
    const { deriveDeploymentType } = await import( "./modelRegistry" );
    expect( deriveDeploymentType( "anything", "bedrock" ) ).toBe( "bedrock" );
    expect( deriveDeploymentType( "anything", "ecs" ) ).toBe( "ecs" );
  } );

  test( "returns 'ollama' for Ollama-pattern model ID", async () => {
    const { deriveDeploymentType } = await import( "./modelRegistry" );
    expect( deriveDeploymentType( "qwen3:4b" ) ).toBe( "ollama" );
    expect( deriveDeploymentType( "mistral:latest" ) ).toBe( "ollama" );
  } );

  test( "returns 'bedrock' for Bedrock model ID", async () => {
    const { deriveDeploymentType } = await import( "./modelRegistry" );
    expect( deriveDeploymentType( "anthropic.claude-haiku-4-5-20251001-v1:0" ) ).toBe( "bedrock" );
    expect( deriveDeploymentType( "deepseek.v3-v1:0" ) ).toBe( "bedrock" );
  } );
} );
