/**
 * Agent Code Generation Tests
 * 
 * Tests for Task 4: @agent and @tool Decorator Implementation
 * Validates that generated agent code includes proper decorators,
 * preprocessing/postprocessing hooks, and tool configurations.
 * 
 * Requirements: 2.1-2.7, 8.1-8.7, 10.1-10.4
 */

import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

describe("Agent Code Generation with @agent Decorator", () => {
  test("should generate agent code with @agent decorator", async () => {
    const t = convexTest(schema, modules);

    // Create test agent
    const agentConfig = {
      name: "TestAgent",
      description: "Test agent for decorator validation",
      model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      systemPrompt: "You are a helpful test agent",
      tools: [
        {
          name: "search",
          type: "search",
          config: {},
        }
      ],
      deploymentType: "aws",
      isPublic: false,
    };

    // Generate agent code
    const result = await t.action(api.codeGenerator.generateAgent, {
      name: agentConfig.name,
      model: agentConfig.model,
      systemPrompt: agentConfig.systemPrompt,
      tools: agentConfig.tools,
      deploymentType: agentConfig.deploymentType,
    });

    expect(result).toBeDefined();
    expect(result.generatedCode).toBeDefined();
    
    // Verify @agent decorator is present
    expect(result.generatedCode).toContain("@agent(");
    expect(result.generatedCode).toContain('model="anthropic.claude-3-5-sonnet-20241022-v2:0"');
    expect(result.generatedCode).toContain('system_prompt="""You are a helpful test agent"""');
  });

  test("should include preprocessing hook in generated code", async () => {
    const t = convexTest(schema, modules);

    const result = await t.action(api.codeGenerator.generateAgent, {
      name: "PreprocessTest",
      model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      systemPrompt: "Test preprocessing",
      tools: [],
      deploymentType: "local",
    });

    const code = result.generatedCode;
    
    // Verify preprocessing function exists
    expect(code).toContain("async def preprocess_message");
    expect(code).toContain("Pre-process incoming messages before agent processing");
    
    // Verify preprocessing is registered in decorator
    expect(code).toContain("preprocess=preprocess_message");
    
    // Verify preprocessing logic
    expect(code).toContain("logger.info(f\"Pre-processing message:");
    expect(code).toContain("context['received_at']");
  });

  test("should include postprocessing hook in generated code", async () => {
    const t = convexTest(schema, modules);

    const result = await t.action(api.codeGenerator.generateAgent, {
      name: "PostprocessTest",
      model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      systemPrompt: "Test postprocessing",
      tools: [],
      deploymentType: "local",
    });

    const code = result.generatedCode;
    
    // Verify postprocessing function exists
    expect(code).toContain("async def postprocess_response");
    expect(code).toContain("Post-process agent responses before returning to user");
    
    // Verify postprocessing is registered in decorator
    expect(code).toContain("postprocess=postprocess_response");
    
    // Verify postprocessing logic
    expect(code).toContain("logger.info(f\"Post-processing response:");
    expect(code).toContain("processing_time");
  });

  test("should include tools in @agent decorator", async () => {
    const t = convexTest(schema, modules);

    const tools = [
      { name: "Search", type: "search", config: {} },
      { name: "Calculator", type: "calculator", config: {} },
      { name: "File Read", type: "file_read", config: {} },
    ];

    const result = await t.action(api.codeGenerator.generateAgent, {
      name: "MultiToolAgent",
      model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      systemPrompt: "Agent with multiple tools",
      tools,
      deploymentType: "local",
    });

    const code = result.generatedCode;
    
    // Verify tools are listed in decorator
    expect(code).toContain("tools=[search, calculator, file_read]");
  });

  test("should include memory and reasoning configuration", async () => {
    const t = convexTest(schema, modules);

    const result = await t.action(api.codeGenerator.generateAgent, {
      name: "ReasoningAgent",
      model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      systemPrompt: "Agent with reasoning",
      tools: [],
      deploymentType: "local",
    });

    const code = result.generatedCode;
    
    // Verify memory and reasoning are configured
    expect(code).toContain("memory=True");
    expect(code).toContain('reasoning="interleaved"');
  });

  test("should include container setup in @agent decorator", async () => {
    const t = convexTest(schema, modules);

    const result = await t.action(api.codeGenerator.generateAgent, {
      name: "ContainerAgent",
      model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      systemPrompt: "Agent with container setup",
      tools: [],
      deploymentType: "docker",
    });

    const code = result.generatedCode;
    
    // Verify container setup
    expect(code).toContain("container_setup={");
    expect(code).toContain('"base_image": "python:3.11-slim"');
    expect(code).toContain('"system_packages": ["gcc", "g++"]');
    expect(code).toContain('"environment_vars"');
  });

  test("should generate async agent methods", async () => {
    const t = convexTest(schema, modules);

    const result = await t.action(api.codeGenerator.generateAgent, {
      name: "AsyncAgent",
      model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      systemPrompt: "Async agent",
      tools: [],
      deploymentType: "local",
    });

    const code = result.generatedCode;
    
    // Verify async methods
    expect(code).toContain("async def run(self, message: str");
    expect(code).toContain("async def stream_response(self, message: str");
    expect(code).toContain("await preprocess_message");
    expect(code).toContain("await postprocess_response");
  });
});

describe("Agent Code Generation with @tool Decorator", () => {
  test("should import @tool decorator from strandsagents", async () => {
    const t = convexTest(schema, modules);

    const result = await t.action(api.codeGenerator.generateAgent, {
      name: "ToolImportTest",
      model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      systemPrompt: "Test tool imports",
      tools: [{ name: "search", type: "search", config: {} }],
      deploymentType: "local",
    });

    const code = result.generatedCode;
    
    // Verify tool import
    expect(code).toContain("from strandsagents import agent, Agent, tool");
  });

  test("should generate custom tool with @tool decorator", async () => {
    const t = convexTest(schema, modules);

    const customTool = {
      name: "CustomCalculator",
      type: "custom_calculator",
      config: {
        description: "Performs custom calculations",
        parameters: [
          { name: "expression", type: "str", description: "Math expression", required: true },
          { name: "precision", type: "int", description: "Decimal precision", required: false },
        ],
      },
    };

    const result = await t.action(api.codeGenerator.generateAgent, {
      name: "CustomToolAgent",
      model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      systemPrompt: "Agent with custom tool",
      tools: [customTool],
      deploymentType: "local",
    });

    const code = result.generatedCode;
    
    // Verify @tool decorator for custom tool
    expect(code).toContain("@tool(");
    expect(code).toContain('name="CustomCalculator"');
    expect(code).toContain('description="Performs custom calculations"');
    expect(code).toContain("parameters=");
  });

  test("should generate tool parameter schema", async () => {
    const t = convexTest(schema, modules);

    const customTool = {
      name: "DataProcessor",
      type: "data_processor",
      config: {
        description: "Processes data",
        parameters: [
          { name: "data", type: "str", description: "Input data", required: true },
          { name: "format", type: "str", description: "Output format", required: false },
        ],
      },
    };

    const result = await t.action(api.codeGenerator.generateAgent, {
      name: "DataAgent",
      model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      systemPrompt: "Data processing agent",
      tools: [customTool],
      deploymentType: "local",
    });

    const code = result.generatedCode;
    
    // Verify parameter schema
    expect(code).toContain('"data"');
    expect(code).toContain('"type": "str"');
    expect(code).toContain('"description": "Input data"');
    expect(code).toContain('"format"');
  });

  test("should not generate @tool decorator for built-in tools", async () => {
    const t = convexTest(schema, modules);

    const builtInTools = [
      { name: "Search", type: "search", config: {} },
      { name: "Calculator", type: "calculator", config: {} },
      { name: "File Read", type: "file_read", config: {} },
    ];

    const result = await t.action(api.codeGenerator.generateAgent, {
      name: "BuiltInToolsAgent",
      model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      systemPrompt: "Agent with built-in tools",
      tools: builtInTools,
      deploymentType: "local",
    });

    const code = result.generatedCode;
    
    // Verify built-in tools are imported, not defined with @tool
    expect(code).toContain("from strandsagents.tools import (");
    expect(code).toContain("search");
    expect(code).toContain("calculator");
    expect(code).toContain("file_read");
    
    // Should not have custom @tool definitions for these
    const toolDecorators = (code.match(/@tool\(/g) || []).length;
    expect(toolDecorators).toBe(0); // No custom tools, so no @tool decorators
  });

  test("should generate async tool functions", async () => {
    const t = convexTest(schema, modules);

    const customTool = {
      name: "AsyncTool",
      type: "async_tool",
      config: {
        description: "Async tool function",
        parameters: [{ name: "input", type: "str", description: "Input", required: true }],
      },
    };

    const result = await t.action(api.codeGenerator.generateAgent, {
      name: "AsyncToolAgent",
      model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      systemPrompt: "Agent with async tool",
      tools: [customTool],
      deploymentType: "local",
    });

    const code = result.generatedCode;
    
    // Verify async tool function
    expect(code).toContain("async def async_tool");
    expect(code).toContain("-> str:");
  });
});

describe("Requirements.txt Generation", () => {
  test("should generate requirements.txt with base packages", async () => {
    const t = convexTest(schema, modules);

    const result = await t.action(api.codeGenerator.generateAgent, {
      name: "RequirementsTest",
      model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      systemPrompt: "Test requirements",
      tools: [],
      deploymentType: "local",
    });

    expect(result.requirementsTxt).toBeDefined();
    
    // Verify base packages
    expect(result.requirementsTxt).toContain("strands-agents>=1.0.0");
    expect(result.requirementsTxt).toContain("strands-agents-tools>=1.0.0");
    expect(result.requirementsTxt).toContain("opentelemetry-api>=1.0.0");
    expect(result.requirementsTxt).toContain("opentelemetry-sdk>=1.0.0");
  });

  test("should include tool-specific packages in requirements", async () => {
    const t = convexTest(schema, modules);

    const tools = [
      {
        name: "Browser",
        type: "browser",
        config: {},
        extrasPip: "browser",
      },
      {
        name: "S3",
        type: "s3",
        config: {},
        extrasPip: "aws",
      },
    ];

    const result = await t.action(api.codeGenerator.generateAgent, {
      name: "ToolPackagesAgent",
      model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      systemPrompt: "Agent with tool packages",
      tools,
      deploymentType: "aws",
    });

    const requirements = result.requirementsTxt;
    
    // Verify tool extras
    expect(requirements).toContain("strands-agents-tools[browser]");
    expect(requirements).toContain("strands-agents-tools[aws]");
  });

  test("should include custom pip packages from tools", async () => {
    const t = convexTest(schema, modules);

    const tools = [
      {
        name: "CustomTool",
        type: "custom",
        config: {},
        pipPackages: ["pandas>=2.0.0", "numpy>=1.24.0"],
      },
    ];

    const result = await t.action(api.codeGenerator.generateAgent, {
      name: "CustomPackagesAgent",
      model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      systemPrompt: "Agent with custom packages",
      tools,
      deploymentType: "local",
    });

    const requirements = result.requirementsTxt;
    
    // Verify custom packages
    expect(requirements).toContain("pandas>=2.0.0");
    expect(requirements).toContain("numpy>=1.24.0");
  });
});

describe("Environment Variables in Generated Code", () => {
  test("should include environment variables in container setup", async () => {
    const t = convexTest(schema, modules);

    const result = await t.action(api.codeGenerator.generateAgent, {
      name: "EnvVarAgent",
      model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      systemPrompt: "Agent with env vars",
      tools: [],
      deploymentType: "docker",
    });

    const code = result.generatedCode;
    
    // Verify environment variables
    expect(code).toContain('"LOG_LEVEL": "INFO"');
    expect(code).toContain('"AGENT_NAME": "EnvVarAgent"');
  });

  test("should include AWS environment variables for AWS deployment", async () => {
    const t = convexTest(schema, modules);

    const result = await t.action(api.codeGenerator.generateAgent, {
      name: "AWSAgent",
      model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      systemPrompt: "AWS agent",
      tools: [],
      deploymentType: "aws",
    });

    const code = result.generatedCode;
    
    // Verify AWS imports and configuration
    expect(code).toContain("import boto3");
    expect(code).toContain("from botocore.config import Config");
    expect(code).toContain('region_name=os.getenv("AWS_REGION"');
  });
});

describe("Multiple Tool Combinations", () => {
  test("should handle mix of built-in and custom tools", async () => {
    const t = convexTest(schema, modules);

    const tools = [
      { name: "Search", type: "search", config: {} },
      { name: "Calculator", type: "calculator", config: {} },
      {
        name: "CustomAnalyzer",
        type: "custom_analyzer",
        config: {
          description: "Custom analysis tool",
          parameters: [{ name: "data", type: "str", description: "Data to analyze", required: true }],
        },
      },
    ];

    const result = await t.action(api.codeGenerator.generateAgent, {
      name: "MixedToolsAgent",
      model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      systemPrompt: "Agent with mixed tools",
      tools,
      deploymentType: "local",
    });

    const code = result.generatedCode;
    
    // Verify built-in tools are imported
    expect(code).toContain("from strandsagents.tools import (");
    expect(code).toContain("search");
    expect(code).toContain("calculator");
    
    // Verify custom tool has @tool decorator
    expect(code).toContain("@tool(");
    expect(code).toContain('name="CustomAnalyzer"');
    
    // Verify all tools are in agent decorator
    expect(code).toContain("tools=[search, calculator, custom_analyzer]");
  });

  test("should generate valid Python syntax for all tool combinations", async () => {
    const t = convexTest(schema, modules);

    const tools = [
      { name: "File Read", type: "file_read", config: {} },
      { name: "File Write", type: "file_write", config: {} },
      { name: "HTTP Request", type: "http_request", config: {} },
      { name: "Browser", type: "browser", config: {}, extrasPip: "browser" },
    ];

    const result = await t.action(api.codeGenerator.generateAgent, {
      name: "MultiToolSyntaxAgent",
      model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      systemPrompt: "Multi-tool agent",
      tools,
      deploymentType: "local",
    });

    const code = result.generatedCode;
    
    // Basic syntax checks
    expect(code).toContain("from strandsagents import agent, Agent, tool");
    expect(code).toContain("@agent(");
    expect(code).toContain("class MultiToolSyntaxAgentAgent(Agent):");
    expect(code).toContain("async def run(self");
    
    // Verify no syntax errors in imports
    expect(code).toContain("from strandsagents.tools import (");
    expect(code).toContain("file_read");
    expect(code).toContain("file_write");
    expect(code).toContain("http_request");
    expect(code).toContain("browser");
    expect(code).toContain(")");
  });
});
