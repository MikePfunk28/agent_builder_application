/**
 * Tool Registry - Complete Strands Tools Integration
 *
 * This module provides a comprehensive registry of all 50+ tools from strands-agents-tools
 * with complete metadata including dependencies, platform support, and usage information.
 *
 * Source: https://github.com/strands-agents/tools/tree/main/src/strands_tools
 */

import { action, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Tool category definitions
 */
export type ToolCategory =
  | "rag_memory"
  | "file_operations"
  | "shell_system"
  | "code_interpretation"
  | "web_network"
  | "multimodal"
  | "aws_services"
  | "utilities"
  | "agents_workflows";

/**
 * Complete tool metadata structure
 */
export interface StrandsToolMetadata {
  name: string;
  displayName: string;
  description: string;
  category: ToolCategory;

  // Dependencies
  basePip: string;
  extrasPip?: string;
  additionalPipPackages?: string[];

  // Platform support
  notSupportedOn?: ("windows" | "macos" | "linux")[];

  // Import information
  importPath: string;

  // Documentation
  docsUrl: string;
  exampleUsage: string;
  capabilities: string[];
  requiresAuth?: boolean;
  requiresEnvVars?: string[];
}

/**
 * Complete registry of all Strands Tools
 * Per docs/strandsagents_tools.md
 */
export const STRANDS_TOOLS_REGISTRY: Record<string, StrandsToolMetadata> = {
  // ============================================================================
  // RAG & MEMORY (4 tools)
  // ============================================================================
  retrieve: {
    name: "retrieve",
    displayName: "Retrieve (Bedrock KB RAG)",
    description: "Amazon Bedrock Knowledge Bases retrieval-augmented generation",
    category: "rag_memory",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import retrieve",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "retrieve(query='What is the company policy?', kb_id='KB123')",
    capabilities: ["rag", "knowledge_base", "bedrock"],
    requiresAuth: true,
    requiresEnvVars: ["AWS_REGION"],
  },

  memory: {
    name: "memory",
    displayName: "Memory",
    description: "Agent memory storage in Bedrock Knowledge Base",
    category: "rag_memory",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import memory",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "memory.store('user_preference', 'dark_mode')",
    capabilities: ["memory", "persistence", "bedrock"],
    requiresAuth: true,
    requiresEnvVars: ["AWS_REGION"],
  },

  agent_core_memory: {
    name: "agent_core_memory",
    displayName: "Agent Core Memory",
    description: "Bedrock Agent Core Memory for persistent agent state",
    category: "rag_memory",
    basePip: "strands-agents-tools",
    extrasPip: "agent_core_memory",
    importPath: "from strands_tools import agent_core_memory",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "agent_core_memory.remember('context', 'value')",
    capabilities: ["memory", "agent_core", "persistence"],
    requiresAuth: true,
    requiresEnvVars: ["AWS_REGION"],
  },

  mem0_memory: {
    name: "mem0_memory",
    displayName: "Mem0 Memory",
    description: "Mem0 integration for advanced memory management",
    category: "rag_memory",
    basePip: "strands-agents-tools",
    extrasPip: "mem0_memory",
    importPath: "from strands_tools import mem0_memory",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "mem0_memory.add('conversation_context', data)",
    capabilities: ["memory", "mem0", "semantic_memory"],
    requiresAuth: false,
  },

  // ============================================================================
  // FILE OPERATIONS (3 tools)
  // ============================================================================
  editor: {
    name: "editor",
    displayName: "File Editor",
    description: "Advanced file editing with search, replace, and undo capabilities",
    category: "file_operations",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import editor",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "editor.edit('file.txt', 'old_text', 'new_text')",
    capabilities: ["file_edit", "search", "replace", "undo"],
    requiresAuth: false,
  },

  file_read: {
    name: "file_read",
    displayName: "File Read",
    description: "Read and parse various file formats",
    category: "file_operations",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import file_read",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "file_read('data.csv')",
    capabilities: ["file_read", "parse", "csv", "json", "text"],
    requiresAuth: false,
  },

  file_write: {
    name: "file_write",
    displayName: "File Write",
    description: "Create and modify files with various formats",
    category: "file_operations",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import file_write",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "file_write('output.txt', content)",
    capabilities: ["file_write", "create", "modify"],
    requiresAuth: false,
  },

  // ============================================================================
  // SHELL & SYSTEM (4 tools)
  // ============================================================================
  environment: {
    name: "environment",
    displayName: "Environment Variables",
    description: "Access and manage environment variables",
    category: "shell_system",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import environment",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "environment.get('API_KEY')",
    capabilities: ["env_vars", "config"],
    requiresAuth: false,
  },

  shell: {
    name: "shell",
    displayName: "Shell Commands",
    description: "Execute shell commands securely",
    category: "shell_system",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import shell",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "shell('ls -la')",
    capabilities: ["shell", "command_execution"],
    requiresAuth: false,
  },

  cron: {
    name: "cron",
    displayName: "Task Scheduling",
    description: "Schedule and manage recurring tasks",
    category: "shell_system",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import cron",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "cron.schedule('0 0 * * *', task_function)",
    capabilities: ["scheduling", "cron", "automation"],
    requiresAuth: false,
  },

  use_computer: {
    name: "use_computer",
    displayName: "Computer Use",
    description: "Desktop automation and computer control",
    category: "shell_system",
    basePip: "strands-agents-tools",
    extrasPip: "use_computer",
    importPath: "from strands_tools import use_computer",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "use_computer.click(x=100, y=200)",
    capabilities: ["desktop_automation", "computer_use"],
    requiresAuth: false,
  },

  // ============================================================================
  // CODE INTERPRETATION (2 tools)
  // ============================================================================
  python_repl: {
    name: "python_repl",
    displayName: "Python REPL",
    description: "Execute Python code in REPL environment (NOT SUPPORTED ON WINDOWS)",
    category: "code_interpretation",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    notSupportedOn: ["windows"],
    importPath: "from strands_tools import python_repl",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "python_repl('import pandas as pd; df = pd.DataFrame(data)')",
    capabilities: ["python", "code_execution", "repl"],
    requiresAuth: false,
  },

  code_interpreter: {
    name: "code_interpreter",
    displayName: "Code Interpreter",
    description: "Isolated sandbox for safe code execution",
    category: "code_interpretation",
    basePip: "strands-agents-tools",
    extrasPip: "agent-core-code-interpreter",
    importPath: "from strands_tools import code_interpreter",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "code_interpreter.run('print(\"Hello World\")')",
    capabilities: ["code_execution", "sandbox", "isolation"],
    requiresAuth: false,
  },

  // ============================================================================
  // WEB & NETWORK (5 tools)
  // ============================================================================
  http_request: {
    name: "http_request",
    displayName: "HTTP Request",
    description: "Make HTTP requests and API calls",
    category: "web_network",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    additionalPipPackages: ["requests>=2.31.0"],
    importPath: "from strands_tools import http_request",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "http_request.get('https://api.example.com/data')",
    capabilities: ["http", "api", "rest"],
    requiresAuth: false,
  },

  slack: {
    name: "slack",
    displayName: "Slack Integration",
    description: "Send messages and interact with Slack",
    category: "web_network",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    additionalPipPackages: ["slack-sdk>=3.0.0"],
    importPath: "from strands_tools import slack",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "slack.send_message(channel='#general', text='Hello')",
    capabilities: ["slack", "messaging", "notifications"],
    requiresAuth: true,
    requiresEnvVars: ["SLACK_TOKEN"],
  },

  browser: {
    name: "browser",
    displayName: "Browser Automation",
    description: "Automate web browser interactions",
    category: "web_network",
    basePip: "strands-agents-tools",
    extrasPip: "local_chromium_browser",
    importPath: "from strands_tools import browser",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "browser.navigate('https://example.com')",
    capabilities: ["browser", "automation", "web_scraping"],
    requiresAuth: false,
  },

  agent_core_browser: {
    name: "agent_core_browser",
    displayName: "Agent Core Browser",
    description: "Browser automation via Bedrock Agent Core",
    category: "web_network",
    basePip: "strands-agents-tools",
    extrasPip: "agent_core_browser",
    importPath: "from strands_tools import agent_core_browser",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "agent_core_browser.browse('https://example.com')",
    capabilities: ["browser", "agent_core", "automation"],
    requiresAuth: true,
    requiresEnvVars: ["AWS_REGION"],
  },

  rss: {
    name: "rss",
    displayName: "RSS Feeds",
    description: "Read and parse RSS/Atom feeds",
    category: "web_network",
    basePip: "strands-agents-tools",
    extrasPip: "rss",
    importPath: "from strands_tools import rss",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "rss.parse('https://example.com/feed.xml')",
    capabilities: ["rss", "feeds", "news"],
    requiresAuth: false,
  },

  // ============================================================================
  // MULTI-MODAL (6 tools)
  // ============================================================================
  generate_image_stability: {
    name: "generate_image_stability",
    displayName: "Stability AI Image Generation",
    description: "Generate images using Stability AI",
    category: "multimodal",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import generate_image_stability",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "generate_image_stability(prompt='A sunset over mountains')",
    capabilities: ["image_generation", "stability_ai"],
    requiresAuth: true,
    requiresEnvVars: ["STABILITY_API_KEY"],
  },

  image_reader: {
    name: "image_reader",
    displayName: "Image Analysis",
    description: "Analyze and extract information from images",
    category: "multimodal",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import image_reader",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "image_reader.analyze('image.jpg')",
    capabilities: ["image_analysis", "vision", "ocr"],
    requiresAuth: false,
  },

  generate_image: {
    name: "generate_image",
    displayName: "Bedrock Image Generation",
    description: "Generate images using Amazon Bedrock",
    category: "multimodal",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import generate_image",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "generate_image(prompt='A futuristic city')",
    capabilities: ["image_generation", "bedrock"],
    requiresAuth: true,
    requiresEnvVars: ["AWS_REGION"],
  },

  nova_reels: {
    name: "nova_reels",
    displayName: "Nova Reels Video",
    description: "Generate videos using Amazon Nova Reels",
    category: "multimodal",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import nova_reels",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "nova_reels(prompt='A robot walking')",
    capabilities: ["video_generation", "nova", "bedrock"],
    requiresAuth: true,
    requiresEnvVars: ["AWS_REGION"],
  },

  speak: {
    name: "speak",
    displayName: "Text-to-Speech",
    description: "Convert text to speech audio",
    category: "multimodal",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import speak",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "speak('Hello world')",
    capabilities: ["tts", "audio", "speech"],
    requiresAuth: false,
  },

  diagram: {
    name: "diagram",
    displayName: "Architecture Diagrams",
    description: "Generate architecture and flow diagrams",
    category: "multimodal",
    basePip: "strands-agents-tools",
    extrasPip: "diagram",
    importPath: "from strands_tools import diagram",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "diagram.create_flowchart(nodes, edges)",
    capabilities: ["diagrams", "visualization", "architecture"],
    requiresAuth: false,
  },

  // ============================================================================
  // AWS SERVICES (1 tool)
  // ============================================================================
  use_aws: {
    name: "use_aws",
    displayName: "AWS Service Interaction",
    description: "Interact with various AWS services",
    category: "aws_services",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    additionalPipPackages: ["boto3>=1.28.0"],
    importPath: "from strands_tools import use_aws",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "use_aws.s3_list_buckets()",
    capabilities: ["aws", "cloud", "s3", "lambda", "dynamodb"],
    requiresAuth: true,
    requiresEnvVars: ["AWS_REGION"],
  },

  // ============================================================================
  // UTILITIES (5 tools)
  // ============================================================================
  calculator: {
    name: "calculator",
    displayName: "Calculator",
    description: "Perform mathematical calculations",
    category: "utilities",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import calculator",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "calculator('2 + 2 * 3')",
    capabilities: ["math", "calculation", "arithmetic"],
    requiresAuth: false,
  },

  current_time: {
    name: "current_time",
    displayName: "Current Time",
    description: "Get current date and time information",
    category: "utilities",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import current_time",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "current_time(timezone='US/Eastern')",
    capabilities: ["time", "date", "timezone"],
    requiresAuth: false,
  },

  load_tool: {
    name: "load_tool",
    displayName: "Dynamic Tool Loading",
    description: "Load tools dynamically at runtime",
    category: "utilities",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import load_tool",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "load_tool('custom_tool.py')",
    capabilities: ["dynamic_loading", "extensibility"],
    requiresAuth: false,
  },

  sleep: {
    name: "sleep",
    displayName: "Sleep/Pause",
    description: "Pause execution for specified duration",
    category: "utilities",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import sleep",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "sleep(seconds=5)",
    capabilities: ["timing", "delay", "pause"],
    requiresAuth: false,
  },

  // ============================================================================
  // AGENTS & WORKFLOWS (15 tools) - CRITICAL FOR ADVANCED FEATURES
  // ============================================================================
  graph: {
    name: "graph",
    displayName: "Multi-Agent Graph",
    description: "Create and execute multi-agent graph systems",
    category: "agents_workflows",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import graph",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "graph.create(nodes=[agent1, agent2], edges=[(0,1)])",
    capabilities: ["graph", "multi_agent", "coordination"],
    requiresAuth: false,
  },

  agent_graph: {
    name: "agent_graph",
    displayName: "Agent Graph",
    description: "Build complex agent graphs with dependencies",
    category: "agents_workflows",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import agent_graph",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "agent_graph.build(agents, dependencies)",
    capabilities: ["graph", "agent_orchestration"],
    requiresAuth: false,
  },

  journal: {
    name: "journal",
    displayName: "Task Journal",
    description: "Structured logging for agent tasks and decisions",
    category: "agents_workflows",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import journal",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "journal.log('Completed task X', metadata={...})",
    capabilities: ["logging", "tracking", "audit"],
    requiresAuth: false,
  },

  swarm: {
    name: "swarm",
    displayName: "Agent Swarm",
    description: "Coordinate multiple agents in a swarm pattern",
    category: "agents_workflows",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import swarm",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "swarm.create(agents=[agent1, agent2], strategy='parallel')",
    capabilities: ["swarm", "parallel", "coordination"],
    requiresAuth: false,
  },

  stop: {
    name: "stop",
    displayName: "Force Stop",
    description: "Force stop the event loop and halt execution",
    category: "agents_workflows",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import stop",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "stop(reason='Task completed')",
    capabilities: ["control_flow", "termination"],
    requiresAuth: false,
  },

  handoff_to_user: {
    name: "handoff_to_user",
    displayName: "Human-in-the-Loop",
    description: "Hand off control to a human user",
    category: "agents_workflows",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import handoff_to_user",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "handoff_to_user(message='Need approval for action X')",
    capabilities: ["human_in_loop", "approval", "escalation"],
    requiresAuth: false,
  },

  use_agent: {
    name: "use_agent",
    displayName: "Use Agent (Agents as Tools!)",
    description: "Run another agent as a tool - enables hierarchical agent architectures",
    category: "agents_workflows",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import use_agent",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "use_agent(agent=research_agent, task='Find information')",
    capabilities: ["agents_as_tools", "hierarchical", "delegation"],
    requiresAuth: false,
  },

  think: {
    name: "think",
    displayName: "Parallel Reasoning",
    description: "Execute parallel reasoning branches",
    category: "agents_workflows",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import think",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "think(branches=['approach1', 'approach2'])",
    capabilities: ["reasoning", "parallel", "thinking"],
    requiresAuth: false,
  },

  use_llm: {
    name: "use_llm",
    displayName: "Use LLM",
    description: "Make custom prompts to LLM",
    category: "agents_workflows",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import use_llm",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "use_llm(prompt='Analyze this data...', model='claude')",
    capabilities: ["llm", "custom_prompt", "generation"],
    requiresAuth: false,
  },

  workflow: {
    name: "workflow",
    displayName: "Workflow Sequences",
    description: "Define and execute sequential workflows",
    category: "agents_workflows",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import workflow",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "workflow.run(steps=[step1, step2, step3])",
    capabilities: ["workflow", "sequential", "orchestration"],
    requiresAuth: false,
  },

  batch: {
    name: "batch",
    displayName: "Batch Operations",
    description: "Execute multiple tool calls in batch",
    category: "agents_workflows",
    basePip: "strands-agents-tools",
    extrasPip: undefined,
    importPath: "from strands_tools import batch",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "batch([call1, call2, call3])",
    capabilities: ["batch", "parallel", "bulk"],
    requiresAuth: false,
  },

  a2a_client: {
    name: "a2a_client",
    displayName: "Agent-to-Agent Communication",
    description: "Enable agents to communicate with each other via A2A protocol",
    category: "agents_workflows",
    basePip: "strands-agents-tools",
    extrasPip: "a2a_client",
    importPath: "from strands_tools import a2a_client",
    docsUrl: "https://github.com/strands-agents/tools",
    exampleUsage: "a2a_client.send(agent_id='agent2', message='data')",
    capabilities: ["a2a", "agent_communication", "protocol"],
    requiresAuth: false,
  },
};

/**
 * Query to get all tools
 */
export const getAllTools = query({
  args: {},
  handler: async () => {
    return Object.values(STRANDS_TOOLS_REGISTRY);
  },
});

/**
 * Query to get tools by category
 */
export const getToolsByCategory = query({
  args: { category: v.string() },
  handler: async (ctx, args) => {
    return Object.values(STRANDS_TOOLS_REGISTRY).filter(
      tool => tool.category === args.category
    );
  },
});

/**
 * Query to search tools by capability
 */
export const searchToolsByCapability = query({
  args: { capability: v.string() },
  handler: async (ctx, args) => {
    return Object.values(STRANDS_TOOLS_REGISTRY).filter(tool =>
      tool.capabilities.some(cap =>
        cap.toLowerCase().includes(args.capability.toLowerCase())
      )
    );
  },
});

/**
 * Query to get tool metadata
 */
export const getToolMetadata = query({
  args: { toolName: v.string() },
  handler: async (ctx, args) => {
    return STRANDS_TOOLS_REGISTRY[args.toolName] || null;
  },
});

/**
 * Query to validate tool compatibility with platform
 */
export const validateToolCompatibility = query({
  args: {
    toolName: v.string(),
    platform: v.union(v.literal("windows"), v.literal("macos"), v.literal("linux"))
  },
  handler: async (ctx, args) => {
    const tool = STRANDS_TOOLS_REGISTRY[args.toolName];
    if (!tool) return { compatible: false, reason: "Tool not found" };

    if (tool.notSupportedOn?.includes(args.platform)) {
      return {
        compatible: false,
        reason: `${tool.displayName} is not supported on ${args.platform}`
      };
    }

    return { compatible: true };
  },
});

/**
 * Get required pip packages for a list of tools
 */
export const getRequiredPackages = query({
  args: { toolNames: v.array(v.string()) },
  handler: async (ctx, args) => {
    const packages = new Set<string>();
    const extras = new Set<string>();

    packages.add("strands-agents-tools>=1.0.0");

    for (const toolName of args.toolNames) {
      const tool = STRANDS_TOOLS_REGISTRY[toolName];
      if (!tool) continue;

      if (tool.extrasPip) {
        extras.add(`strands-agents-tools[${tool.extrasPip}]`);
      }

      if (tool.additionalPipPackages) {
        tool.additionalPipPackages.forEach(pkg => packages.add(pkg));
      }
    }

    return {
      basePackages: Array.from(packages),
      extras: Array.from(extras),
    };
  },
});
