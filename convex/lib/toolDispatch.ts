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
  _modelId: string,
): Record<string, any> {
  if ( !thinkingLevel ) return {};

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
            userId: userId as any, // userId is Id<"users"> at runtime; cast for string param
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
        break;
      }

      // code, composite, sandbox — future implementations
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
