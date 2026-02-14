/**
 * Agent Validation Module
 * Validates agent configurations before creation/update
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isValidExtrasPip, validateToolConfig } from "./types/tools";
import { DEPLOYMENT_TYPES, VALID_EXTRAS_PIP } from "./constants";

/**
 * Validate agent configuration before creation
 */
export const validateAgentConfig = mutation({
  args: {
    name: v.string(),
    model: v.string(),
    systemPrompt: v.string(),
    tools: v.array(v.object({
      name: v.string(),
      type: v.string(),
      config: v.optional(v.any()), // v.any(): tool config shape varies per tool type
      requiresPip: v.optional(v.boolean()),
      pipPackages: v.optional(v.array(v.string())),
      extrasPip: v.optional(v.string()),
      notSupportedOn: v.optional(v.array(v.string())),
    })),
    deploymentType: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const errors: string[] = [];

    // Validate name
    if (!args.name || args.name.trim().length === 0) {
      errors.push("Agent name is required");
    }

    if (args.name.length > 100) {
      errors.push("Agent name must be less than 100 characters");
    }

    // Validate model
    if (!args.model || args.model.trim().length === 0) {
      errors.push("Model is required");
    }

    // Validate system prompt
    if (!args.systemPrompt || args.systemPrompt.trim().length === 0) {
      errors.push("System prompt is required");
    }

    // Validate deployment type
    const validDeploymentTypes = Object.values(DEPLOYMENT_TYPES) as string[];
    if (!validDeploymentTypes.includes(args.deploymentType)) {
      errors.push(`Invalid deployment type. Must be one of: ${validDeploymentTypes.join(", ")}`);
    }

    // Validate tools
    if (!Array.isArray(args.tools)) {
      errors.push("Tools must be an array");
    } else {
      const toolErrors = validateTools(args.tools, validDeploymentTypes);
      errors.push(...toolErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
});

/**
 * Validate tools array and return errors
 */
function validateTools(tools: any[], validDeploymentTypes: string[]): string[] {
  const errors: string[] = [];

  tools.forEach((tool, index) => {
    const toolName = tool.name || `Tool at index ${index}`;

    // Validate tool structure
    if (!validateToolConfig(tool)) {
      errors.push(`${toolName} has invalid configuration`);
    }

    // Validate extrasPip values
    if (tool.extrasPip && !isValidExtrasPip(tool.extrasPip)) {
      errors.push(
        `${toolName} has invalid extrasPip value: "${tool.extrasPip}". ` +
        `Must be one of: ${VALID_EXTRAS_PIP.join(", ")}`
      );
    }

    // Validate pipPackages format
    if (tool.pipPackages && Array.isArray(tool.pipPackages)) {
      tool.pipPackages.forEach((pkg: string) => {
        if (typeof pkg !== 'string' || pkg.trim().length === 0) {
          errors.push(`${toolName} has invalid pip package: "${pkg}"`);
        }
      });
    }

    // Validate notSupportedOn
    if (tool.notSupportedOn && Array.isArray(tool.notSupportedOn)) {
      tool.notSupportedOn.forEach((platform: string) => {
        if (!validDeploymentTypes.includes(platform)) {
          errors.push(`${toolName} has invalid notSupportedOn platform: "${platform}"`);
        }
      });
    }
  });

  return errors;
}

/**
 * Check if tools are compatible with deployment type
 */
export const checkToolCompatibility = mutation({
  args: {
    tools: v.array(v.object({
      name: v.string(),
      type: v.string(),
      notSupportedOn: v.optional(v.array(v.string())),
    })),
    deploymentType: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const incompatibleTools: string[] = [];

    args.tools.forEach((tool) => {
      if (tool.notSupportedOn && Array.isArray(tool.notSupportedOn)) {
        if (tool.notSupportedOn.includes(args.deploymentType)) {
          incompatibleTools.push(tool.name);
        }
      }
    });

    return {
      compatible: incompatibleTools.length === 0,
      incompatibleTools,
      message: incompatibleTools.length > 0
        ? `The following tools are not supported on ${args.deploymentType}: ${incompatibleTools.join(", ")}`
        : "All tools are compatible with this deployment type",
    };
  },
});
