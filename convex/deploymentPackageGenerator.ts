/**
 * Deployment Package Generator
 * Generates all 4 required files for agent deployment per LINGERING_ISSUES.md
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isAWSDeployment, isContainerDeployment, sanitizePythonModuleName } from "./constants";
import {
  generateRequirementsTxt,
  generateDockerfile,
  generateMCPConfig,
  generateDeployScript,
  generatePyprojectToml,
  generateLambdaHandler,
  generateLambdaDeployScript,
  generateAgentCoreConfig,
  generateAgentCoreDeployScript,
  generateDeploymentReadme,
} from "./lib/fileGenerators";
import { generateCloudFormationTemplate } from "./lib/cloudFormationGenerator";

interface AWSResource {
  type: string;
  name: string;
  id?: string;
  properties?: Record<string, any>;
}

/**
 * Build AWS resource list from agent configuration
 * Used for diagram generation before deployment
 */
function buildResourceListFromAgent(agent: any): AWSResource[] {
  const resources: AWSResource[] = [];
  const deploymentType = agent.deploymentType || "docker";
  const model = agent.model || "";
  const region = agent.region || "us-east-1";

  // Determine if it's a Bedrock model
  const isBedrockModel = model.startsWith('anthropic.') ||
                        model.startsWith('amazon.') ||
                        model.startsWith('ai21.') ||
                        model.startsWith('cohere.') ||
                        model.startsWith('meta.') ||
                        model.startsWith('mistral.');

  if (deploymentType === 'aws' || isBedrockModel) {
    // Bedrock AgentCore deployment
    resources.push({
      type: "bedrock-agentcore",
      name: agent.name || "Agent",
      properties: {
        model,
        region,
      },
    });

    resources.push({
      type: "lambda",
      name: `${agent.name}-invoker`,
      properties: {
        runtime: "python3.11",
        region,
      },
    });
  } else {
    // Docker/Container deployment (Fargate)
    resources.push({
      type: "vpc",
      name: `${agent.name}-vpc`,
      properties: {
        cidr: "10.0.0.0/16",
        region,
      },
    });

    resources.push({
      type: "subnet",
      name: `${agent.name}-subnet-1`,
      properties: {
        cidr: "10.0.1.0/24",
        availabilityZone: `${region}a`,
      },
    });

    resources.push({
      type: "ecr",
      name: `${agent.name}-repository`,
      properties: {
        region,
      },
    });

    resources.push({
      type: "ecs-cluster",
      name: `${agent.name}-cluster`,
      properties: {
        region,
      },
    });

    resources.push({
      type: "ecs-fargate",
      name: `${agent.name}-service`,
      properties: {
        cpu: "256",
        memory: "512",
        region,
      },
    });

    resources.push({
      type: "cloudwatch-logs",
      name: `/ecs/${agent.name}`,
      properties: {
        retentionDays: 7,
        region,
      },
    });
  }

  return resources;
}

export type DeploymentPackageOptions = {
  includeCloudFormation?: boolean;
  includeCLIScript?: boolean;
  includeLambdaConfig?: boolean;
  usePyprojectToml?: boolean;
  deploymentTarget?: string;
};

export function assembleDeploymentPackageFiles(agent: any, options: DeploymentPackageOptions = {}) {
  const deploymentTarget = options.deploymentTarget || agent.deploymentType || "docker";
  const pythonModuleName = sanitizePythonModuleName(agent.name || "agent");
  const pythonFileName = `${pythonModuleName}.py`;

  const files: Record<string, string> = {
    "agent.py": agent.generatedCode,
    Dockerfile: generateDockerfile(agent),
    "mcp.json": generateMCPConfig(agent.mcpServers || []),
  };

  if (pythonFileName !== "agent.py") {
    files[pythonFileName] = agent.generatedCode;
  }

  if (options.usePyprojectToml) {
    files["pyproject.toml"] = generatePyprojectToml(agent.tools, agent.deploymentType, agent.name);
  } else {
    files["requirements.txt"] = generateRequirementsTxt(agent.tools, agent.deploymentType);
  }

  if (deploymentTarget === "lambda" || options.includeLambdaConfig) {
    files["lambda_handler.py"] = generateLambdaHandler(agent);
    files["lambda_deploy.sh"] = generateLambdaDeployScript(agent);
  }

  if (isAWSDeployment(agent.deploymentType) || options.includeCloudFormation) {
    files["cloudformation.yaml"] = generateCloudFormationTemplate(agent);
  }

  if (isContainerDeployment(agent.deploymentType) || options.includeCLIScript) {
    files["deploy.sh"] = generateDeployScript(agent);
  }

  if (deploymentTarget === "agentcore") {
    files["agentcore_config.json"] = generateAgentCoreConfig(agent);
    files["deploy_agentcore.sh"] = generateAgentCoreDeployScript(agent);
  }

  return { files, deploymentTarget, pythonFileName };
}

/**
 * Generate complete deployment package with all 4 required files:
 * 1. agent.py / <agent_name>.py - Complete agent implementation
 * 2. requirements.txt - Python dependencies
 * 3. Dockerfile - Container image definition
 * 4. mcp.json OR cloudformation.yaml - Infrastructure/MCP config
 */
export const generateDeploymentPackage = action({
  args: {
    agentId: v.id("agents"),
    options: v.optional(v.object({
      includeCloudFormation: v.optional(v.boolean()),
      includeCLIScript: v.optional(v.boolean()),
      includeLambdaConfig: v.optional(v.boolean()),
      usePyprojectToml: v.optional(v.boolean()),
      deploymentTarget: v.optional(v.string()), // "fargate" | "lambda" | "agentcore"
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get agent
    const agent: any = await ctx.runQuery(api.agents.get, {
      id: args.agentId,
    });

    if (!agent) {
      throw new Error("Agent not found");
    }

    // Verify ownership
    if (agent.createdBy !== userId) {
      throw new Error("Not authorized to generate deployment package for this agent");
    }

    const options = args.options || {};
    const { files, deploymentTarget, pythonFileName } = assembleDeploymentPackageFiles(agent, options);

    files["README.md"] = generateDeploymentReadme(agent, deploymentTarget, {
      ...options,
      pythonFileName,
    });

    // Generate architecture diagram using MCP aws-diagram tool
    try {
      const resources = buildResourceListFromAgent(agent);
      const diagramResult = await ctx.runAction(api.mcpClient.invokeMCPTool, {
        serverName: "aws-diagram",
        toolName: "generate_architecture_diagram",
        parameters: {
          resources,
          format: "png",
          title: `${agent.name || 'Agent'} Architecture`,
          region: agent.region || "us-east-1",
        },
      });

      if (diagramResult.success) {
        // Extract PNG content from result
        // MCP returns images in content[0].data as base64
        const result = (diagramResult as any).result;
        const diagramContent = result?.data || result?.diagram || result || "";
        if (diagramContent && typeof diagramContent === 'string') {
          // Store base64-encoded PNG
          files["architecture_diagram.png"] = diagramContent;
        }
      }
    } catch (error) {
      // Diagram generation is optional - log error but continue
      console.warn("Failed to generate architecture diagram:", error);
    }

    return {
      files,
      agentName: agent.name,
      deploymentType: agent.deploymentType,
      deploymentTarget,
    };
  },
});

/**
 * Generate deployment package without saving agent
 * Allows users to download immediately after generating code
 */
export const generateDeploymentPackageWithoutSaving = action({
  args: {
    agent: v.any(),
    options: v.optional(v.object({
      includeCloudFormation: v.optional(v.boolean()),
      includeCLIScript: v.optional(v.boolean()),
      includeLambdaConfig: v.optional(v.boolean()),
      usePyprojectToml: v.optional(v.boolean()),
      deploymentTarget: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const agent = args.agent;
    const options = args.options || {};
    const { files, deploymentTarget, pythonFileName } = assembleDeploymentPackageFiles(agent, options);

    files["README.md"] = generateDeploymentReadme(agent, deploymentTarget, {
      ...options,
      pythonFileName,
    });

    // Generate architecture diagram using MCP aws-diagram tool
    try {
      const resources = buildResourceListFromAgent(agent);
      const diagramResult = await ctx.runAction(api.mcpClient.invokeMCPTool, {
        serverName: "aws-diagram",
        toolName: "generate_architecture_diagram",
        parameters: {
          resources,
          format: "png",
          title: `${agent.name || 'Agent'} Architecture`,
          region: agent.region || "us-east-1",
        },
      });

      if (diagramResult.success) {
        // Extract PNG content from result
        // MCP returns images in content[0].data as base64
        const result = (diagramResult as any).result;
        const diagramContent = result?.data || result?.diagram || result || "";
        if (diagramContent && typeof diagramContent === 'string') {
          // Store base64-encoded PNG
          files["architecture_diagram.png"] = diagramContent;
        }
      }
    } catch (error) {
      // Diagram generation is optional - log error but continue
      console.warn("Failed to generate architecture diagram:", error);
    }

    return {
      files,
      agentName: agent.name,
      deploymentType: agent.deploymentType,
      deploymentTarget,
    };
  },
});
