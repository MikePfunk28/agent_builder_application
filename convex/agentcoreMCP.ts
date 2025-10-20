/**
 * Bedrock AgentCore MCP Server Configuration
 * Provides MCP tools for AgentCore sandbox management
 */

import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Register AgentCore MCP server
 * This is a built-in MCP server for Bedrock AgentCore integration
 */
export const registerAgentCoreMCP = action({
  args: {},
  handler: async (ctx) => {
    // AgentCore MCP server configuration
    return {
      name: "bedrock-agentcore",
      command: "npx",
      args: ["-y", "@aws/bedrock-agentcore-mcp-server"],
      env: {
        AWS_REGION: process.env.AWS_REGION || "us-east-1",
      },
      tools: [
        {
          name: "execute_agent",
          description: "Execute agent code in AgentCore sandbox",
          inputSchema: {
            type: "object",
            properties: {
              code: { type: "string", description: "Agent Python code" },
              input: { type: "string", description: "User input" },
              model_id: { type: "string", description: "Bedrock model ID" },
              system_prompt: { type: "string", description: "System prompt" },
              conversation_history: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    role: { type: "string" },
                    content: { type: "string" },
                  },
                },
              },
            },
            required: ["code", "input", "model_id"],
          },
        },
      ],
    };
  },
});
