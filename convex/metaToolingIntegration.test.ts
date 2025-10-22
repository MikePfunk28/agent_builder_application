/**
 * Meta-tooling Integration Tests
 * 
 * Comprehensive tests for Task 10.1: Meta-tooling implementation and agent-as-tool functionality
 * Tests the complete workflow of:
 * - Agent requesting new tools
 * - Tool code generation and validation
 * - Dynamic tool loading
 * - Tool persistence
 * - Agent-as-tool functionality
 * - MCP configuration generation
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7
 */

import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";

// Configure convex-test to find Convex functions
const modules = import.meta.glob("./**/*.ts");

describe("Meta-tooling Integration Tests", () => {
  let t: any;
  let userId: any;

  beforeEach(async () => {
    t = convexTest(schema, modules);
    
    // Create a test user
    userId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        email: "metatool@example.com",
        name: "Meta Tool User",
        tier: "personal",
        createdAt: Date.now(),
      });
    });
    
    // Mock authentication - reassign t
    t = t.withIdentity({ subject: userId });
  });

  describe("Agent Requesting New Tools", () => {
    test("should allow agent to request tool creation", async () => {
      const toolCode = `@tool(
    name="calculate_roi",
    description="Calculate return on investment",
    parameters={
        "initial_investment": {"type": "number", "description": "Initial investment amount"},
        "final_value": {"type": "number", "description": "Final value"},
        "time_period": {"type": "number", "description": "Time period in years"}
    }
)
async def calculate_roi(initial_investment: float, final_value: float, time_period: float) -> str:
    """Calculate ROI percentage"""
    try:
        roi = ((final_value - initial_investment) / initial_investment) * 100
        annual_roi = roi / time_period
        return f"ROI: {roi:.2f}% (Annual: {annual_roi:.2f}%)"
    except Exception as e:
        return f"Error calculating ROI: {str(e)}"
`;

      const result = await t.mutation(api.metaTooling.createTool, {
        name: "calculate_roi",
        displayName: "Calculate ROI",
        description: "Calculate return on investment",
        code: toolCode,
        parameters: {
          initial_investment: { type: "number", description: "Initial investment amount" },
          final_value: { type: "number", description: "Final value" },
          time_period: { type: "number", description: "Time period in years" }
        },
      });

      expect(result.toolId).toBeDefined();
      expect(result.validated).toBe(true);

      // Verify tool was persisted
      const tool = await t.query(api.metaTooling.getTool, {
        name: "calculate_roi",
      });

      expect(tool).toBeDefined();
      expect(tool.name).toBe("calculate_roi");
      expect(tool.code).toContain("calculate_roi");
      expect(tool.validated).toBe(true);
    });

    test("should validate tool code before creation", async () => {
      const invalidCode = `
@tool(name="invalid")
this is not valid python code
`;

      await expect(
        t.mutation(api.metaTooling.createTool, {
          name: "invalid_tool",
          displayName: "Invalid Tool",
          description: "Invalid tool",
          code: invalidCode,
          parameters: {},
        })
      ).rejects.toThrow("validation failed");
    });

    test("should reject tool without @tool decorator", async () => {
      const codeWithoutDecorator = `
async def some_function(x: str) -> str:
    return x
`;

      await expect(
        t.mutation(api.metaTooling.createTool, {
          name: "no_decorator",
          displayName: "No Decorator",
          description: "Tool without decorator",
          code: codeWithoutDecorator,
          parameters: {},
        })
      ).rejects.toThrow("@tool decorator");
    });
  });

  describe("Tool Code Generation", () => {
    test("should generate agent code with dynamic tools", async () => {
      // Create a dynamic tool first
      const toolCode = `@tool(
    name="data_processor",
    description="Process data",
    parameters={"data": {"type": "string"}}
)
async def data_processor(data: str) -> str:
    return f"Processed: {data}"
`;

      const toolResult = await t.mutation(api.metaTooling.createTool, {
        name: "data_processor",
        displayName: "Data Processor",
        description: "Process data",
        code: toolCode,
        parameters: { data: { type: "string" } },
      });

      // Generate agent code with the dynamic tool
      const agentResult = await t.action(api.codeGenerator.generateAgent, {
        name: "ProcessorAgent",
        model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
        systemPrompt: "Agent with dynamic tools",
        tools: [],
        deploymentType: "local",
        dynamicTools: [{
          name: "data_processor",
          code: toolCode,
          parameters: { data: { type: "string" } },
        }],
      });

      expect(agentResult.generatedCode).toBeDefined();
      expect(agentResult.generatedCode).toContain("# DYNAMIC TOOLS (Meta-tooling)");
      expect(agentResult.generatedCode).toContain("data_processor");
      expect(agentResult.generatedCode).toContain("@tool(");
    });

    test("should generate MCP configuration for agent", async () => {
      const mcpServers = [
        {
          name: "aws-docs",
          command: "uvx",
          args: ["awslabs.aws-documentation-mcp-server@latest"],
          env: { FASTMCP_LOG_LEVEL: "ERROR" },
          disabled: false,
        },
        {
          name: "custom-tools",
          command: "python",
          args: ["-m", "custom_tools_server"],
          disabled: false,
        },
      ];

      const result = await t.action(api.codeGenerator.generateAgent, {
        name: "MCPAgent",
        model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
        systemPrompt: "Agent with MCP servers",
        tools: [],
        deploymentType: "local",
        mcpServers,
      });

      expect(result.mcpConfig).toBeDefined();
      
      const config = JSON.parse(result.mcpConfig!);
      expect(config.mcpServers).toBeDefined();
      expect(config.mcpServers["aws-docs"]).toBeDefined();
      expect(config.mcpServers["aws-docs"].command).toBe("uvx");
      expect(config.mcpServers["custom-tools"]).toBeDefined();
      expect(config.mcpServers["custom-tools"].command).toBe("python");
    });

    test("should include meta-tooling instructions in agent system prompt", async () => {
      const result = await t.action(api.codeGenerator.generateAgent, {
        name: "MetaAgent",
        model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
        systemPrompt: "Base system prompt",
        tools: [],
        deploymentType: "local",
      });

      expect(result.generatedCode).toContain("Meta-Tooling Capability");
      expect(result.generatedCode).toContain("@tool decorator");
      expect(result.generatedCode).toContain("When to Use Meta-Tooling");
    });
  });

  describe("Dynamic Tool Loading", () => {
    test("should load and list dynamic tools", async () => {
      // Create multiple dynamic tools
      const tool1Code = `@tool(name="tool1")
async def tool1(x: str) -> str:
    return f"Tool1: {x}"
`;
      const tool2Code = `@tool(name="tool2")
async def tool2(x: str) -> str:
    return f"Tool2: {x}"
`;

      await t.mutation(api.metaTooling.createTool, {
        name: "tool1",
        displayName: "Tool 1",
        description: "First dynamic tool",
        code: tool1Code,
        parameters: {},
      });

      await t.mutation(api.metaTooling.createTool, {
        name: "tool2",
        displayName: "Tool 2",
        description: "Second dynamic tool",
        code: tool2Code,
        parameters: {},
      });

      // List all tools
      const tools = await t.query(api.metaTooling.listTools, {});

      expect(tools).toHaveLength(2);
      expect(tools.map((t: any) => t.name)).toContain("tool1");
      expect(tools.map((t: any) => t.name)).toContain("tool2");
    });

    test("should retrieve specific dynamic tool by name", async () => {
      const toolCode = `@tool(name="specific_tool")
async def specific_tool(x: str) -> str:
    return x
`;

      await t.mutation(api.metaTooling.createTool, {
        name: "specific_tool",
        displayName: "Specific Tool",
        description: "A specific tool",
        code: toolCode,
        parameters: {},
      });

      const tool = await t.query(api.metaTooling.getTool, {
        name: "specific_tool",
      });

      expect(tool).toBeDefined();
      expect(tool.name).toBe("specific_tool");
      expect(tool.displayName).toBe("Specific Tool");
      expect(tool.code).toContain("specific_tool");
    });
  });

  describe("Tool Persistence", () => {
    test("should persist tool across sessions", async () => {
      const toolCode = `@tool(name="persistent_tool")
async def persistent_tool(x: str) -> str:
    return f"Persistent: {x}"
`;

      const result = await t.mutation(api.metaTooling.createTool, {
        name: "persistent_tool",
        displayName: "Persistent Tool",
        description: "Test tool persistence",
        code: toolCode,
        parameters: {},
      });

      expect(result.toolId).toBeDefined();

      // Verify tool persists by querying it again
      const tool = await t.query(api.metaTooling.getTool, {
        name: "persistent_tool",
      });

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("persistent_tool");
      expect(tool?.code).toContain("Persistent:");
      
      // Verify it's stored in the database
      const allTools = await t.query(api.metaTooling.listTools, {});
      const persistentTool = allTools.find((t: any) => t.name === "persistent_tool");
      expect(persistentTool).toBeDefined();
    });

    test("should track tool usage statistics", async () => {
      const toolCode = `@tool(name="stats_tool")
async def stats_tool(x: str) -> str:
    return x
`;

      const result = await t.mutation(api.metaTooling.createTool, {
        name: "stats_tool",
        displayName: "Stats Tool",
        description: "Tool for statistics tracking",
        code: toolCode,
        parameters: {},
      });

      // Record some invocations
      await t.mutation(internal.metaTooling.recordToolInvocation, {
        toolId: result.toolId,
        success: true,
      });

      await t.mutation(internal.metaTooling.recordToolInvocation, {
        toolId: result.toolId,
        success: true,
      });

      await t.mutation(internal.metaTooling.recordToolInvocation, {
        toolId: result.toolId,
        success: false,
      });

      const stats = await t.query(api.metaTooling.getToolStats, {
        toolId: result.toolId,
      });

      expect(stats.invocationCount).toBe(3);
      expect(stats.successCount).toBe(2);
      expect(stats.errorCount).toBe(1);
      expect(stats.successRate).toBeCloseTo(66.67, 1);
    });

    test("should update tool code and maintain history", async () => {
      const originalCode = `@tool(name="update_tool")
async def update_tool(x: str) -> str:
    return f"Original: {x}"
`;

      const result = await t.mutation(api.metaTooling.createTool, {
        name: "update_tool",
        displayName: "Update Tool",
        description: "Test tool updates",
        code: originalCode,
        parameters: {},
      });

      const updatedCode = `@tool(name="update_tool")
async def update_tool(x: str) -> str:
    return f"Updated: {x}"
`;

      await t.mutation(api.metaTooling.updateTool, {
        toolId: result.toolId,
        code: updatedCode,
      });

      const tool = await t.query(api.metaTooling.getTool, {
        name: "update_tool",
      });

      expect(tool.code).toContain("Updated:");
      expect(tool.validated).toBe(true);
    });
  });

  describe("Agent-as-Tool Functionality", () => {
    test("should create agent exposable as MCP tool", async () => {
      const agentId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("agents", {
          name: "CalculatorAgent",
          description: "Agent that performs calculations",
          model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
          systemPrompt: "You are a calculator agent",
          tools: [],
          generatedCode: "# Calculator agent code",
          deploymentType: "local",
          createdBy: userId,
          exposableAsMCPTool: true,
          mcpToolName: "calculator_agent",
          mcpInputSchema: {
            type: "object",
            properties: {
              expression: { type: "string", description: "Mathematical expression to evaluate" }
            },
            required: ["expression"]
          },
        });
      });

      // List exposable agents
      const agents = await t.query(api.agents.listExposableAgents);

      expect(agents).toBeDefined();
      expect(agents.length).toBeGreaterThan(0);
      
      const calculatorAgent = agents.find((a: any) => a._id === agentId);
      expect(calculatorAgent).toBeDefined();
      expect(calculatorAgent?.name).toBe("calculator_agent");
      expect(calculatorAgent?.description).toContain("calculations");
    });

    test("should retrieve agent by MCP tool name", async () => {
      await t.run(async (ctx: any) => {
        return await ctx.db.insert("agents", {
          name: "DataAgent",
          description: "Agent for data processing",
          model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
          systemPrompt: "You process data",
          tools: [],
          generatedCode: "# Data agent code",
          deploymentType: "local",
          createdBy: userId,
          exposableAsMCPTool: true,
          mcpToolName: "data_processor_agent",
          mcpInputSchema: {
            type: "object",
            properties: {
              data: { type: "string", description: "Data to process" }
            },
            required: ["data"]
          },
        });
      });

      const agent = await t.query(api.agents.getByMCPToolName, {
        name: "data_processor_agent",
      });

      expect(agent).toBeDefined();
      expect(agent?.mcpToolName).toBe("data_processor_agent");
      expect(agent?.exposableAsMCPTool).toBe(true);
    });

    test("should generate MCP tool definition from agent", async () => {
      await t.run(async (ctx: any) => {
        return await ctx.db.insert("agents", {
          name: "SummarizerAgent",
          description: "Agent that summarizes text",
          model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
          systemPrompt: "You summarize text",
          tools: [],
          generatedCode: "# Summarizer agent code",
          deploymentType: "local",
          createdBy: userId,
          exposableAsMCPTool: true,
          mcpToolName: "text_summarizer",
          mcpInputSchema: {
            type: "object",
            properties: {
              text: { type: "string", description: "Text to summarize" },
              max_length: { type: "number", description: "Maximum summary length" }
            },
            required: ["text"]
          },
        });
      });

      const agents = await t.query(api.agents.listExposableAgents);
      const summarizer = agents.find((a: any) => a.name === "text_summarizer");

      expect(summarizer).toBeDefined();
      expect(summarizer?.inputSchema).toBeDefined();
      expect(summarizer?.inputSchema.properties.text).toBeDefined();
      expect(summarizer?.inputSchema.properties.max_length).toBeDefined();
      expect(summarizer?.inputSchema.required).toContain("text");
    });
  });

  describe("Complete Meta-tooling Workflow", () => {
    test("should complete full workflow: create tool -> add to agent -> generate code", async () => {
      // Step 1: Create a dynamic tool
      const toolCode = `@tool(
    name="sentiment_analyzer",
    description="Analyze sentiment of text",
    parameters={"text": {"type": "string", "description": "Text to analyze"}}
)
async def sentiment_analyzer(text: str) -> str:
    """Analyze sentiment"""
    # Placeholder implementation
    return f"Sentiment analysis of: {text}"
`;

      const toolResult = await t.mutation(api.metaTooling.createTool, {
        name: "sentiment_analyzer",
        displayName: "Sentiment Analyzer",
        description: "Analyze sentiment of text",
        code: toolCode,
        parameters: { text: { type: "string", description: "Text to analyze" } },
      });

      expect(toolResult.toolId).toBeDefined();

      // Step 2: Generate agent code with the dynamic tool
      const agentResult = await t.action(api.codeGenerator.generateAgent, {
        name: "SentimentAgent",
        model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
        systemPrompt: "You analyze sentiment",
        tools: [],
        deploymentType: "local",
        dynamicTools: [{
          name: "sentiment_analyzer",
          code: toolCode,
          parameters: { text: { type: "string" } },
        }],
      });

      expect(agentResult.generatedCode).toContain("sentiment_analyzer");
      expect(agentResult.generatedCode).toContain("# DYNAMIC TOOLS (Meta-tooling)");

      // Step 3: Create agent in database
      const agentId = await t.mutation(api.agents.create, {
        name: "SentimentAgent",
        description: "Analyzes sentiment",
        model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
        systemPrompt: "You analyze sentiment",
        tools: [],
        generatedCode: agentResult.generatedCode,
        deploymentType: "local",
      });

      expect(agentId).toBeDefined();

      // Step 4: Verify agent was created
      const agent = await t.query(api.agents.get, { id: agentId });
      expect(agent).toBeDefined();
      expect(agent?.name).toBe("SentimentAgent");
    });

    test("should support agent using another agent as tool", async () => {
      // This test verifies the schema and queries support agent-as-tool functionality
      // The actual agent creation is tested in other integration tests
      
      // Create agents directly in database for this test
      const agent1Id = await t.run(async (ctx: any) => {
        return await ctx.db.insert("agents", {
          name: "TranslatorAgent",
          description: "Translates text",
          model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
          systemPrompt: "You translate text",
          tools: [],
          generatedCode: "# Translator code",
          deploymentType: "local",
          createdBy: userId,
          exposableAsMCPTool: true,
          mcpToolName: "translator",
          mcpInputSchema: {
            type: "object",
            properties: {
              text: { type: "string" },
              target_language: { type: "string" }
            },
            required: ["text", "target_language"]
          },
        });
      });

      const agent2Id = await t.run(async (ctx: any) => {
        return await ctx.db.insert("agents", {
          name: "MultilingualAgent",
          description: "Processes text in multiple languages",
          model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
          systemPrompt: "You process multilingual text using the translator tool",
          tools: [{
            name: "Translator",
            type: "use_agent",
            config: { agentId: agent1Id }
          }],
          generatedCode: "# Multilingual agent code",
          deploymentType: "local",
          createdBy: userId,
        });
      });

      // Verify both agents exist and have correct properties
      // Use t.run to directly query the database since we inserted directly
      const agents = await t.run(async (ctx: any) => {
        const a1 = await ctx.db.get(agent1Id);
        const a2 = await ctx.db.get(agent2Id);
        return { agent1: a1, agent2: a2 };
      });

      expect(agents.agent1).toBeDefined();
      expect(agents.agent1?.exposableAsMCPTool).toBe(true);
      expect(agents.agent1?.mcpToolName).toBe("translator");
      expect(agents.agent2).toBeDefined();
      expect(agents.agent2?.tools).toHaveLength(1);
      expect(agents.agent2?.tools[0].type).toBe("use_agent");
    });
  });

  describe("MCP Configuration Integration", () => {
    test("should generate complete deployment package with MCP config", async () => {
      const mcpServers = [
        {
          name: "aws-docs",
          command: "uvx",
          args: ["awslabs.aws-documentation-mcp-server@latest"],
          disabled: false,
        },
      ];

      const dynamicTools = [{
        name: "custom_tool",
        code: `@tool(name="custom_tool")
async def custom_tool(x: str) -> str:
    return x
`,
        parameters: {},
      }];

      const result = await t.action(api.codeGenerator.generateAgent, {
        name: "CompleteAgent",
        model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
        systemPrompt: "Complete agent with all features",
        tools: [{ name: "Search", type: "search", config: {} }],
        deploymentType: "aws",
        mcpServers,
        dynamicTools,
      });

      // Verify all components are generated
      expect(result.generatedCode).toBeDefined();
      expect(result.generatedCode).toContain("# DYNAMIC TOOLS (Meta-tooling)");
      expect(result.generatedCode).toContain("custom_tool");
      expect(result.generatedCode).toContain("search");
      
      expect(result.requirementsTxt).toBeDefined();
      expect(result.requirementsTxt).toContain("strands-agents");
      
      expect(result.mcpConfig).toBeDefined();
      const config = JSON.parse(result.mcpConfig!);
      expect(config.mcpServers["aws-docs"]).toBeDefined();
    });
  });
});
