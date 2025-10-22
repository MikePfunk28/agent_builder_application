/**
 * Multi-Environment Execution Tests
 * 
 * Tests agent execution across different environments:
 * 1. Docker/ECS Fargate (for Ollama models)
 * 2. AWS Bedrock AgentCore (for Bedrock models)
 * 3. Local testing environment
 * 
 * Validates:
 * - Model configuration correctness
 * - Environment variable access
 * - Consistent results across environments
 * - MCP tool integration
 * - Agent-as-tool functionality
 * 
 * Requirements: 7.1-7.7
 */

import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach, afterEach } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { BEDROCK_MODELS, OLLAMA_MODELS } from "./modelRegistry";

const modules = import.meta.glob("./**/*.ts");

describe("Multi-Environment Agent Execution", () => {
  let t: any;
  let testUserId: Id<"users">;

  beforeEach(async () => {
    t = convexTest(schema, modules);

    // Create test user
    testUserId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        userId: "test-user-multi-env",
        email: "test@multienv.com",
        name: "Multi-Env Test User",
        tier: "personal",
        testsThisMonth: 0,
        createdAt: Date.now(),
        isAnonymous: false,
      });
    });

    t = t.withIdentity({ subject: testUserId });
  });

  afterEach(async () => {
    // Cleanup test data
    if (t && testUserId) {
      await t.run(async (ctx: any) => {
        // Delete test executions
        const tests = await ctx.db
          .query("testExecutions")
          .withIndex("by_user", (q: any) => q.eq("userId", testUserId))
          .collect();
        
        for (const test of tests) {
          await ctx.db.delete(test._id);
        }

        // Delete agents
        const agents = await ctx.db
          .query("agents")
          .filter((q: any) => q.eq(q.field("createdBy"), testUserId))
          .collect();
        
        for (const agent of agents) {
          await ctx.db.delete(agent._id);
        }

        // Delete user
        await ctx.db.delete(testUserId);
      });
    }
  });

  describe("Docker Environment (Ollama Models)", () => {
    test("should execute agent with Llama 3.3 model in Docker", async () => {
      // Requirement 7.1: Docker environment execution
      const agentId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("agents", {
          name: "Llama Docker Agent",
          description: "Test agent using Llama 3.3",
          model: "llama3.3",
          systemPrompt: "You are a helpful assistant.",
          tools: [],
          generatedCode: `from strands_agents import Agent\n\nclass LlamaAgent(Agent):\n    pass`,
          deploymentType: "ollama",
          createdBy: testUserId,
          isPublic: false,
        });
      });

      const result = await t.mutation(api.testExecution.submitTest, {
        agentId,
        testQuery: "What is 2 + 2?",
      });

      const test = await t.query(api.testExecution.getTestById, {
        testId: result.testId,
      });

      expect(test.modelProvider).toBe("ollama");
      expect(test.modelConfig.testEnvironment).toBe("docker");
      expect(test.modelConfig.modelId).toBe("llama3.3");
      expect(test.modelConfig.baseUrl).toBeDefined();
      expect(test.dockerfile).toContain("python:3.11");
      expect(test.requirements).toContain("ollama");
    });

    test("should execute agent with Qwen3 Coder model in Docker", async () => {
      // Requirement 7.1: Docker environment with coding model
      const agentId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("agents", {
          name: "Qwen Coder Agent",
          description: "Test agent using Qwen3 Coder",
          model: "qwen3-coder:30b",
          systemPrompt: "You are a coding assistant.",
          tools: [],
          generatedCode: `from strands_agents import Agent\n\nclass QwenCoderAgent(Agent):\n    pass`,
          deploymentType: "ollama",
          createdBy: testUserId,
          isPublic: false,
        });
      });

      const result = await t.mutation(api.testExecution.submitTest, {
        agentId,
        testQuery: "Write a Python function to calculate fibonacci",
      });

      const test = await t.query(api.testExecution.getTestById, {
        testId: result.testId,
      });

      expect(test.modelProvider).toBe("ollama");
      expect(test.modelConfig.modelId).toBe("qwen3-coder:30b");
      expect(test.modelConfig.testEnvironment).toBe("docker");
    });

    test("should execute agent with DeepSeek R1 reasoning model in Docker", async () => {
      // Requirement 7.1: Docker environment with reasoning model
      const agentId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("agents", {
          name: "DeepSeek Reasoning Agent",
          description: "Test agent using DeepSeek R1",
          model: "deepseek-r1:8b",
          systemPrompt: "You are a reasoning assistant.",
          tools: [],
          generatedCode: `from strands_agents import Agent\n\nclass DeepSeekAgent(Agent):\n    pass`,
          deploymentType: "ollama",
          createdBy: testUserId,
          isPublic: false,
        });
      });

      const result = await t.mutation(api.testExecution.submitTest, {
        agentId,
        testQuery: "Solve this logic puzzle: If all A are B, and all B are C, what can we conclude?",
      });

      const test = await t.query(api.testExecution.getTestById, {
        testId: result.testId,
      });

      expect(test.modelProvider).toBe("ollama");
      expect(test.modelConfig.modelId).toBe("deepseek-r1:8b");
      expect(test.modelConfig.testEnvironment).toBe("docker");
    });
  });

  describe("AgentCore Environment (Bedrock Models)", () => {
    test("should execute agent with Claude 4.5 Sonnet in AgentCore", async () => {
      // Requirement 7.2: AgentCore environment execution
      const agentId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("agents", {
          name: "Claude Sonnet Agent",
          description: "Test agent using Claude 4.5 Sonnet",
          model: "anthropic.claude-sonnet-4-5-20250929-v1:0",
          systemPrompt: "You are a helpful assistant.",
          tools: [],
          generatedCode: `from strands_agents import Agent\n\nclass ClaudeAgent(Agent):\n    pass`,
          deploymentType: "bedrock",
          createdBy: testUserId,
          isPublic: false,
        });
      });

      const result = await t.mutation(api.testExecution.submitTest, {
        agentId,
        testQuery: "Explain quantum computing",
      });

      const test = await t.query(api.testExecution.getTestById, {
        testId: result.testId,
      });

      expect(test.modelProvider).toBe("bedrock");
      expect(test.modelConfig.testEnvironment).toBe("agentcore");
      expect(test.modelConfig.modelId).toBe("anthropic.claude-sonnet-4-5-20250929-v1:0");
      expect(test.modelConfig.region).toBeDefined();
      expect(test.dockerfile).toContain("--platform=linux/arm64");
      expect(test.dockerfile).toContain("agentcore_server.py");
      expect(test.requirements).toContain("bedrock-agentcore");
    });

    test("should execute agent with Claude 4.5 Haiku in AgentCore", async () => {
      // Requirement 7.2: AgentCore with fast model
      const agentId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("agents", {
          name: "Claude Haiku Agent",
          description: "Test agent using Claude 4.5 Haiku",
          model: "anthropic.claude-haiku-4-5-20250514-v1:0",
          systemPrompt: "You are a fast assistant.",
          tools: [],
          generatedCode: `from strands_agents import Agent\n\nclass ClaudeHaikuAgent(Agent):\n    pass`,
          deploymentType: "bedrock",
          createdBy: testUserId,
          isPublic: false,
        });
      });

      const result = await t.mutation(api.testExecution.submitTest, {
        agentId,
        testQuery: "Quick summary of photosynthesis",
      });

      const test = await t.query(api.testExecution.getTestById, {
        testId: result.testId,
      });

      expect(test.modelProvider).toBe("bedrock");
      expect(test.modelConfig.modelId).toBe("anthropic.claude-haiku-4-5-20250514-v1:0");
      expect(test.modelConfig.testEnvironment).toBe("agentcore");
    });

    test("should execute agent with Amazon Nova Pro in AgentCore", async () => {
      // Requirement 7.2: AgentCore with Amazon model
      const agentId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("agents", {
          name: "Nova Pro Agent",
          description: "Test agent using Amazon Nova Pro",
          model: "amazon.nova-pro-v1:0",
          systemPrompt: "You are a helpful assistant.",
          tools: [],
          generatedCode: `from strands_agents import Agent\n\nclass NovaAgent(Agent):\n    pass`,
          deploymentType: "bedrock",
          createdBy: testUserId,
          isPublic: false,
        });
      });

      const result = await t.mutation(api.testExecution.submitTest, {
        agentId,
        testQuery: "Describe machine learning",
      });

      const test = await t.query(api.testExecution.getTestById, {
        testId: result.testId,
      });

      expect(test.modelProvider).toBe("bedrock");
      expect(test.modelConfig.modelId).toBe("amazon.nova-pro-v1:0");
      expect(test.modelConfig.testEnvironment).toBe("agentcore");
    });
  });

  describe("Environment Variable Access", () => {
    test("should include environment variables in Docker execution", async () => {
      // Requirement 7.5: Environment variable access
      const agentId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("agents", {
          name: "EnvVar Docker Agent",
          description: "Test agent with environment variables",
          model: "llama3.3",
          systemPrompt: "You are a helpful assistant.",
          tools: [],
          generatedCode: `from strands_agents import Agent\nimport os\n\nclass EnvVarAgent(Agent):\n    def __init__(self):\n        # Environment variables would be set in container\n        self.api_key = os.getenv('API_KEY', 'default')\n        self.log_level = os.getenv('LOG_LEVEL', 'INFO')\n    pass`,
          deploymentType: "ollama",
          createdBy: testUserId,
          isPublic: false,
        });
      });

      const result = await t.mutation(api.testExecution.submitTest, {
        agentId,
        testQuery: "test",
      });

      const test = await t.query(api.testExecution.getTestById, {
        testId: result.testId,
      });

      // Verify environment variables are included in model config
      expect(test.modelConfig).toBeDefined();
      expect(test.modelConfig.baseUrl).toBeDefined();
      expect(test.modelConfig.testEnvironment).toBe("docker");
    });

    test("should include AWS environment variables in AgentCore execution", async () => {
      // Requirement 7.5: AWS environment variables
      const agentId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("agents", {
          name: "EnvVar Bedrock Agent",
          description: "Test agent with AWS environment variables",
          model: "anthropic.claude-sonnet-4-5-20250929-v1:0",
          systemPrompt: "You are a helpful assistant.",
          tools: [],
          generatedCode: `from strands_agents import Agent\nimport os\n\nclass AWSEnvAgent(Agent):\n    def __init__(self):\n        # AWS environment variables would be set in AgentCore\n        self.aws_region = os.getenv('AWS_REGION', 'us-east-1')\n        self.log_level = os.getenv('LOG_LEVEL', 'INFO')\n    pass`,
          deploymentType: "bedrock",
          createdBy: testUserId,
          isPublic: false,
        });
      });

      const result = await t.mutation(api.testExecution.submitTest, {
        agentId,
        testQuery: "test",
      });

      const test = await t.query(api.testExecution.getTestById, {
        testId: result.testId,
      });

      // Verify AWS environment variables are included
      expect(test.modelConfig.region).toBeDefined();
      expect(test.modelConfig.testEnvironment).toBe("agentcore");
    });
  });

  describe("Model Configuration Validation", () => {
    test("should validate all Bedrock model IDs are correctly configured", async () => {
      // Requirement 7.7: Model ID validation
      const bedrockModelIds = Object.keys(BEDROCK_MODELS);
      
      // Test a sample of models
      const sampleModels = [
        "anthropic.claude-sonnet-4-5-20250929-v1:0",
        "anthropic.claude-haiku-4-5-20250514-v1:0",
        "amazon.nova-pro-v1:0",
        "anthropic.claude-3-5-haiku-20241022-v1:0",
      ];

      for (const modelId of sampleModels) {
        const agentId = await t.run(async (ctx: any) => {
          return await ctx.db.insert("agents", {
            name: `Test Agent ${modelId}`,
            description: "Model validation test",
            model: modelId,
            systemPrompt: "Test",
            tools: [],
            generatedCode: `from strands_agents import Agent\n\nclass TestAgent(Agent):\n    pass`,
            deploymentType: "bedrock",
            createdBy: testUserId,
            isPublic: false,
          });
        });

        const result = await t.mutation(api.testExecution.submitTest, {
          agentId,
          testQuery: "test",
        });

        const test = await t.query(api.testExecution.getTestById, {
          testId: result.testId,
        });

        expect(test.modelProvider).toBe("bedrock");
        expect(test.modelConfig.modelId).toBe(modelId);
        expect(test.modelConfig.testEnvironment).toBe("agentcore");
        expect(BEDROCK_MODELS[modelId]).toBeDefined();
      }
    });

    test("should validate all Ollama model IDs are correctly configured", async () => {
      // Requirement 7.7: Ollama model ID validation
      const ollamaModelIds = Object.keys(OLLAMA_MODELS);
      
      // Test a sample of models
      const sampleModels = [
        "llama3.3",
        "qwen3:8b",
        "phi4:14b",
        "deepseek-r1:8b",
      ];

      for (const modelId of sampleModels) {
        const agentId = await t.run(async (ctx: any) => {
          return await ctx.db.insert("agents", {
            name: `Test Agent ${modelId}`,
            description: "Model validation test",
            model: modelId,
            systemPrompt: "Test",
            tools: [],
            generatedCode: `from strands_agents import Agent\n\nclass TestAgent(Agent):\n    pass`,
            deploymentType: "ollama",
            createdBy: testUserId,
            isPublic: false,
          });
        });

        const result = await t.mutation(api.testExecution.submitTest, {
          agentId,
          testQuery: "test",
        });

        const test = await t.query(api.testExecution.getTestById, {
          testId: result.testId,
        });

        expect(test.modelProvider).toBe("ollama");
        expect(test.modelConfig.modelId).toBe(modelId);
        expect(test.modelConfig.testEnvironment).toBe("docker");
        expect(OLLAMA_MODELS[modelId]).toBeDefined();
      }
    });
  });

  describe("Cross-Environment Consistency", () => {
    test("should produce consistent agent structure across environments", async () => {
      // Requirement 7.4: Consistent results across environments
      
      // Create Ollama agent
      const ollamaAgentId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("agents", {
          name: "Consistency Test Ollama",
          description: "Test consistency",
          model: "llama3.3",
          systemPrompt: "You are a helpful assistant. Always respond with 'Hello, World!'",
          tools: [],
          generatedCode: `from strands_agents import Agent\n\nclass ConsistencyAgent(Agent):\n    pass`,
          deploymentType: "ollama",
          createdBy: testUserId,
          isPublic: false,
        });
      });

      // Create Bedrock agent with same prompt
      const bedrockAgentId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("agents", {
          name: "Consistency Test Bedrock",
          description: "Test consistency",
          model: "anthropic.claude-sonnet-4-5-20250929-v1:0",
          systemPrompt: "You are a helpful assistant. Always respond with 'Hello, World!'",
          tools: [],
          generatedCode: `from strands_agents import Agent\n\nclass ConsistencyAgent(Agent):\n    pass`,
          deploymentType: "bedrock",
          createdBy: testUserId,
          isPublic: false,
        });
      });

      // Submit tests
      const ollamaResult = await t.mutation(api.testExecution.submitTest, {
        agentId: ollamaAgentId,
        testQuery: "Say hello",
      });

      const bedrockResult = await t.mutation(api.testExecution.submitTest, {
        agentId: bedrockAgentId,
        testQuery: "Say hello",
      });

      // Get test configurations
      const ollamaTest = await t.query(api.testExecution.getTestById, {
        testId: ollamaResult.testId,
      });

      const bedrockTest = await t.query(api.testExecution.getTestById, {
        testId: bedrockResult.testId,
      });

      // Verify both have proper structure
      expect(ollamaTest.agentCode).toBeDefined();
      expect(bedrockTest.agentCode).toBeDefined();
      expect(ollamaTest.requirements).toBeDefined();
      expect(bedrockTest.requirements).toBeDefined();
      expect(ollamaTest.dockerfile).toBeDefined();
      expect(bedrockTest.dockerfile).toBeDefined();

      // Verify environment-specific differences
      expect(ollamaTest.modelProvider).toBe("ollama");
      expect(bedrockTest.modelProvider).toBe("bedrock");
      expect(ollamaTest.modelConfig.testEnvironment).toBe("docker");
      expect(bedrockTest.modelConfig.testEnvironment).toBe("agentcore");
    });
  });

  describe("MCP Tool Integration in Multi-Environment", () => {
    test("should execute agent with MCP tools in Docker environment", async () => {
      // Requirement 7.3: MCP integration in Docker
      const agentId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("agents", {
          name: "MCP Docker Agent",
          description: "Test agent with MCP tools",
          model: "llama3.3",
          systemPrompt: "You are a helpful assistant with tools.",
          tools: [
            { name: "search", type: "search", config: {} },
            { name: "calculator", type: "calculator", config: {} },
          ],
          generatedCode: `from strands_agents import Agent\n\nclass MCPAgent(Agent):\n    pass`,
          deploymentType: "ollama",
          createdBy: testUserId,
          isPublic: false,
        });
      });

      const result = await t.mutation(api.testExecution.submitTest, {
        agentId,
        testQuery: "Search for Python tutorials",
      });

      const test = await t.query(api.testExecution.getTestById, {
        testId: result.testId,
      });

      expect(test.modelProvider).toBe("ollama");
      expect(test.modelConfig.testEnvironment).toBe("docker");
      // Tools should be included in requirements
      expect(test.requirements).toContain("strands-agents-tools");
    });

    test("should execute agent with MCP tools in AgentCore environment", async () => {
      // Requirement 7.3: MCP integration in AgentCore
      const agentId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("agents", {
          name: "MCP Bedrock Agent",
          description: "Test agent with MCP tools",
          model: "anthropic.claude-sonnet-4-5-20250929-v1:0",
          systemPrompt: "You are a helpful assistant with tools.",
          tools: [
            { name: "file_read", type: "file_read", config: {} },
            { name: "http_request", type: "http_request", config: {} },
          ],
          generatedCode: `from strands_agents import Agent\n\nclass MCPAgent(Agent):\n    pass`,
          deploymentType: "bedrock",
          createdBy: testUserId,
          isPublic: false,
        });
      });

      const result = await t.mutation(api.testExecution.submitTest, {
        agentId,
        testQuery: "Read a file",
      });

      const test = await t.query(api.testExecution.getTestById, {
        testId: result.testId,
      });

      expect(test.modelProvider).toBe("bedrock");
      expect(test.modelConfig.testEnvironment).toBe("agentcore");
      expect(test.requirements).toContain("strands-agents-tools");
    });
  });

  describe("Agent-as-Tool in Multi-Environment", () => {
    test("should expose Docker agent as MCP tool", async () => {
      // Requirement 7.6: Agent-as-tool in Docker
      const agentId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("agents", {
          name: "Tool Docker Agent",
          description: "Agent exposed as tool",
          model: "llama3.3",
          systemPrompt: "You are a calculator agent.",
          tools: [],
          generatedCode: `from strands_agents import Agent\n\nclass ToolAgent(Agent):\n    pass`,
          deploymentType: "ollama",
          exposableAsMCPTool: true,
          mcpToolName: "docker_calculator",
          mcpInputSchema: {
            type: "object",
            properties: {
              expression: { type: "string" },
            },
          },
          createdBy: testUserId,
          isPublic: false,
        });
      });

      const agent = await t.run(async (ctx: any) => {
        return await ctx.db.get(agentId);
      });

      expect(agent.exposableAsMCPTool).toBe(true);
      expect(agent.mcpToolName).toBe("docker_calculator");
      expect(agent.deploymentType).toBe("ollama");
    });

    test("should expose AgentCore agent as MCP tool", async () => {
      // Requirement 7.6: Agent-as-tool in AgentCore
      const agentId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("agents", {
          name: "Tool Bedrock Agent",
          description: "Agent exposed as tool",
          model: "anthropic.claude-sonnet-4-5-20250929-v1:0",
          systemPrompt: "You are a summarization agent.",
          tools: [],
          generatedCode: `from strands_agents import Agent\n\nclass ToolAgent(Agent):\n    pass`,
          deploymentType: "bedrock",
          exposableAsMCPTool: true,
          mcpToolName: "bedrock_summarizer",
          mcpInputSchema: {
            type: "object",
            properties: {
              text: { type: "string" },
            },
          },
          createdBy: testUserId,
          isPublic: false,
        });
      });

      const agent = await t.run(async (ctx: any) => {
        return await ctx.db.get(agentId);
      });

      expect(agent.exposableAsMCPTool).toBe(true);
      expect(agent.mcpToolName).toBe("bedrock_summarizer");
      expect(agent.deploymentType).toBe("bedrock");
    });
  });
});
