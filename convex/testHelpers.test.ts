/**
 * Test Helpers and Utilities for Integration Tests
 *
 * This module provides reusable test utilities, constants, and helper functions
 * to reduce code duplication and improve test maintainability.
 */

import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";
import { TEST_CONSTANTS } from "./constants";

// ============================================================================
// Centralized Module Loading
// ============================================================================

/**
 * Loads test modules with proper error handling
 * This centralizes module loading to avoid duplication across test files
 *
 * Note: import.meta.glob is available during Vite build/dev but not during
 * Node.js test execution. The convex-test framework handles module loading
 * internally, so we just need to return an empty object as a placeholder.
 */
function getTestModules(): Record<string, () => Promise<unknown>> {
  // Check if import.meta.glob is available (it will be during Vite processing)
  if (typeof import.meta !== 'undefined' &&
      import.meta.glob &&
      typeof import.meta.glob === "function") {
    // Load all TypeScript files - Vite/convex-test will handle filtering
    return import.meta.glob("./**/*.ts");
  }

  // During test execution, return empty object - convex-test will handle module loading
  return {};
}

// Centralized module loading
export const testModules = getTestModules();

/**
 * Creates a convex test instance with centralized module loading
 */
export function createConvexTest() {
  return convexTest(schema, testModules);
}

// ============================================================================
// Test Constants
// ============================================================================

// Test constants are imported from ./constants and re-exported for convenience
export { TEST_CONSTANTS };

// ============================================================================
// Type Definitions
// ============================================================================

export interface TestUser {
  email: string;
  name: string;
  tier?: string;
  authProvider?: string;
  login?: string;
  locale?: string;
  createdAt: number;
  lastSignIn?: number;
  signInCount?: number;
}

export interface AgentConfig {
  name: string;
  model: string;
  systemPrompt: string;
  tools: any[];
  deploymentType: string;
  description?: string;
  isPublic?: boolean;
}

export interface Tool {
  name: string;
  type: string;
  config?: Record<string, any>;
  requiresPip?: boolean;
  pipPackages?: string[];
  extrasPip?: string;
}

// ============================================================================
// Test Helper Functions
// ============================================================================

/**
 * Creates a test user with optional custom properties
 */
export const createTestUser = async (
  t: any,
  userId: string = "test-user",
  overrides: Partial<TestUser> = {}
): Promise<any> => {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      email: `${userId}@example.com`,
      name: `${userId} User`,
      tier: "personal",
      createdAt: Date.now(),
      ...overrides,
    });
  });
};

/**
 * Generates agent code using the code generator action
 */
export const generateTestAgent = async (
  t: any,
  config: Partial<AgentConfig> = {}
): Promise<any> => {
  return await t.action(api.codeGenerator.generateAgent, {
    name: config.name || "TestAgent",
    model: config.model || TEST_CONSTANTS.MODELS.CLAUDE_SONNET,
    systemPrompt: config.systemPrompt || "You are a helpful test agent",
    tools: config.tools || [],
    deploymentType: config.deploymentType || "local",
  });
};

/**
 * Creates an agent using the agents.create mutation
 */
export const createAgent = async (
  t: any,
  config: Partial<AgentConfig> & { generatedCode: string }
): Promise<any> => {
  return await t.mutation(api.agents.create, {
    name: config.name || "TestAgent",
    description: config.description || "Test agent",
    model: config.model || TEST_CONSTANTS.MODELS.CLAUDE_SONNET,
    systemPrompt: config.systemPrompt || "You are a helpful test agent",
    tools: config.tools || [],
    generatedCode: config.generatedCode,
    deploymentType: config.deploymentType || "local",
    isPublic: config.isPublic ?? false,
  });
};

/**
 * Gets an agent by ID
 */
export const getAgent = async (t: any, agentId: any): Promise<any> => {
  return await t.run(async (ctx: any) => {
    return await ctx.db.get(agentId);
  });
};

// ============================================================================
// Test Fixtures
// ============================================================================

export class TestFixtures {
  /**
   * Creates a basic agent configuration
   */
  static createBasicAgent(overrides: Partial<AgentConfig> = {}): AgentConfig {
    return {
      name: "TestAgent",
      model: TEST_CONSTANTS.MODELS.CLAUDE_SONNET,
      systemPrompt: "You are a helpful test agent",
      tools: [],
      deploymentType: "local",
      ...overrides,
    };
  }

  /**
   * Creates an agent configuration with multiple tools
   */
  static createMultiToolAgent(overrides: Partial<AgentConfig> = {}): AgentConfig {
    return {
      ...this.createBasicAgent(),
      name: "MultiToolAgent",
      tools: [
        TEST_CONSTANTS.TOOLS.SEARCH,
        TEST_CONSTANTS.TOOLS.CALCULATOR,
        TEST_CONSTANTS.TOOLS.FILE_READ,
      ],
      ...overrides,
    };
  }

  /**
   * Creates an agent configuration with a custom tool
   */
  static createCustomToolAgent(customTool: Tool, overrides: Partial<AgentConfig> = {}): AgentConfig {
    return {
      ...this.createBasicAgent(),
      name: "CustomToolAgent",
      tools: [customTool],
      ...overrides,
    };
  }

  /**
   * Creates a custom tool configuration
   */
  static createCustomTool(
    name: string,
    description: string,
    parameters: any[] = []
  ): Tool {
    return {
      name,
      type: `custom_${name.toLowerCase()}`,
      config: {
        description,
        parameters,
      },
    };
  }
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Asserts that generated code contains the @agent decorator with expected configuration
 */
export const assertAgentHasDecorator = (
  code: string,
  expectedModel: string,
  expectedPrompt?: string
): void => {
  if (!code.includes("@agent(")) {
    throw new Error("Code does not contain @agent decorator");
  }
  if (!code.includes(`model="${expectedModel}"`)) {
    throw new Error(`Code does not contain expected model: ${expectedModel}`);
  }
  if (expectedPrompt && !code.includes(expectedPrompt)) {
    throw new Error(`Code does not contain expected prompt: ${expectedPrompt}`);
  }
  if (!code.includes("memory=True")) {
    throw new Error("Code does not contain memory=True");
  }
  if (!code.includes('reasoning="interleaved"')) {
    throw new Error('Code does not contain reasoning="interleaved"');
  }
};

/**
 * Asserts that generated code contains preprocessing hooks
 */
export const assertCodeHasPreprocessing = (code: string): void => {
  if (!code.includes("async def preprocess_message")) {
    throw new Error("Code does not contain preprocess_message function");
  }
  if (!code.includes("preprocess=preprocess_message")) {
    throw new Error("Code does not reference preprocess_message in decorator");
  }
};

/**
 * Asserts that generated code contains postprocessing hooks
 */
export const assertCodeHasPostprocessing = (code: string): void => {
  if (!code.includes("async def postprocess_response")) {
    throw new Error("Code does not contain postprocess_response function");
  }
  if (!code.includes("postprocess=postprocess_response")) {
    throw new Error("Code does not reference postprocess_response in decorator");
  }
};

/**
 * Asserts that generated code contains the @tool decorator for custom tools
 */
export const assertCodeHasToolDecorator = (
  code: string,
  toolName: string,
  description?: string
): void => {
  if (!code.includes("@tool(")) {
    throw new Error("Code does not contain @tool decorator");
  }
  if (!code.includes(`name="${toolName}"`)) {
    throw new Error(`Code does not contain tool name: ${toolName}`);
  }
  if (description && !code.includes(`description="${description}"`)) {
    throw new Error(`Code does not contain tool description: ${description}`);
  }
};

/**
 * Asserts that requirements.txt contains expected packages
 */
export const assertRequirementsContains = (
  requirements: string,
  packages: string[]
): void => {
  for (const pkg of packages) {
    if (!requirements.includes(pkg)) {
      throw new Error(`Requirements does not contain package: ${pkg}`);
    }
  }
};
