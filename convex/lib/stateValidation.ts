/**
 * Test Execution State Machine Validator
 *
 * Enforces valid state transitions for testExecutions to maintain data integrity
 */

export type TestStatus =
  | "CREATED"
  | "QUEUED"
  | "BUILDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "ABANDONED"
  | "ARCHIVED";

/**
 * Valid state transitions
 */
const VALID_TRANSITIONS: Record<TestStatus, TestStatus[]> = {
  CREATED: ["QUEUED"],
  QUEUED: ["BUILDING", "ABANDONED"],
  BUILDING: ["RUNNING", "FAILED"],
  RUNNING: ["COMPLETED", "FAILED"],
  COMPLETED: ["ARCHIVED"],
  FAILED: ["ARCHIVED"],
  ABANDONED: ["QUEUED", "ARCHIVED"], // Can retry if attempts < 3
  ARCHIVED: [], // Terminal state
};

/**
 * Validate if a state transition is allowed
 */
export function isValidTransition(
  currentStatus: TestStatus,
  newStatus: TestStatus
): boolean {
  const allowedTransitions = VALID_TRANSITIONS[currentStatus];
  return allowedTransitions.includes(newStatus);
}

/**
 * Enforce state transition (throws error if invalid)
 */
export function enforceTransition(
  currentStatus: TestStatus,
  newStatus: TestStatus
): void {
  if (!isValidTransition(currentStatus, newStatus)) {
    throw new Error(
      `Invalid state transition: ${currentStatus} → ${newStatus}. ` +
      `Allowed transitions from ${currentStatus}: ${VALID_TRANSITIONS[currentStatus].join(", ")}`
    );
  }
}

/**
 * Get allowed next states for current status
 */
export function getAllowedTransitions(currentStatus: TestStatus): TestStatus[] {
  return VALID_TRANSITIONS[currentStatus];
}

/**
 * Check if a status is terminal (no further transitions possible)
 */
export function isTerminalStatus(status: TestStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0;
}

/**
 * Check if a status indicates test is in progress
 */
export function isInProgress(status: TestStatus): boolean {
  return ["QUEUED", "BUILDING", "RUNNING"].includes(status);
}

/**
 * Check if a status indicates test is complete (success or failure)
 */
export function isComplete(status: TestStatus): boolean {
  return ["COMPLETED", "FAILED", "ABANDONED", "ARCHIVED"].includes(status);
}

/**
 * Get phase from status
 */
export function getPhaseFromStatus(status: TestStatus): string {
  switch (status) {
    case "CREATED":
    case "QUEUED":
      return "queued";
    case "BUILDING":
      return "building";
    case "RUNNING":
      return "running";
    case "COMPLETED":
    case "FAILED":
    case "ABANDONED":
    case "ARCHIVED":
      return "completed";
    default:
      return "unknown";
  }
}

/**
 * Validate test query input
 */
export function validateTestQuery(query: string): void {
  if (!query || query.trim().length === 0) {
    throw new Error("Test query cannot be empty");
  }
  if (query.length > 2000) {
    throw new Error("Test query must be 2000 characters or less");
  }
  if (query.includes("\0")) {
    throw new Error("Test query cannot contain null bytes");
  }
}

/**
 * Validate timeout value
 */
export function validateTimeout(timeout: number): void {
  if (timeout < 10000) {
    throw new Error("Timeout must be at least 10 seconds (10000ms)");
  }
  if (timeout > 600000) {
    throw new Error("Timeout cannot exceed 10 minutes (600000ms)");
  }
}

/**
 * Validate priority value
 */
export function validatePriority(priority: number): void {
  if (![1, 2, 3].includes(priority)) {
    throw new Error("Priority must be 1 (high), 2 (normal), or 3 (low)");
  }
}

/**
 * Validate model provider
 */
export function validateModelProvider(provider: string): void {
  if (!["ollama", "bedrock"].includes(provider)) {
    throw new Error("Model provider must be 'ollama' or 'bedrock'");
  }
}
