/**
 * Iterative Agent Loop — Ralphy-pattern backend logic.
 *
 * Provides completion criteria checking and continuation prompt
 * generation for the iterative execution loop in strandsAgentExecution.ts.
 *
 * This module is the single source of truth for loop control constants
 * and criteria evaluation.  The action in strandsAgentExecution.ts
 * calls these helpers; it does NOT duplicate the logic.
 */

// ─── Constants ──────────────────────────────────────────────────────────────

/** Valid completion criteria types for iterative agent loops. */
export const COMPLETION_CRITERIA_TYPES = [
  "tests_pass",
  "no_errors",
  "llm_judgment",
  "max_iterations",
] as const;

export type CompletionCriteriaType = typeof COMPLETION_CRITERIA_TYPES[number];

/** Default max iterations — most tasks complete in 3-5 iterations. */
export const DEFAULT_MAX_ITERATIONS = 10;

/** Hard cap to prevent runaway loops regardless of user config. */
export const ABSOLUTE_MAX_ITERATIONS = 100;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CompletionCriteria {
  type: CompletionCriteriaType;
  /** Regex or substring pattern that indicates success (for tests_pass). */
  successPattern?: string;
  /** Regex or substring pattern that indicates errors (for no_errors). */
  errorPatterns?: string[];
}

export interface CompletionCheckResult {
  isComplete: boolean;
  reason?: string;
}

export interface IterationResult {
  iteration: number;
  content: string;
  success: boolean;
  tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number };
}

// ─── Default error patterns ────────────────────────────────────────────────

const DEFAULT_ERROR_PATTERNS = [
  "Error:",
  "error:",
  "ERROR:",
  "failed",
  "FAILED",
  "Exception:",
  "Traceback",
  "SyntaxError",
  "TypeError",
  "ReferenceError",
];

/**
 * Check whether fail indicators match independently of pass indicators.
 * Returns true if there is at least one fail match NOT contained within a pass match.
 * e.g. "0 failed" contains "failed", but that "failed" is part of "0 failed" (a pass indicator).
 */
function hasIndependentFailIndicator(
  lower: string,
  passIndicators: string[],
  failIndicators: string[],
): boolean {
  return failIndicators.some( f => {
    const idx = lower.indexOf( f );
    if ( idx === -1 ) return false;
    return !passIndicators.some( pass => {
      const passIdx = lower.indexOf( pass );
      return passIdx !== -1 && idx >= passIdx && idx < passIdx + pass.length;
    } );
  } );
}

// ─── Core Functions ─────────────────────────────────────────────────────────

/**
 * Check whether the agent's response meets the completion criteria.
 *
 * @param criteria  - The criteria to check against.
 * @param response  - The agent's last response.
 * @returns         - Whether the loop should stop.
 */
export function checkCompletionCriteria(
  criteria: CompletionCriteria,
  response: { success: boolean; content: string },
): CompletionCheckResult {
  switch ( criteria.type ) {
    case "tests_pass": {
      if ( !response.success ) {
        return { isComplete: false, reason: "Agent execution failed" };
      }
      if ( criteria.successPattern ) {
        const found = response.content.includes( criteria.successPattern );
        return found
          ? { isComplete: true, reason: `Success pattern matched: "${criteria.successPattern}"` }
          : { isComplete: false, reason: `Success pattern not found: "${criteria.successPattern}"` };
      }
      // Default: look for common test-passing indicators
      const passIndicators = ["all tests passed", "tests passed", "passing", "0 failed"];
      const failIndicators = ["failed", "failing", "error"];
      const lower = response.content.toLowerCase();
      const hasPass = passIndicators.some( p => lower.includes( p ) );
      const hasFail = failIndicators.some( p => lower.includes( p ) );
      if ( hasPass && ( !hasFail || !hasIndependentFailIndicator( lower, passIndicators, failIndicators ) ) ) {
        return { isComplete: true, reason: "Tests appear to pass" };
      }
      return { isComplete: false, reason: "Tests do not appear to pass" };
    }

    case "no_errors": {
      if ( !response.success ) {
        return { isComplete: false, reason: "Agent execution failed" };
      }
      const errorPatterns = criteria.errorPatterns || DEFAULT_ERROR_PATTERNS;
      const foundError = errorPatterns.find( p => response.content.includes( p ) );
      if ( foundError ) {
        return { isComplete: false, reason: `Error pattern found: "${foundError}"` };
      }
      return { isComplete: true, reason: "No error patterns detected" };
    }

    case "llm_judgment": {
      // LLM judgment is handled by the caller (adds a follow-up prompt asking
      // the LLM itself whether the task is done).  This function always returns
      // false so the caller proceeds to the judgment step.
      return { isComplete: false, reason: "Requires LLM judgment (deferred to caller)" };
    }

    case "max_iterations": {
      // max_iterations never completes via content — the loop counter handles it.
      return { isComplete: false, reason: "Completion determined by iteration count" };
    }

    default:
      return { isComplete: false, reason: `Unknown criteria type: ${(criteria as any).type}` };
  }
}

/**
 * Build a continuation prompt for the next iteration of the loop.
 * Includes the original task, previous output, and iteration counter.
 */
export function buildContinuationPrompt(
  originalMessage: string,
  previousOutput: string,
  currentIteration: number,
  maxIterations: number,
): string {
  return `You are on iteration ${currentIteration} of ${maxIterations} for this task.

ORIGINAL TASK:
${originalMessage}

PREVIOUS ITERATION OUTPUT:
${previousOutput}

Please review the previous output and continue working toward completing the task. If the task is complete, clearly state "TASK COMPLETE" and summarize what was accomplished. If not, continue implementing the next steps.`;
}
