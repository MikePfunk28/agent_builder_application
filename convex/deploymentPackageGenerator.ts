/**
 * Deployment Package Generator
 * Generates all 4 required files for agent deployment per LINGERING_ISSUES.md
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isAWSDeployment, isContainerDeployment } from "./constants";
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

/**
 * Generate complete deployment package with all 4 required files:
 * 1. agent.py - Complete agent implementation
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
    const deploymentTarget = options.deploymentTarget || agent.deploymentType;

    // Generate core files
    const files: Record<string, string> = {
      'agent.py': agent.generatedCode,
      'Dockerfile': generateDockerfile(agent),
      'mcp.json': generateMCPConfig(agent.mcpServers || []),
    };

    // Add requirements.txt OR pyproject.toml
    if (options.usePyprojectToml) {
      files['pyproject.toml'] = generatePyprojectToml(agent.tools, agent.deploymentType, agent.name);
    } else {
      files['requirements.txt'] = generateRequirementsTxt(agent.tools, agent.deploymentType);
    }

    // Add deployment-specific files
    if (deploymentTarget === 'lambda' || options.includeLambdaConfig) {
      files['lambda_handler.py'] = generateLambdaHandler(agent);
      files['lambda_deploy.sh'] = generateLambdaDeployScript(agent);
    }

    // Add CloudFormation template for AWS deployments
    if (isAWSDeployment(agent.deploymentType) || options.includeCloudFormation) {
      files['cloudformation.yaml'] = generateCloudFormationTemplate(agent);
    }

    // Add CLI deploy script for container deployments
    if (isContainerDeployment(agent.deploymentType) || options.includeCLIScript) {
      files['deploy.sh'] = generateDeployScript(agent);
    }

    // Add AgentCore-specific files
    if (deploymentTarget === 'agentcore') {
      files['agentcore_config.json'] = generateAgentCoreConfig(agent);
      files['deploy_agentcore.sh'] = generateAgentCoreDeployScript(agent);
    }

    // Add README with deployment instructions
    files['README.md'] = generateDeploymentReadme(agent, deploymentTarget, options);

    return {
      files,
      agentName: agent.name,
      deploymentType: agent.deploymentType,
      deploymentTarget,
    };
  },
});
