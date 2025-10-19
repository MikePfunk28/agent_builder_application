/**
 * Meta-tooling Feature Tests
 * 
 * Tests for dynamic tool creation, validation, and loading
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7
 */

import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";

// Configure convex-test to find Convex functions
const modules = import.meta.glob("./**/*.ts");

describe("Meta-tooling Feature", () => {
  let t: any;
  let userId: any;

  beforeEach(async () => {
    t = convexTest(schema, modules);
    
    // Create a test user
    userId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        email: "test@example.com",
        name: "Test User",
        tier: "personal",
        createdAt: Date.now(),
      });
    });
    
    // Mock authentication
    t.withIdentity({ subject: userId });
  });

  describe("Tool Code Validation", () => {
    test("should validate correct tool code", async () => {
      const validCode = `
@tool(
    name="test_tool",
    description="A test tool",
    parameters={"input": {"type": "string"}}
)
async def test_tool(input: str) -> str:
    """Test tool function"""
    try:
        return f"Processed: {input}"
    except Exception as e:
        return f"Error: {str(e)}"
`;

      const result = await t.action(internal.metaTooling.validateToolCode, {
        code: validCode,
      });

      expect(result.valid).toBe(true);
    });

    test("should reject code without @tool decorator", async () => {
      const invalidCode = `
async def test_tool(input: str) -> str:
    return f"Processed: {input}"
`;

      const result = await t.action(internal.metaTooling.validateToolCode, {
        code: invalidCode,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("@tool decorator");
    });

    test("should reject code without function definition", async () => {
      const invalidCode = `
@tool(name="test")
x = 5
`;

      const result = await t.action(internal.metaTooling.validateToolCode, {
        code: invalidCode,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("function");
    });

    test("should reject code without return statement", async () => {
      const invalidCode = `
@tool(name="test")
async def test_tool(input: str):
    print(input)
`;

      const result = await t.action(internal.metaTooling.validateToolCode, {
        code: invalidCode,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("return");
    });

    test("should reject code with unbalanced parentheses", async () => {
      const invalidCode = `
@tool(name="test"
async def test_tool(input: str) -> str:
    return f"Processed: {input}"
`;

      const result = await t.action(internal.metaTooling.validateToolCode, {
        code: invalidCode,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("parentheses");
    });

    test("should reject code with dangerous operations", async () => {
      const dangerousCode = `
@tool(name="dangerous")
async def dangerous_tool(cmd: str) -> str:
    import os; os.system(cmd)
    return "Executed"
`;

      const result = await t.action(internal.metaTooling.validateToolCode, {
        code: dangerousCode,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("dangerous");
    });
  });

  describe("Tool Creation", () => {
    test("should create a new tool successfully", async () => {
      const toolCode = `
@tool(
    name="calculate_sum",
    description="Calculate sum of two numbers",
    parameters={
        "a": {"type": "number"},
        "b": {"type": "number"}
    }
)
async def calculate_sum(a: float, b: float) -> str:
    """Calculate sum"""
    try:
        result = a + b
        return f"Sum: {result}"
    except Exception as e:
        return f"Error: {str(e)}"
`;

      const result = await t.mutation(api.metaTooling.createTool, {
        name: "calculate_sum",
        displayName: "Calculate Sum",
        description: "Calculate sum of two numbers",
        code: toolCode,
        parameters: {
          a: { type: "number" },
          b: { type: "number" }
        },
      });

      expect(result.toolId).toBeDefined();
      expect(result.validated).toBe(true);
    });

    test("should reject duplicate tool names", async () => {
      const toolCode = `
@tool(name="duplicate_tool")
async def duplicate_tool(input: str) -> str:
    return input
`;

      // Create first tool
      await t.mutation(api.metaTooling.createTool, {
        name: "duplicate_tool",
        displayName: "Duplicate Tool",
        description: "A test tool",
        code: toolCode,
        parameters: {},
      });

      // Try to create duplicate
      await expect(
        t.mutation(api.metaTooling.createTool, {
          name: "duplicate_tool",
          displayName: "Duplicate Tool 2",
          description: "Another test tool",
          code: toolCode,
          parameters: {},
        })
      ).rejects.toThrow("already exists");
    });

    test("should reject invalid tool code during creation", async () => {
      const invalidCode = `
@tool(name="invalid")
this is not valid python
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
  });

  describe("Tool Retrieval", () => {
    test("should list user's tools", async () => {
      // Create multiple tools
      const tool1Code = `
@tool(name="tool1")
async def tool1(x: str) -> str:
    return x
`;
      const tool2Code = `
@tool(name="tool2")
async def tool2(x: str) -> str:
    return x
`;

      await t.mutation(api.metaTooling.createTool, {
        name: "tool1",
        displayName: "Tool 1",
        description: "First tool",
        code: tool1Code,
        parameters: {},
      });

      await t.mutation(api.metaTooling.createTool, {
        name: "tool2",
        displayName: "Tool 2",
        description: "Second tool",
        code: tool2Code,
        parameters: {},
      });

      const tools = await t.query(api.metaTooling.listTools, {});

      expect(tools).toHaveLength(2);
      expect(tools.map((t: any) => t.name)).toContain("tool1");
      expect(tools.map((t: any) => t.name)).toContain("tool2");
    });

    test("should get specific tool by name", async () => {
      const toolCode = `
@tool(name="specific_tool")
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
    });

    test("should return null for non-existent tool", async () => {
      const tool = await t.query(api.metaTooling.getTool, {
        name: "non_existent_tool",
      });

      expect(tool).toBeNull();
    });
  });

  describe("Tool Updates", () => {
    test("should update tool code", async () => {
      const originalCode = `
@tool(name="update_test")
async def update_test(x: str) -> str:
    return f"Original: {x}"
`;

      const result = await t.mutation(api.metaTooling.createTool, {
        name: "update_test",
        displayName: "Update Test",
        description: "Test tool for updates",
        code: originalCode,
        parameters: {},
      });

      const updatedCode = `
@tool(name="update_test")
async def update_test(x: str) -> str:
    return f"Updated: {x}"
`;

      await t.mutation(api.metaTooling.updateTool, {
        toolId: result.toolId,
        code: updatedCode,
      });

      const tool = await t.query(api.metaTooling.getTool, {
        name: "update_test",
      });

      expect(tool.code).toContain("Updated:");
    });

    test("should update tool description", async () => {
      const toolCode = `
@tool(name="desc_test")
async def desc_test(x: str) -> str:
    return x
`;

      const result = await t.mutation(api.metaTooling.createTool, {
        name: "desc_test",
        displayName: "Description Test",
        description: "Original description",
        code: toolCode,
        parameters: {},
      });

      await t.mutation(api.metaTooling.updateTool, {
        toolId: result.toolId,
        description: "Updated description",
      });

      const tool = await t.query(api.metaTooling.getTool, {
        name: "desc_test",
      });

      expect(tool.description).toBe("Updated description");
    });

    test("should deactivate tool", async () => {
      const toolCode = `
@tool(name="deactivate_test")
async def deactivate_test(x: str) -> str:
    return x
`;

      const result = await t.mutation(api.metaTooling.createTool, {
        name: "deactivate_test",
        displayName: "Deactivate Test",
        description: "Test tool for deactivation",
        code: toolCode,
        parameters: {},
      });

      await t.mutation(api.metaTooling.updateTool, {
        toolId: result.toolId,
        isActive: false,
      });

      const tools = await t.query(api.metaTooling.listTools, {});
      expect(tools.find((t: any) => t.name === "deactivate_test")).toBeUndefined();
    });
  });

  describe("Tool Deletion", () => {
    test("should delete tool", async () => {
      const toolCode = `
@tool(name="delete_test")
async def delete_test(x: str) -> str:
    return x
`;

      const result = await t.mutation(api.metaTooling.createTool, {
        name: "delete_test",
        displayName: "Delete Test",
        description: "Test tool for deletion",
        code: toolCode,
        parameters: {},
      });

      await t.mutation(api.metaTooling.deleteTool, {
        toolId: result.toolId,
      });

      const tool = await t.query(api.metaTooling.getTool, {
        name: "delete_test",
      });

      expect(tool).toBeNull();
    });
  });

  describe("Tool Usage Statistics", () => {
    test("should track tool invocations", async () => {
      const toolCode = `
@tool(name="stats_test")
async def stats_test(x: str) -> str:
    return x
`;

      const result = await t.mutation(api.metaTooling.createTool, {
        name: "stats_test",
        displayName: "Stats Test",
        description: "Test tool for statistics",
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
  });

  describe("Agent Template Suggestions", () => {
    test("should suggest data analyst template for data analysis queries", async () => {
      const result = await t.query(api.metaTooling.suggestAgentTemplate, {
        query: "I need to analyze data from a CSV file",
      });

      expect(result).toBeDefined();
      expect(result.templateKey).toBe("data_analyst");
      expect(result.confidence).toBe("high");
    });

    test("should suggest web researcher template for research queries", async () => {
      const result = await t.query(api.metaTooling.suggestAgentTemplate, {
        query: "I need to research information about AI trends",
      });

      expect(result).toBeDefined();
      expect(result.templateKey).toBe("web_researcher");
    });

    test("should suggest code assistant template for coding queries", async () => {
      const result = await t.query(api.metaTooling.suggestAgentTemplate, {
        query: "Help me write code for a REST API",
      });

      expect(result).toBeDefined();
      expect(result.templateKey).toBe("code_assistant");
    });

    test("should return null for queries without matching templates", async () => {
      const result = await t.query(api.metaTooling.suggestAgentTemplate, {
        query: "What is the weather today?",
      });

      expect(result).toBeNull();
    });
  });

  describe("Meta-tooling Instructions", () => {
    test("should provide meta-tooling instructions", async () => {
      const instructions = await t.query(api.metaTooling.getMetaToolingInstructions, {});

      expect(instructions).toBeDefined();
      expect(instructions).toContain("Meta-Tooling Capability");
      expect(instructions).toContain("@tool decorator");
      expect(instructions).toContain("create_tool");
    });

    test("should provide agent templates", async () => {
      const templates = await t.query(api.metaTooling.getAgentTemplates, {});

      expect(templates).toBeDefined();
      expect(templates.data_analyst).toBeDefined();
      expect(templates.web_researcher).toBeDefined();
      expect(templates.code_assistant).toBeDefined();
      expect(templates.automation_specialist).toBeDefined();
      expect(templates.api_integrator).toBeDefined();
    });
  });

  describe("Tool Persistence", () => {
    test("should persist tool across sessions", async () => {
      const toolCode = `
@tool(name="persist_test")
async def persist_test(x: str) -> str:
    return f"Persisted: {x}"
`;

      const result = await t.mutation(api.metaTooling.createTool, {
        name: "persist_test",
        displayName: "Persist Test",
        description: "Test tool persistence",
        code: toolCode,
        parameters: {},
      });

      // Simulate new session by creating new test context
      const t2 = convexTest(schema, modules);
      t2.withIdentity({ subject: userId });

      const tool = await t2.query(api.metaTooling.getTool, {
        name: "persist_test",
      });

      expect(tool).toBeDefined();
      expect(tool.name).toBe("persist_test");
      expect(tool.code).toContain("Persisted:");
    });
  });
});
