/**
 * Shared Tool Dispatch — single source of truth for tool routing.
 *
 * Used by BOTH workflowExecutor.ts AND strandsAgentExecution.ts
 * so the same dispatch map / helpers serve the workflow engine
 * and the agent loop.
 */

import { api } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";

// ─── Constants ──────────────────────────────────────────────────────────────

/** Safety limit matching Anthropic's own server-side tool loop limit. */
export const MAX_TOOL_LOOP_ITERATIONS = 10;

/** Maximum depth for agent-dispatch-agent nesting (prevents infinite recursion). */
export const MAX_AGENT_DISPATCH_DEPTH = 3;

// ─── Helpers ────────────────────────────────────────────────────────────────

import { safeJsonParse } from "./jsonUtils";

// ─── Internal Tool Map ──────────────────────────────────────────────────────

/**
 * Maps tool names to existing tools.ts Convex actions.
 * Extracted from workflowExecutor.ts lines 619-629 (DRY).
 */
export const INTERNAL_TOOL_MAP: Record<string, any> = {
  handoff_to_user: api.tools.handoffToUser,
  short_term_memory: api.tools.shortTermMemory,
  long_term_memory: api.tools.longTermMemory,
  semantic_memory: api.tools.semanticMemory,
  self_consistency: api.tools.selfConsistency,
  tree_of_thoughts: api.tools.treeOfThoughts,
  reflexion: api.tools.reflexion,
  map_reduce: api.tools.mapReduce,
  parallel_prompts: api.tools.parallelPrompts,
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SkillDefinition {
  skillType: "code" | "internal" | "mcp" | "agent" | "composite" | "sandbox";
  name: string;
  skillConfig?: any;
  toolDefinition: {
    name: string;
    description: string;
    inputSchema: any;
  };
  skillInstructions?: string;
}

export interface ToolResult {
  toolUseId: string;
  output: string;
  isError?: boolean;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// ─── Thinking Level → API Payload ───────────────────────────────────────────

/**
 * Maps agent thinkingLevel to Anthropic API thinking configuration.
 *
 * Uses budget_tokens for all Claude models on Bedrock:
 *   low    → 1024
 *   medium → 4096
 *   high   → 16384
 *
 * Returns empty object when thinkingLevel is not set (preserves current behavior).
 */
export function mapThinkingLevelToPayload(
  thinkingLevel: "low" | "medium" | "high" | undefined,
  modelId: string,
): Record<string, any> {
  if ( !thinkingLevel ) return {};

  // Only Claude models support thinking blocks — return empty for non-Claude models
  const isClaude = modelId.includes( "anthropic" ) || modelId.includes( "claude" );
  if ( !isClaude ) return {};

  const budgetMap: Record<string, number> = {
    low: 1024,
    medium: 4096,
    high: 16384,
  };

  return {
    thinking: {
      type: "enabled",
      budget_tokens: budgetMap[thinkingLevel],
    },
  };
}

// ─── Build Anthropic tools Array ────────────────────────────────────────────

/**
 * Converts skill definitions into the Anthropic `tools` array format
 * that goes in the API request payload.
 */
export function buildToolsArray(
  skills: SkillDefinition[],
): Array<{ name: string; description: string; input_schema: any }> {
  return skills.map( ( skill ) => ( {
    name: skill.toolDefinition.name,
    description: skill.toolDefinition.description,
    input_schema: skill.toolDefinition.inputSchema,
  } ) );
}

// ─── Build Tool Result Messages ─────────────────────────────────────────────

/**
 * After executing tool calls, builds the messages to feed back into the model:
 *   1. An assistant message echoing the original content (including tool_use blocks)
 *   2. A user message containing tool_result blocks for each executed tool
 *
 * This follows the Anthropic tool_use protocol:
 *   assistant: [text, tool_use] → user: [tool_result] → assistant: [text]
 */
export function buildToolResultMessages(
  assistantContent: Array<{ type: string;[key: string]: any }>,
  toolResults: ToolResult[],
): Array<{ role: string; content: any }> {
  return [
    {
      role: "assistant",
      content: assistantContent,
    },
    {
      role: "user",
      content: toolResults.map( ( result ) => ( {
        type: "tool_result",
        tool_use_id: result.toolUseId,
        content: result.output,
        is_error: result.isError || false,
      } ) ),
    },
  ];
}

// ─── Dispatch a Single Tool Call ────────────────────────────────────────────

/**
 * Routes a tool call to the correct backend:
 *   1. INTERNAL_TOOL_MAP → existing tools.ts actions
 *   2. Skills array → MCP / agent / sandbox routing
 *   3. Fallback → api.tools.executeStrandsTool
 */
export async function dispatchToolCall(
  ctx: ActionCtx,
  toolName: string,
  input: Record<string, any>,
  skills: SkillDefinition[],
  userId: string,
  depth: number = 0,
): Promise<{ success: boolean; output: any; error?: string }> {
  // Priority 1: Internal tool map (tools.ts actions)
  const internalAction = INTERNAL_TOOL_MAP[toolName]
    || INTERNAL_TOOL_MAP[toolName.toLowerCase().replace( / /g, "_" )];

  if ( internalAction ) {
    try {
      const result = await ctx.runAction( internalAction, input );
      return { success: true, output: typeof result === "string" ? result : JSON.stringify( result ) };
    } catch ( error: any ) {
      return { success: false, output: "", error: error.message };
    }
  }

  // Priority 2: Skill-specific routing
  const skill = skills.find( ( s ) => s.toolDefinition.name === toolName );
  if ( skill ) {
    switch ( skill.skillType ) {
      case "mcp": {
        const config = skill.skillConfig as { serverName: string; toolName: string };
        try {
          const result = await ctx.runAction( api.mcpClient.invokeMCPTool, {
            serverName: config.serverName,
            toolName: config.toolName,
            userId: userId as any, // string → Id<"users">: dispatchToolCall receives serialized Id
            parameters: input,
          } );
          return {
            success: result.success,
            output: result.success
              ? JSON.stringify( result.result )
              : ( result.error || "MCP tool failed" ),
            error: result.success ? undefined : result.error,
          };
        } catch ( error: any ) {
          return { success: false, output: "", error: error.message };
        }
      }

      case "agent": {
        if ( depth >= MAX_AGENT_DISPATCH_DEPTH ) {
          return { success: false, output: "", error: `Agent dispatch depth limit (${MAX_AGENT_DISPATCH_DEPTH}) exceeded — possible infinite recursion` };
        }
        const config = skill.skillConfig as { agentId: string };
        try {
          const result = await ctx.runAction( api.strandsAgentExecution.executeAgentWithStrandsAgents, {
            agentId: config.agentId as any,
            message: JSON.stringify( input ),
          } );
          return {
            success: result.success,
            output: result.success ? ( result.content || "" ) : ( result.error || "Agent failed" ),
            error: result.success ? undefined : result.error,
          };
        } catch ( error: any ) {
          return { success: false, output: "", error: error.message };
        }
      }

      case "internal": {
        // Check if skillConfig points to a known action
        const actionName = ( skill.skillConfig as { actionName?: string } )?.actionName;
        const action = actionName
          ? ( INTERNAL_TOOL_MAP[actionName] || INTERNAL_TOOL_MAP[actionName.toLowerCase().replace( / /g, "_" )] )
          : undefined;
        if ( action ) {
          try {
            const result = await ctx.runAction( action, input );
            return { success: true, output: typeof result === "string" ? result : JSON.stringify( result ) };
          } catch ( error: any ) {
            return { success: false, output: "", error: error.message };
          }
        }
        return { success: false, output: "", error: `Internal skill "${toolName}" has no matching action for "${actionName}"` };
      }

      case "code": {
        // Code skills provide their implementation as tool output.
        // The code is stored in skillConfig and returned for the agent to use/incorporate.
        // Full execution requires a testExecution record (use the Agent Tester for that).
        const codeConfig = skill.skillConfig as { code?: string; language?: string };
        const code = codeConfig?.code || "";
        if ( !code ) {
          return { success: false, output: "", error: "Code skill has no code to execute" };
        }
        const language = codeConfig?.language || "python";
        return {
          success: true,
          output: JSON.stringify( {
            code,
            language,
            toolName,
            inputProvided: input,
            note: "Code skill output — use Agent Tester for containerized execution",
          } ),
        };
      }

      case "composite": {
        // Sequential execution: run each step's skill in order, mapping outputs
        const compositeConfig = skill.skillConfig as {
          steps?: Array<{ skillName: string; inputMapping?: Record<string, string> }>;
        };
        const steps = compositeConfig?.steps || [];
        if ( steps.length === 0 ) {
          return { success: false, output: "", error: "Composite skill has no steps" };
        }
        let stepInput = input;
        let lastOutput = "";
        for ( const step of steps ) {
          const stepSkill = skills.find( s => ( s.toolDefinition?.name ?? s.name ) === step.skillName );
          if ( !stepSkill ) {
            return { success: false, output: lastOutput, error: `Composite step skill "${step.skillName}" not found` };
          }
          // Map outputs from previous step to inputs for this step
          if ( step.inputMapping && lastOutput ) {
            const parsed = safeJsonParse( lastOutput );
            if ( parsed ) {
              const mapped: Record<string, unknown> = { ...stepInput };
              for ( const [targetKey, sourceKey] of Object.entries( step.inputMapping ) ) {
                mapped[targetKey] = ( parsed as Record<string, unknown> )[sourceKey];
              }
              stepInput = mapped;
            }
          }
          // Recursive dispatch to the step's skill
          const stepResult = await dispatchToolCall( ctx, step.skillName, stepInput, skills, userId, depth + 1 );
          if ( !stepResult.success ) {
            return { success: false, output: lastOutput, error: `Composite step "${step.skillName}" failed: ${stepResult.error}` };
          }
          lastOutput = stepResult.output;
          stepInput = safeJsonParse( lastOutput ) ?? { input: lastOutput };
        }
        return { success: true, output: lastOutput };
      }

      case "sandbox": {
        // Sandbox execution: Docker container or E2B (future placeholder)
        const sandboxConfig = skill.skillConfig as {
          runtime?: "docker" | "e2b";
          command?: string;
          timeout?: number;
        };
        const runtime = sandboxConfig?.runtime || "docker";
        if ( runtime === "e2b" ) {
          return { success: false, output: "", error: "E2B sandbox runtime is not yet supported. Use Docker runtime." };
        }
        // Docker runtime: return sandbox execution spec for the agent to incorporate.
        // Full containerized execution requires the Agent Tester flow (AgentCore).
        const command = sandboxConfig?.command || "";
        if ( !command ) {
          return { success: false, output: "", error: "Sandbox skill has no command to execute" };
        }
        return {
          success: true,
          output: JSON.stringify( {
            runtime,
            command,
            timeout: sandboxConfig?.timeout || 60000,
            toolName,
            inputProvided: input,
            note: "Sandbox spec — containerized execution via Agent Tester (AgentCore)",
          } ),
        };
      }

      default:
        break;
    }
  }

  // Priority 3: Fallback to catch-all Strands tool executor
  try {
    const result = await ctx.runAction( api.tools.executeStrandsTool, {
      toolName,
      params: input,
      context: {},
    } );
    return { success: true, output: typeof result === "string" ? result : JSON.stringify( result ) };
  } catch ( error: any ) {
    return { success: false, output: "", error: error.message };
  }
}

// ─── Token Accumulation ─────────────────────────────────────────────────────

/**
 * Accumulates token usage from a loop iteration into a running total.
 * Mutates the `accumulated` object in place.
 */
export function accumulateTokenUsage(
  accumulated: TokenUsage,
  iterationUsage: TokenUsage | undefined,
): void {
  if ( !iterationUsage ) return;
  accumulated.inputTokens += iterationUsage.inputTokens;
  accumulated.outputTokens += iterationUsage.outputTokens;
  accumulated.totalTokens += iterationUsage.totalTokens;
}
