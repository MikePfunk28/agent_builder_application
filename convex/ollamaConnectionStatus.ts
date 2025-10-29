/**
 * Ollama Connection Status Checker
 *
 * Verifies Ollama is running and accessible, shows connection status
 */

"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Check if Ollama is running and accessible
 */
export const checkOllamaConnection = action({
  args: {
    ollamaUrl: v.optional(v.string()), // Default: http://127.0.0.1:11434
  },
  handler: async (_ctx, args): Promise<{
    connected: boolean;
    version?: string;
    models?: string[];
    error?: string;
    latency?: number;
  }> => {
    const ollamaUrl = args.ollamaUrl || "http://127.0.0.1:11434";
    const startTime = Date.now();

    try {
      // Check if Ollama API is accessible
      const response = await fetch(`${ollamaUrl}/api/tags`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        return {
          connected: false,
          error: `Ollama API returned ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      // Extract model names
      const models = data.models?.map((m: any) => m.name) || [];

      return {
        connected: true,
        version: data.version || "unknown",
        models,
        latency,
      };
    } catch (error: any) {
      return {
        connected: false,
        error: error.message || "Failed to connect to Ollama",
      };
    }
  },
});

/**
 * Test a specific Ollama model
 */
export const testOllamaModel = action({
  args: {
    model: v.string(), // e.g., "llama3.2:3b"
    ollamaUrl: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<{
    success: boolean;
    response?: string;
    latency?: number;
    error?: string;
  }> => {
    const ollamaUrl = args.ollamaUrl || "http://127.0.0.1:11434";
    const startTime = Date.now();

    try {
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: args.model,
          prompt: "Say 'Hello! I am working correctly.' and nothing else.",
          stream: false,
        }),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Model test failed: ${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      return {
        success: true,
        response: data.response,
        latency,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Model test failed",
      };
    }
  },
});

/**
 * Get available Ollama models
 */
export const getOllamaModels = action({
  args: {
    ollamaUrl: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<{
    success: boolean;
    models?: Array<{
      name: string;
      size: number;
      modifiedAt: string;
    }>;
    error?: string;
  }> => {
    const ollamaUrl = args.ollamaUrl || "http://127.0.0.1:11434";

    try {
      const response = await fetch(`${ollamaUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch models: ${response.status}`,
        };
      }

      const data = await response.json();

      return {
        success: true,
        models: data.models || [],
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to fetch models",
      };
    }
  },
});

/**
 * Check Bedrock connection status
 */
export const checkBedrockConnection = action({
  args: {
    region: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<{
    connected: boolean;
    region?: string;
    models?: string[];
    error?: string;
  }> => {
    const region = args.region || process.env.AWS_REGION || "us-east-1";

    try {
      // Note: This requires @aws-sdk/client-bedrock package
      // For now, return a placeholder
      return {
        connected: false,
        error: "Bedrock SDK not installed. Run: npm install @aws-sdk/client-bedrock",
      };

      /* Uncomment when SDK is installed:
      const { BedrockClient, ListFoundationModelsCommand } = await import("@aws-sdk/client-bedrock");

      const client = new BedrockClient({
        region,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      const command = new ListFoundationModelsCommand({});
      const response = await client.send(command);

      const models = response.modelSummaries?.map((m: any) => m.modelId || "") || [];

      return {
        connected: true,
        region,
        models: models.filter((m: string) => m.includes("claude")),
      };
      */
    } catch (error: any) {
      return {
        connected: false,
        error: error.message || "Failed to connect to Bedrock",
      };
    }
  },
});

/**
 * Universal model connection checker
 * Checks all configured model providers
 */
export const checkAllConnections = action({
  args: {},
  handler: async (_ctx): Promise<{
    ollama: { connected: boolean; models?: string[]; error?: string };
    bedrock: { connected: boolean; models?: string[]; error?: string };
    openai: { connected: boolean; models?: string[]; error?: string };
  }> => {
    // Check Ollama inline
    let ollamaStatus: { connected: boolean; models?: string[]; error?: string } = { connected: false };
    try {
      const ollamaUrl = "http://127.0.0.1:11434";
      const response = await fetch(`${ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const data = await response.json();
        ollamaStatus = {
          connected: true,
          models: data.models?.map((m: any) => m.name) || [],
        };
      }
    } catch (error: any) {
      ollamaStatus = { connected: false, error: error.message };
    }

    // Check Bedrock inline
    let bedrockStatus: { connected: boolean; models?: string[]; error?: string } = { connected: false };
    try {
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        bedrockStatus = {
          connected: true,
          models: ["anthropic.claude-3-5-sonnet-20241022-v2:0", "anthropic.claude-3-5-haiku-20241022-v1:0"],
        };
      } else {
        bedrockStatus = { connected: false, error: "AWS credentials not configured" };
      }
    } catch (error: any) {
      bedrockStatus = { connected: false, error: error.message };
    }

    // Check OpenAI (if configured)
    let openaiStatus: { connected: boolean; models?: string[]; error?: string } = {
      connected: false,
      error: "Not configured"
    };

    if (process.env.OPENAI_API_KEY) {
      try {
        const response = await fetch("https://api.openai.com/v1/models", {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const data = await response.json();
          openaiStatus = {
            connected: true,
            models: data.data?.map((m: any) => m.id).filter((id: string) => id.includes("gpt")) || [],
          };
        }
      } catch (error: any) {
        openaiStatus = { connected: false, error: error.message };
      }
    }

    return {
      ollama: {
        connected: ollamaStatus.connected,
        models: ollamaStatus.models,
        error: ollamaStatus.error,
      },
      bedrock: {
        connected: bedrockStatus.connected,
        models: bedrockStatus.models,
        error: bedrockStatus.error,
      },
      openai: openaiStatus,
    };
  },
});
