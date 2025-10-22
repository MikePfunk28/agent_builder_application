/**
 * Tool and Model Integration Tests
 * 
 * Tests tool loading, invocation, model configuration, and error handling
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 */

import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Proper module loading for convex-test
const modules = import.meta.glob("./**/*.ts");

describe("Tool Loading and Configuration", () => {
  let t: any;
  let testUserId: Id<"users">;
  let testAgentId: Id<"agents">;

  beforeEach(async () => {
    t = convexTest(schema, modules);

    // Create test user
    testUserId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        userId: "test-user-tools",
        email: "tools@test.com",
        name: "Tools Test User",
        tier: "personal",
        createdAt: Date.now(),
      });
    });

    t = t.withIdentity({ subject: testUserId });
  });

  describe("Tool Loading from Agent Configuration", () => {
    test("should load agent with single tool configuration", async () => {
      // Requirement 4.1: Tool loading from agent configuration
      testAgentId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("agents", {
          name: "Single Tool Agent",
          description: "Agent with one tool",
          model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
          systemPrompt: "You are a helpful assistant",
          tools: [
            {
              name: "calculator",
              type: "calculator",
              config: {},
            },
          ],
          generatedCode: "# Agent code",
          deploymentType: "local",
          createdBy: testUserId,
        });
      });

      const agent = await t.query(api.agents.get, { id: testAgentId });

      expect(agent).toBeDefined();
      expect(agent.tools).toHaveLength(1);
      expect(agent.tools[0].name).toBe("calculator");
      expect(agent.tools[0].type).toBe("calculator");
    });

    test("should load agent with multiple tools", async () => {
      // Requirement 4.1: Multiple tool loading
      testAgentId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("agents", {
          name: "Multi Tool Agent",
          description: "Agent with multiple tools",
          model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
          systemPrompt: "You are a helpful assistant",
          tools: [
            { name: "calculator", type: "calculator", config: {} },
            { name: "file_read", type: "file_read", config: {} },
            { name: "http_request", type: "http_request", config: {} },
          ],
          generatedCode: "# Agent code",
          deploymentType: "local",
          createdBy: testUserId,
        });
      });

      const agent = await t.query(api.agents.get, { id: testAgentId });

      expect(agent).toBeDefined();
      expect(agent.tools).toHaveLength(3);
      expect(agent.tools.map((t: any) => t.name)).toContain("calculator");
      expect(agent.tools.map((t: any) => t.name)).toContain("file_read");
      expect(agent.tools.map((t: any) => t.name)).toContain("http_request");
    });

    test("should load tool with custom configuration", async () => {
      // Requirement 4.1: Tool configuration loading
      testAgentId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("agents", {
          name: "Custom Config Agent",
          description: "Agent with custom tool config",
          model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
          systemPrompt: "You are a helpful assistant",
          tools: [
            {
              name: "http_request",
              type: "http_request",
              config: {
                baseUrl: "https://api.example.com",
                timeout: 30000,
                headers: {
                  "Content-Type": "application/json",
                },
              },
            },
          ],
          generatedCode: "# Agent code",
          deploymentType: "local",
          createdBy: testUserId,
        });
      });

      const agent = await t.query(api.agents.get, { id: testAgentId });

      expect(agent).toBeDefined();
      expect(agent.tools[0].config).toBeDefined();
      expect(agent.tools[0].config.baseUrl).toBe("https://api.example.com");
      expect(agent.tools[0].config.timeout).toBe(30000);
    });

    test("should load tool with pip dependencies", async () => {
      // Requirement 4.1: Tool dependencies
      testAgentId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("agents", {
          name: "Pip Dependencies Agent",
          description: "Agent with tool requiring pip packages",
          model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
          systemPrompt: "You are a helpful assistant",
          tools: [
            {
              name: "browser",
              type: "browser",
              config: {},
              requiresPip: true,
              pipPackages: ["playwright>=1.40.0", "beautifulsoup4>=4.12.0"],
            },
          ],
          generatedCode: "# Agent code",
          deploymentType: "local",
          createdBy: testUserId,
        });
      });

      const agent = await t.query(api.agents.get, { id: testAgentId });

      expect(agent).toBeDefined();
      expect(agent.tools[0].requiresPip).toBe(true);
      expect(agent.tools[0].pipPackages).toContain("playwright>=1.40.0");
      expect(agent.tools[0].pipPackages).toContain("beautifulsoup4>=4.12.0");
    });

    test("should retrieve tool metadata from registry", async () => {
      // Requirement 4.1: Tool metadata retrieval
      const toolMetadata = await t.query(api.toolRegistry.getToolMetadata, {
        toolName: "calculator",
      });

      expect(toolMetadata).toBeDefined();
      expect(toolMetadata.name).toBe("calculator");
      expect(toolMetadata.category).toBe("utilities");
      expect(toolMetadata.basePip).toBe("strands-agents-tools");
    });

    test("should get all available tools from registry", async () => {
      // Requirement 4.1: Tool discovery
      const allTools = await t.query(api.toolRegistry.getAllTools);

      expect(allTools).toBeDefined();
      expect(Array.isArray(allTools)).toBe(true);
      expect(allTools.length).toBeGreaterThan(20); // Should have 50+ tools

      // Verify key tools are present
      const toolNames = allTools.map((t: any) => t.name);
      expect(toolNames).toContain("calculator");
      expect(toolNames).toContain("file_read");
      expect(toolNames).toContain("http_request");
      expect(toolNames).toContain("browser");
    });

    test("should get tools by category", async () => {
      // Requirement 4.1: Tool categorization
      const fileTools = await t.query(api.toolRegistry.getToolsByCategory, {
        category: "file_operations",
      });

      expect(fileTools).toBeDefined();
      expect(Array.isArray(fileTools)).toBe(true);
      expect(fileTools.length).toBeGreaterThan(0);

      const toolNames = fileTools.map((t: any) => t.name);
      expect(toolNames).toContain("file_read");
      expect(toolNames).toContain("file_write");
      expect(toolNames).toContain("editor");
    });

    test("should search tools by capability", async () => {
      // Requirement 4.1: Tool search
      const browserTools = await t.query(api.toolRegistry.searchToolsByCapability, {
        capability: "browser",
      });

      expect(browserTools).toBeDefined();
      expect(Array.isArray(browserTools)).toBe(true);
      expect(browserTools.length).toBeGreaterThan(0);

      const toolNames = browserTools.map((t: any) => t.name);
      expect(toolNames).toContain("browser");
    });
  });

  describe("Tool Invocation with Parameters", () => {
    test("should validate tool invocation parameters", async () => {
      // Requirement 4.2: Tool invocation with parameters
      const toolMetadata = await t.query(api.toolRegistry.getToolMetadata, {
        toolName: "calculator",
      });

      expect(toolMetadata).toBeDefined();
      expect(toolMetadata.exampleUsage).toBeDefined();
      expect(toolMetadata.exampleUsage).toContain("calculator");
    });

    test("should get required packages for tool list", async () => {
      // Requirement 4.2: Tool dependency resolution
      const packages = await t.query(api.toolRegistry.getRequiredPackages, {
        toolNames: ["calculator", "file_read", "browser"],
      });

      expect(packages).toBeDefined();
      expect(packages.basePackages).toContain("strands-agents-tools>=1.0.0");
      
      // Browser requires extras
      expect(packages.extras).toContain("strands-agents-tools[local_chromium_browser]");
    });

    test("should validate tool platform compatibility", async () => {
      // Requirement 4.2: Platform validation
      const pythonReplWindows = await t.query(api.toolRegistry.validateToolCompatibility, {
        toolName: "python_repl",
        platform: "windows",
      });

      expect(pythonReplWindows).toBeDefined();
      expect(pythonReplWindows.compatible).toBe(false);
      expect(pythonReplWindows.reason).toContain("not supported");

      const pythonReplLinux = await t.query(api.toolRegistry.validateToolCompatibility, {
        toolName: "python_repl",
        platform: "linux",
      });

      expect(pythonReplLinux).toBeDefined();
      expect(pythonReplLinux.compatible).toBe(true);
    });

    test("should handle tool invocation with complex parameters", async () => {
      // Requirement 4.2: Complex parameter handling
      testAgentId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("agents", {
          name: "Complex Params Agent",
          description: "Agent with complex tool parameters",
          model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
          systemPrompt: "You are a helpful assistant",
          tools: [
            {
              name: "http_request",
              type: "http_request",
              config: {
                method: "POST",
                headers: {
                  "Authorization": "Bearer token",
                  "Content-Type": "application/json",
                },
                body: {
                  query: "test",
                  filters: ["filter1", "filter2"],
                },
              },
            },
          ],
          generatedCode: "# Agent code",
          deploymentType: "local",
          createdBy: testUserId,
        });
      });

      const agent = await t.query(api.agents.get, { id: testAgentId });

      expect(agent).toBeDefined();
      expect(agent.tools[0].config.method).toBe("POST");
      expect(agent.tools[0].config.headers.Authorization).toBe("Bearer token");
      expect(agent.tools[0].config.body.filters).toHaveLength(2);
    });
  });

  describe("Model Configuration Loading", () => {
    test("should load Bedrock model configuration", async () => {
      // Requirement 4.3: Model configuration loading
      const model = await t.query(api.modelRegistry.getModelById, {
        modelId: "anthropic.claude-3-5-sonnet-20240620-v1:0",
      });

      expect(model).toBeDefined();
      expect(model?.provider).toBe("bedrock");
      expect(model?.capabilities).toContain("text");
      expect(model?.contextWindow).toBeGreaterThan(0);
    });

    test("should load Ollama model configuration", async () => {
      // Requirement 4.3: Ollama model loading
      const model = await t.query(api.modelRegistry.getModelById, {
        modelId: "llama3.3",
      });

      expect(model).toBeDefined();
      expect(model?.provider).toBe("ollama");
      expect(model?.capabilities).toContain("text");
    });

    test("should get all available models", async () => {
      // Requirement 4.3: Model discovery
      const allModels = await t.query(api.modelRegistry.getAllModels);

      expect(allModels).toBeDefined();
      expect(Array.isArray(allModels)).toBe(true);
      expect(allModels.length).toBeGreaterThan(10);

      // Verify key models are present
      const modelIds = allModels.map((m: any) => m.id);
      expect(modelIds).toContain("anthropic.claude-3-5-sonnet-20240620-v1:0");
      expect(modelIds).toContain("llama3.3");
    });

    test("should get models by provider", async () => {
      // Requirement 4.3: Provider filtering
      const bedrockModels = await t.query(api.modelRegistry.getModelsByProvider, {
        provider: "bedrock",
      });

      expect(bedrockModels).toBeDefined();
      expect(Array.isArray(bedrockModels)).toBe(true);
      expect(bedrockModels.length).toBeGreaterThan(0);
      expect(bedrockModels.every((m: any) => m.provider === "bedrock")).toBe(true);
    });

    test("should get models by capability", async () => {
      // Requirement 4.3: Capability filtering
      const visionModels = await t.query(api.modelRegistry.getModelsByCapability, {
        capability: "vision",
      });

      expect(visionModels).toBeDefined();
      expect(Array.isArray(visionModels)).toBe(true);
      expect(visionModels.length).toBeGreaterThan(0);
      expect(visionModels.every((m: any) => m.capabilities.includes("vision"))).toBe(true);
    });

    test("should get recommended models", async () => {
      // Requirement 4.3: Model recommendations
      const recommended = await t.query(api.modelRegistry.getRecommendedModels);

      expect(recommended).toBeDefined();
      expect(Array.isArray(recommended)).toBe(true);
      expect(recommended.length).toBeGreaterThan(0);
      expect(recommended.every((m: any) => m.recommended === true)).toBe(true);
    });

    test("should load agent with specific model configuration", async () => {
      // Requirement 4.3: Agent model configuration
      testAgentId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("agents", {
          name: "Specific Model Agent",
          description: "Agent with specific model",
          model: "anthropic.claude-haiku-4-5-20250514-v1:0",
          systemPrompt: "You are a helpful assistant",
          tools: [],
          generatedCode: "# Agent code",
          deploymentType: "bedrock",
          createdBy: testUserId,
        });
      });

      const agent = await t.query(api.agents.get, { id: testAgentId });

      expect(agent).toBeDefined();
      expect(agent.model).toBe("anthropic.claude-haiku-4-5-20250514-v1:0");
      expect(agent.deploymentType).toBe("bedrock");
    });
  });

  describe("Model Prompt and Response Flow", () => {
    test("should generate agent code with model configuration", async () => {
      // Requirement 4.4: Model prompt/response flow
      const result = await t.action(api.codeGenerator.generateAgent, {
        name: "Test Agent",
        model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
        systemPrompt: "You are a helpful assistant",
        tools: [],
        deploymentType: "bedrock",
      });

      expect(result).toBeDefined();
      expect(result.generatedCode).toBeDefined();
      expect(result.generatedCode).toContain("@agent");
      expect(result.generatedCode).toContain("anthropic.claude-3-5-sonnet-20240620-v1:0");
    });

    test("should include model in generated requirements.txt", async () => {
      // Requirement 4.4: Model dependencies
      const result = await t.action(api.codeGenerator.generateAgent, {
        name: "Test Agent",
        model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
        systemPrompt: "You are a helpful assistant",
        tools: [],
        deploymentType: "bedrock",
      });

      expect(result).toBeDefined();
      expect(result.requirementsTxt).toContain("strands-agents");
      expect(result.requirementsTxt).toContain("opentelemetry");
    });

    test("should configure Ollama model in generated code", async () => {
      // Requirement 4.4: Ollama configuration
      const result = await t.action(api.codeGenerator.generateAgent, {
        name: "Ollama Agent",
        model: "llama3.3",
        systemPrompt: "You are a helpful assistant",
        tools: [],
        deploymentType: "ollama",
      });

      expect(result).toBeDefined();
      expect(result.generatedCode).toBeDefined();
      expect(result.generatedCode).toContain("llama3.3");
      expect(result.requirementsTxt).toContain("strands-agents");
    });

    test("should validate model exists before agent creation", async () => {
      // Requirement 4.4: Model validation
      const model = await t.query(api.modelRegistry.getModelById, {
        modelId: "anthropic.claude-3-5-sonnet-20240620-v1:0",
      });

      expect(model).toBeDefined();
      expect(model?.id).toBe("anthropic.claude-3-5-sonnet-20240620-v1:0");

      // Try to get non-existent model
      const invalidModel = await t.query(api.modelRegistry.getModelById, {
        modelId: "invalid-model-id",
      });

      expect(invalidModel).toBeNull();
    });
  });

  describe("Error Handling in Tool and Model Operations", () => {
    test("should handle missing tool gracefully", async () => {
      // Requirement 4.5: Tool error handling
      const toolMetadata = await t.query(api.toolRegistry.getToolMetadata, {
        toolName: "non_existent_tool",
      });

      expect(toolMetadata).toBeNull();
    });

    test("should handle invalid tool category", async () => {
      // Requirement 4.5: Category error handling
      const tools = await t.query(api.toolRegistry.getToolsByCategory, {
        category: "invalid_category",
      });

      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(0);
    });

    test("should handle missing model gracefully", async () => {
      // Requirement 4.6: Model error handling
      const model = await t.query(api.modelRegistry.getModelById, {
        modelId: "non-existent-model",
      });

      expect(model).toBeNull();
    });

    test("should handle invalid provider", async () => {
      // Requirement 4.6: Provider error handling
      const models = await t.query(api.modelRegistry.getModelsByProvider, {
        provider: "invalid_provider" as any,
      });

      expect(models).toBeDefined();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBe(0);
    });

    test("should handle agent creation with invalid tool", async () => {
      // Requirement 4.7: Agent creation error handling
      await expect(
        t.mutation(api.agents.create, {
          name: "Invalid Tool Agent",
          description: "Agent with invalid tool",
          model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
          systemPrompt: "You are a helpful assistant",
          tools: [
            {
              name: "invalid_tool",
              type: "invalid_type",
              config: {},
            },
          ],
          generatedCode: "# Agent code",
          deploymentType: "local",
        })
      ).resolves.toBeDefined(); // Should still create agent, validation happens at runtime
    });

    test("should handle tool with missing required configuration", async () => {
      // Requirement 4.7: Configuration error handling
      testAgentId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("agents", {
          name: "Missing Config Agent",
          description: "Agent with tool missing config",
          model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
          systemPrompt: "You are a helpful assistant",
          tools: [
            {
              name: "http_request",
              type: "http_request",
              // Missing config object
            },
          ],
          generatedCode: "# Agent code",
          deploymentType: "local",
          createdBy: testUserId,
        });
      });

      const agent = await t.query(api.agents.get, { id: testAgentId });

      expect(agent).toBeDefined();
      expect(agent.tools[0].config).toBeUndefined();
    });

    test("should handle code generation failure gracefully", async () => {
      // Requirement 4.7: Code generation error handling
      const result = await t.action(api.codeGenerator.generateAgent, {
        name: "", // Invalid empty name
        model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
        systemPrompt: "",
        tools: [],
        deploymentType: "local",
      });

      expect(result).toBeDefined();
      // Should still generate code even with empty name (validation happens elsewhere)
      expect(result.generatedCode).toBeDefined();
    });

    test("should validate tool platform compatibility before use", async () => {
      // Requirement 4.7: Platform compatibility validation
      const incompatible = await t.query(api.toolRegistry.validateToolCompatibility, {
        toolName: "python_repl",
        platform: "windows",
      });

      expect(incompatible.compatible).toBe(false);
      expect(incompatible.reason).toBeDefined();
    });
  });

  describe("Tool and Model Integration", () => {
    test("should create agent with tools and model together", async () => {
      // Integration test: Tools + Model
      testAgentId = await t.mutation(api.agents.create, {
        name: "Integrated Agent",
        description: "Agent with tools and model",
        model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
        systemPrompt: "You are a helpful assistant with tools",
        tools: [
          { name: "calculator", type: "calculator", config: {} },
          { name: "file_read", type: "file_read", config: {} },
        ],
        generatedCode: "# Agent code with tools",
        deploymentType: "bedrock",
      });

      const agent = await t.query(api.agents.get, { id: testAgentId });

      expect(agent).toBeDefined();
      expect(agent.model).toBe("anthropic.claude-3-5-sonnet-20240620-v1:0");
      expect(agent.tools).toHaveLength(2);
      expect(agent.deploymentType).toBe("bedrock");
    });

    test("should generate code with tools and model configuration", async () => {
      // Integration test: Code generation with tools and model
      const result = await t.action(api.codeGenerator.generateAgent, {
        name: "Full Integration Agent",
        model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
        systemPrompt: "You are a helpful assistant",
        tools: [
          { name: "calculator", type: "calculator", config: {} },
          { name: "http_request", type: "http_request", config: {} },
        ],
        deploymentType: "bedrock",
      });

      expect(result).toBeDefined();
      expect(result.generatedCode).toBeDefined();
      expect(result.generatedCode).toContain("@agent");
      expect(result.generatedCode).toContain("calculator");
      expect(result.generatedCode).toContain("http_request");
      expect(result.requirementsTxt).toContain("strands-agents-tools");
    });

    test("should get required packages for agent with multiple tools", async () => {
      // Integration test: Package resolution
      const packages = await t.query(api.toolRegistry.getRequiredPackages, {
        toolNames: ["calculator", "browser", "slack", "use_aws"],
      });

      expect(packages).toBeDefined();
      expect(packages.basePackages).toContain("strands-agents-tools>=1.0.0");
      expect(packages.extras).toContain("strands-agents-tools[local_chromium_browser]");
      expect(packages.basePackages).toContain("boto3>=1.28.0");
      expect(packages.basePackages).toContain("slack-sdk>=3.0.0");
    });
  });
});
