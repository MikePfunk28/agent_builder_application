/**
 * Agent-as-Tool Generator
 *
 * Generates @tool decorated functions that wrap other agents,
 * enabling hierarchical agent architectures and coordination.
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

/**
 * Generate agent-as-tool wrapper code
 */
export const generateAgentAsTool = action({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args): Promise<{ toolName: string; toolCode: string; importStatement: string }> => {
    const agent: any = await ctx.runQuery(api.agents.get, { id: args.agentId });
    if (!agent) throw new Error("Agent not found");

    const toolName: string = agent.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    const toolCode = generateToolCode(agent.name, toolName, agent.description || "", args.agentId);

    return {
      toolName,
      toolCode,
      importStatement: `from tools.${toolName} import ${toolName}`,
    };
  },
});

/**
 * Generate tool wrapper code for an agent
 */
function generateToolCode(
  agentName: string,
  toolName: string,
  description: string,
  agentId: string
): string {
  return `"""
Agent-as-Tool: ${agentName}
Auto-generated wrapper to use ${agentName} as a tool in other agents.
"""

from strandsagents import tool
import os
import requests
from typing import Optional

@tool(
    name="${toolName}",
    description="${description || `Invoke ${agentName} agent to handle specialized tasks`}",
    parameters={
        "task": {
            "type": "string",
            "description": "The task or question to send to ${agentName}",
            "required": True
        },
        "context": {
            "type": "object",
            "description": "Optional context to pass to the agent",
            "required": False
        }
    }
)
async def ${toolName}(task: str, context: Optional[dict] = None) -> str:
    """
    Invoke ${agentName} agent as a tool.

    This allows hierarchical agent architectures where one agent
    can delegate tasks to specialized agents.

    Args:
        task: The task or question for ${agentName}
        context: Optional context dictionary

    Returns:
        str: Response from ${agentName}
    """
    try:
        # Get platform API endpoint from environment
        api_url = os.getenv("PLATFORM_API_URL", "https://api.mikepfunk.com")

        # Call platform API to execute agent
        response = requests.post(
            f"{api_url}/execute-agent",
            json={
                "agentId": "${agentId}",
                "message": task,
                "context": context or {}
            },
            headers={
                "Authorization": f"Bearer {os.getenv('PLATFORM_API_KEY')}",
                "Content-Type": "application/json"
            },
            timeout=300  # 5 minute timeout
        )

        response.raise_for_status()
        result = response.json()

        if result.get("success"):
            return result.get("content", "")
        else:
            return f"Error from ${agentName}: {result.get('error', 'Unknown error')}"

    except Exception as e:
        return f"Failed to invoke ${agentName}: {str(e)}"
`;
}

/**
 * Generate coordinator agent that uses other agents as tools
 */
export const generateCoordinatorAgent = action({
  args: {
    coordinatorName: v.string(),
    coordinatorPrompt: v.string(),
    agentIds: v.array(v.id("agents")),
    coordinationStrategy: v.union(
      v.literal("sequential"),
      v.literal("parallel"),
      v.literal("dynamic")
    ),
  },
  handler: async (ctx, args): Promise<{ coordinatorCode: string; agentTools: Array<{ name: string; agentId: string; agentName: string; description: string }> }> => {
    // Get all agents
    const agents: any[] = await Promise.all(
      args.agentIds.map((id: Id<"agents">) => ctx.runQuery(api.agents.get, { id }))
    );

    // Generate tool wrappers for each agent
    const agentTools: Array<{ name: string; agentId: string; agentName: string; description: string }> = agents.map((agent: any) => {
      if (!agent) return null;
      const toolName: string = agent.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      return {
        name: toolName,
        agentId: agent._id,
        agentName: agent.name,
        description: agent.description || `Invoke ${agent.name} agent`,
      };
    }).filter(Boolean) as Array<{ name: string; agentId: string; agentName: string; description: string }>;

    // Generate coordinator agent code
    const coordinatorCode = generateCoordinatorCode(
      args.coordinatorName,
      args.coordinatorPrompt,
      agentTools,
      args.coordinationStrategy
    );

    return {
      coordinatorCode,
      agentTools,
    };
  },
});

/**
 * Generate coordinator agent code
 */
function generateCoordinatorCode(
  name: string,
  systemPrompt: string,
  agentTools: Array<{ name: string; agentId: string; agentName: string; description: string }>,
  strategy: string
): string {
  const toolImports = agentTools.map(t => `from tools.${t.name} import ${t.name}`).join('\n');
  const toolList = agentTools.map(t => t.name).join(', ');

  return `"""
Coordinator Agent: ${name}
Coordinates multiple specialized agents to solve complex tasks.
"""

from strandsagents import agent, Agent
from bedrock_agentcore.runtime import BedrockAgentCoreApp
import asyncio
import logging

# Import agent tools
${toolImports}

logger = logging.getLogger(__name__)

@agent(
    model="anthropic.claude-sonnet-4.5-v2",
    system_prompt="""${systemPrompt}

You are a coordinator agent with access to specialized agents as tools:
${agentTools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

Coordination Strategy: ${strategy}
${strategy === 'sequential' ? '- Execute agents one after another, passing output forward' : ''}
${strategy === 'parallel' ? '- Execute multiple agents simultaneously when tasks are independent' : ''}
${strategy === 'dynamic' ? '- Decide dynamically which agents to use and in what order' : ''}

When delegating to agents:
1. Clearly define the task for each agent
2. Provide necessary context
3. Synthesize results from multiple agents
4. Return a coherent final response
""",
    tools=[${toolList}],
    memory=True,
    reasoning="interleaved"
)
class ${name.replace(/[^a-zA-Z0-9]/g, '')}Coordinator(Agent):
    """
    Coordinator agent that orchestrates multiple specialized agents.
    """

    async def coordinate_sequential(self, task: str, agents: list) -> str:
        """Execute agents sequentially, passing output forward."""
        result = task
        for agent_tool in agents:
            logger.info(f"Executing {agent_tool.__name__} with input: {result[:100]}...")
            result = await agent_tool(task=result)
        return result

    async def coordinate_parallel(self, task: str, agents: list) -> str:
        """Execute agents in parallel and aggregate results."""
        logger.info(f"Executing {len(agents)} agents in parallel...")
        results = await asyncio.gather(*[
            agent_tool(task=task) for agent_tool in agents
        ])

        # Synthesize results
        synthesis = "Results from parallel execution:\\n\\n"
        for i, result in enumerate(results):
            synthesis += f"Agent {i+1}:\\n{result}\\n\\n"

        return synthesis

# AgentCore Runtime Setup
app = BedrockAgentCoreApp()
coordinator = None

@app.entrypoint
async def agent_entrypoint(payload):
    global coordinator

    if coordinator is None:
        coordinator = ${name.replace(/[^a-zA-Z0-9]/g, '')}Coordinator()

    user_input = payload.get("prompt", "")
    return await coordinator.run(user_input)

if __name__ == "__main__":
    app.run()
`;
}

/**
 * Link agents together for coordination
 */
export const linkAgentsForCoordination = action({
  args: {
    parentAgentId: v.id("agents"),
    childAgentIds: v.array(v.id("agents")),
  },
  handler: async (ctx, args): Promise<{ success: boolean; parentAgentId: Id<"agents">; childTools: Array<{ name: string; type: string; config: { agentId: Id<"agents">; agentName: string; description: string } }> }> => {
    // Update parent agent to include child agents as tools
    const parent: any = await ctx.runQuery(api.agents.get, { id: args.parentAgentId });
    if (!parent) throw new Error("Parent agent not found");

    // Generate tool wrappers for child agents
    const childTools: Array<{ name: string; type: string; config: { agentId: Id<"agents">; agentName: string; description: string } }> = (await Promise.all(
      args.childAgentIds.map(async (childId: Id<"agents">) => {
        const child: any = await ctx.runQuery(api.agents.get, { id: childId });
        if (!child) return null;

        const toolName: string = child.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
        return {
          name: toolName,
          type: "agent_tool",
          config: {
            agentId: childId,
            agentName: child.name,
            description: child.description || `Invoke ${child.name} agent`,
          },
        };
      })
    )).filter(Boolean) as Array<{ name: string; type: string; config: { agentId: Id<"agents">; agentName: string; description: string } }>;

    return {
      success: true,
      parentAgentId: args.parentAgentId,
      childTools,
    };
  },
});
