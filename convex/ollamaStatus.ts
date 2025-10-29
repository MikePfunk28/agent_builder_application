/**
 * Ollama Status Checker
 * Detects if Ollama is running and available for testing
 */

import { action } from "./_generated/server";

/**
 * Check if Ollama is running and accessible
 */
export const checkOllamaStatus = action({
  args: {},
  handler: async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

      const response = await fetch("http://127.0.0.1:11434/api/tags", {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          running: false,
          available: false,
          error: `Ollama responded with status: ${response.status}`,
          endpoint: "http://127.0.0.1:11434",
        };
      }

      const data = await response.json();

      return {
        running: true,
        available: true,
        models: data.models || [],
        modelCount: data.models?.length || 0,
        endpoint: "http://127.0.0.1:11434",
      };
    } catch (error: any) {
      return {
        running: false,
        available: false,
        error: error.message || "Ollama not accessible",
        endpoint: "http://127.0.0.1:11434",
        instructions: [
          "1. Install Ollama from https://ollama.com",
          "2. Run: ollama serve",
          "3. Verify: curl http://127.0.0.1:11434/api/tags",
        ],
      };
    }
  },
});

/**
 * Get available Ollama models (only if running)
 */
export const listAvailableModels = action({
  args: {},
  handler: async () => {
    try {
      const response = await fetch("http://127.0.0.1:11434/api/tags", {
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        return { success: false, models: [], error: "Ollama not responding" };
      }

      const data = await response.json();

      return {
        success: true,
        models: data.models.map((m: any) => ({
          name: m.name,
          size: m.size,
          modified: m.modified_at,
        })),
      };
    } catch (error) {
      return {
        success: false,
        models: [],
        error: "Ollama not running. Start with: ollama serve",
      };
    }
  },
});
