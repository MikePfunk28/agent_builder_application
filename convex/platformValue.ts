/**
 * Platform Value Calculator
 * Shows users what they get for free vs building themselves
 */

import { query } from "./_generated/server";
import { v } from "convex/values";

export const calculatePlatformValue = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) return null;

    const toolCount = agent.tools?.length || 0;
    const mcpCount = 11; // Built-in MCP servers

    return {
      // What user gets for FREE
      included: {
        infrastructure: {
          value: 2000,
          items: ["VPC setup", "ECS Fargate config", "ALB", "Security groups", "IAM roles"]
        },
        memory: {
          value: 1500,
          items: ["STM/LTM hybrid", "DynamoDB indexing", "S3 storage", "Auto-routing"]
        },
        tools: {
          value: toolCount * 100,
          items: [`${toolCount} pre-integrated tools`, "No setup required", "Tested & working"]
        },
        mcp: {
          value: mcpCount * 200,
          items: [`${mcpCount} MCP servers`, "Pre-configured", "AgentCore integration"]
        },
        ui: {
          value: 3000,
          items: ["Three chat system", "Agent builder UI", "Test interface", "Monitoring panel"]
        },
        monitoring: {
          value: 1000,
          items: ["CloudWatch logs", "X-Ray tracing", "OTEL instrumentation", "Audit logs"]
        },
        deployment: {
          value: 1500,
          items: ["One-click deploy", "Docker automation", "ECR management", "Zero DevOps"]
        }
      },
      totalValue: 2000 + 1500 + (toolCount * 100) + (mcpCount * 200) + 3000 + 1000 + 1500,
      timeToReplicateHours: 120, // 3 weeks of work
      message: "All included in your tier - no additional cost"
    };
  }
});
