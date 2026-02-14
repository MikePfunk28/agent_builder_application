/**
 * Shared JSON Utilities
 * Canonical implementations — import from here, do not redefine.
 */

/**
 * Safely parse a JSON string without throwing.
 * Returns the parsed value on success, or null on failure.
 * Use this for any untrusted/external JSON (memory store, tool results, API responses).
 */
export function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
