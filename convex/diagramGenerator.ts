/**
 * Architecture Diagram Generator
 * Generates visual architecture diagrams using the diagrams MCP tool
 */

import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Generate architecture diagram for an agent
 */
export const generateArchitectureDiagram = action({
  args: {
    agentName: v.string(),
    deploymentType: v.string(),
    model: v.string(),
    tools: v.array(v.object({
      name: v.string(),
      type: v.string(),
    })),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    diagramPath?: string | null;
    diagramCode?: string;
    error?: string;
  }> => {
    try {
      // Generate Python code for the diagram using diagrams package
      const diagramCode = generateDiagramCode(args);

      // Call MCP diagram generation tool
      // Note: This requires the aws-diagram MCP server to be configured
      // For now, we'll return a placeholder
      
      // TODO: Integrate with MCP diagram tool when available
      // const result = await ctx.runAction(api.mcpClient.invokeMCPTool, {
      //   serverName: "aws-diagram",
      //   toolName: "generate_diagram",
      //   parameters: {
      //     code: diagramCode,
      //     filename: `${args.agentName.toLowerCase().replace(/\s+/g, '_')}_architecture`,
      //   },
      // });

      return {
        success: true,
        diagramPath: null, // Will be populated when MCP integration is complete
        diagramCode,
      };
    } catch (error: any) {
      console.error("Failed to generate diagram:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * Generate Python code for architecture diagram
 */
function generateDiagramCode(args: {
  agentName: string;
  deploymentType: string;
  model: string;
  tools: any[];
}): string {
  const { agentName, deploymentType, model, tools } = args;
  
  // Determine if it's a Bedrock or Ollama deployment
  const isBedrockModel = model.startsWith('anthropic.') || 
                        model.startsWith('amazon.') || 
                        model.startsWith('ai21.') ||
                        model.startsWith('cohere.') ||
                        model.startsWith('meta.') ||
                        model.startsWith('mistral.');

  if (deploymentType === 'aws' || isBedrockModel) {
    return generateBedrockDiagram(agentName, model, tools);
  } else if (deploymentType === 'docker' || deploymentType === 'ollama') {
    return generateDockerDiagram(agentName, model, tools);
  } else {
    return generateLocalDiagram(agentName, model, tools);
  }
}

/**
 * Generate Bedrock AgentCore architecture diagram
 */
function generateBedrockDiagram(agentName: string, model: string, tools: any[]): string {
  const sanitizedName = agentName.replace(/[^a-zA-Z0-9]/g, '_');
  
  return `# Architecture diagram for ${agentName}
with Diagram("${agentName} - Bedrock AgentCore", filename="${sanitizedName}_architecture", show=False, direction="LR"):
    # User/Client
    user = Custom("User", "./assets/user.png")
    
    # API Gateway
    api = APIGateway("API Gateway")
    
    # Lambda for routing
    router = Lambda("Request Router")
    
    # Bedrock AgentCore
    with Cluster("Bedrock AgentCore"):
        agent = Bedrock("Agent Runtime")
        model_node = Bedrock("${model}")
        
        agent >> model_node
    
    # Tools
    with Cluster("Agent Tools"):
        ${tools.map((tool, idx) => `tool${idx} = Lambda("${tool.name}")`).join('\n        ')}
    
    # CloudWatch Logging
    logs = CloudwatchLogs("CloudWatch Logs")
    
    # S3 for artifacts
    storage = S3("Agent Artifacts")
    
    # Connections
    user >> api >> router >> agent
    ${tools.map((_, idx) => `agent >> tool${idx}`).join('\n    ')}
    agent >> logs
    agent >> storage
`;
}

/**
 * Generate Docker/Ollama architecture diagram (local deployment)
 */
function generateDockerDiagram(agentName: string, model: string, tools: any[]): string {
  const sanitizedName = agentName.replace(/[^a-zA-Z0-9]/g, '_');

  return `# Architecture diagram for ${agentName}
with Diagram("${agentName} - Local Docker Deployment", filename="${sanitizedName}_architecture", show=False, direction="LR"):
    # User/Client
    user = Custom("User", "./assets/user.png")

    # Local Docker Container
    with Cluster("Local Docker"):
        with Cluster("Agent Container"):
            agent = Custom("Agent Runtime", "./assets/docker.png")
            ollama = Custom("Ollama\\n${model}", "./assets/ollama.png")

            agent >> ollama

    # Tools
    with Cluster("Agent Tools"):
        ${tools.map((tool, idx) => `tool${idx} = Custom("${tool.name}", "./assets/tool.png")`).join('\n        ')}

    # Connections
    user >> agent
    ${tools.map((_, idx) => `agent >> tool${idx}`).join('\n    ')}
`;
}

/**
 * Generate local development architecture diagram
 */
function generateLocalDiagram(agentName: string, model: string, tools: any[]): string {
  const sanitizedName = agentName.replace(/[^a-zA-Z0-9]/g, '_');
  
  return `# Architecture diagram for ${agentName}
with Diagram("${agentName} - Local Development", filename="${sanitizedName}_architecture", show=False, direction="LR"):
    # User/Developer
    user = Custom("Developer", "./assets/user.png")
    
    # Local Agent
    with Cluster("Local Environment"):
        agent = Custom("Agent Runtime", "./assets/python.png")
        model_node = Custom("${model}", "./assets/model.png")
        
        agent >> model_node
    
    # Tools
    with Cluster("Agent Tools"):
        ${tools.map((tool, idx) => `tool${idx} = Custom("${tool.name}", "./assets/tool.png")`).join('\n        ')}
    
    # Local logs
    logs = Custom("Local Logs", "./assets/logs.png")
    
    # Connections
    user >> agent
    ${tools.map((_, idx) => `agent >> tool${idx}`).join('\n    ')}
    agent >> logs
`;
}
