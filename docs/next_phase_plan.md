# Next Phase Implementation Plan

## Overview

Building on Phase 7 completion, we'll now implement:
1. **Phase 3-4**: Intelligent Prompt Interpretation & Meta-Tooling (HIGH PRIORITY)
2. **Tool Registry Enhancement** with full Strands Tools integration
3. **Model Selector Enhancement** with Bedrock + Ollama models
4. **Docker Testing Infrastructure** for generated agents
5. **Advanced Features**: Agents as Tools, MCP integration, A2A protocol

## Current State Analysis

### Completed
- ✅ Phase 7: Enhanced Code Generation with multi-cloud deployment
- ✅ Complete agent.py generation with meta-tooling hooks
- ✅ Requirements.txt, Dockerfile, deployment configs
- ✅ README and documentation generation

### Missing Critical Components
1. No tool registry with Strands Tools metadata
2. No model selector UI with Bedrock/Ollama models
3. No meta-tooling system to analyze prompts and create tools
4. No Docker testing infrastructure
5. No MCP server integration for dynamic tool creation
6. No agents-as-tools support

## Phase 3-4: Meta-Tooling & Intelligent Prompt Interpretation

### Goal
Build a system that:
- Analyzes user prompts to understand agent requirements
- Determines if existing tools are sufficient
- Dynamically creates new tools using @tool decorator when needed
- Uses MCP SDK to create custom MCP servers for specialized domains
- Supports agents as tools for hierarchical agent architectures

### Architecture

```
User Prompt → Prompt Analyzer → Tool Requirement Detector
                                          ↓
                        ┌─────────────────┴────────────────┐
                        ↓                                  ↓
              Existing Tools Sufficient?          Need New Tools?
                        ↓                                  ↓
              Use from Registry                   Generate Tool Code
                                                           ↓
                                                   ┌───────┴────────┐
                                                   ↓                ↓
                                          @tool Decorator    MCP Server
                                          Python Function    (Python SDK)
                                                   ↓                ↓
                                          Add to Agent    Add as Resource
```

### Implementation Files

1. **`convex/metaTooling.ts`** (NEW)
   - `analyzePromptForTools()` - LLM-based prompt analysis
   - `detectToolRequirements()` - Identify missing capabilities
   - `generateToolCode()` - Create @tool decorated functions
   - `generateMCPServer()` - Create MCP server for domain
   - `validateGeneratedTool()` - Test tool before adding

2. **`convex/toolRegistry.ts`** (NEW)
   - `fetchStrandsTools()` - Load all 50+ tools from GitHub
   - `getToolMetadata()` - Get tool details, dependencies
   - `searchTools()` - Find tools by capability
   - `validateToolCompatibility()` - Check platform support

3. **`convex/workflowEngine.ts`** (NEW)
   - `createAgentWorkflow()` - Define workflow steps
   - `executeWorkflow()` - Run workflow with state
   - Workflow steps:
     1. Analyze requirements
     2. Search existing tools
     3. Generate missing tools
     4. Test tools in sandbox
     5. Generate complete agent
     6. Test agent in Docker

### Example Use Cases

#### Use Case 1: Email Writing Agent
```
User Input: "Create an agent that can write and send emails"

Analysis:
- Required capabilities: email composition, Gmail API access
- Existing tools: None directly for Gmail
- Action: Generate MCP server for Gmail integration

Generated:
1. MCP Server (gmail_server.py):
   - Resources: inbox, sent, drafts
   - Tools: compose_email, send_email, read_email
   - Uses Gmail API MCP or custom implementation

2. Agent Tools:
   @tool
   async def compose_email(to: str, subject: str, body: str) -> dict:
       """Compose an email draft"""
       # Uses MCP gmail server
       
   @tool
   async def send_email(draft_id: str) -> dict:
       """Send composed email"""
       # Uses MCP gmail server
```

#### Use Case 2: Data Analysis Agent
```
User Input: "Create an agent that analyzes CSV files and creates charts"

Analysis:
- Required capabilities: file reading, data processing, visualization
- Existing tools: file_read, python_repl (for pandas/matplotlib)
- Action: Use existing tools, no new tools needed

Agent Config:
- Tools: [file_read, python_repl, calculator]
- System Prompt: Enhanced with data analysis instructions
```

#### Use Case 3: Multi-Agent Research Assistant
```
User Input: "Create a research agent with specialized sub-agents"

Analysis:
- Required capabilities: web search, document analysis, synthesis
- Pattern: Hierarchical agent architecture
- Action: Use agents-as-tools pattern

Generated:
- ResearchAgent (parent)
  ├─ WebSearchAgent (tool)
  ├─ DocumentAnalysisAgent (tool)
  └─ SynthesisAgent (tool)
  
Implementation:
@tool
def use_search_agent(query: str) -> str:
    search_agent = Agent(
        model="anthropic.claude-sonnet-4-5-20250929-v1:0",
        tools=[tavily_search, browser],
        system_prompt="You are a web search specialist..."
    )
    return search_agent(query)
```

## Tool Registry Enhancement

### Strands Tools Integration

From `docs/strandsagents_tools.md`, we have 50+ tools across categories:

#### RAG & Memory (4 tools)
- `retrieve` - Amazon Bedrock Knowledge Bases RAG
- `memory` - Agent memory in Bedrock KB  
- `agent_core_memory` - Bedrock Agent Core Memory
- `mem0_memory` - Mem0 integration

#### File Operations (3 tools)
- `editor` - File editing, search, undo
- `file_read` - Read and parse files
- `file_write` - Create and modify files

#### Shell & System (4 tools)
- `environment` - Environment variables
- `shell` - Execute shell commands
- `cron` - Task scheduling
- `use_computer` - Desktop automation

#### Code Interpretation (2 tools)
- `python_repl` - Run Python code (NOT WINDOWS)
- `code_interpreter` - Isolated sandbox execution

#### Web & Network (5 tools)
- `http_request` - API calls and HTTP
- `slack` - Slack integration
- `browser` - Browser automation
- `rss` - RSS feeds

#### Multi-modal (6 tools)
- `generate_image_stability` - Stability AI images
- `image_reader` - Image analysis
- `generate_image` - Bedrock image generation
- `nova_reels` - Nova Reels video
- `speak` - Text-to-speech
- `diagram` - Architecture diagrams

#### AWS Services (1 tool)
- `use_aws` - AWS service interaction

#### Utilities (5 tools)
- `calculator` - Math operations
- `current_time` - Date and time
- `load_tool` - Dynamic tool loading
- `sleep` - Pause execution

#### Agents & Workflows (15 tools)
- `graph` - Multi-agent graph systems
- `agent_graph` - Agent graphs
- `journal` - Structured task logs
- `swarm` - Agent swarms
- `stop` - Force stop event loop
- `handoff_to_user` - Human-in-the-loop
- `use_agent` - Run new agent (AGENTS AS TOOLS!)
- `think` - Parallel reasoning branches
- `use_llm` - Custom prompts
- `workflow` - Sequenced workflows
- `batch` - Multiple tool calls
- `a2a_client` - Agent-to-agent communication

### Tool Metadata Structure

```typescript
interface StrandsToolMetadata {
  name: string;
  displayName: string;
  description: string;
  category: 
    | "rag_memory"
    | "file_operations" 
    | "shell_system"
    | "code_interpretation"
    | "web_network"
    | "multimodal"
    | "aws_services"
    | "utilities"
    | "agents_workflows";
  
  // Dependencies
  basePip: "strands-agents-tools";
  extrasPip?: string; // e.g., "mem0_memory", "local_chromium_browser"
  additionalPipPackages?: string[]; // Other pip packages needed
  
  // Platform support
  notSupportedOn?: ("windows" | "macos" | "linux")[];
  
  // Import information
  importPath: string; // e.g., "from strands_tools import calculator"
  
  // Documentation
  docsUrl: string;
  exampleUsage: string;
  parameters: ParameterSpec[];
  returnType: string;
  
  // Capabilities
  capabilities: string[]; // e.g., ["math", "calculation"]
  requiresAuth?: boolean;
  requiresEnvVars?: string[]; // e.g., ["SLACK_TOKEN"]
}
```

## Model Selector Enhancement

### Bedrock Models to Add

From `docs/update_features.md`:

```typescript
const BEDROCK_MODELS = [
  // Claude 4.5 Sonnet (LATEST - RECOMMENDED)
  {
    id: "anthropic.claude-sonnet-4-5-20250929-v1:0",
    name: "Claude 4.5 Sonnet",
    provider: "Anthropic",
    capabilities: ["text", "vision", "reasoning"],
    contextWindow: 200000,
    maxOutput: 8192,
    recommended: true,
    costPer1MTokens: { input: 3.0, output: 15.0 }
  },
  
  // Claude 4.1 Opus
  {
    id: "anthropic.claude-opus-4-1-20250805-v1:0",
    name: "Claude 4.1 Opus",
    provider: "Anthropic",
    capabilities: ["text", "vision", "reasoning"],
    contextWindow: 200000,
    maxOutput: 16384,
    costPer1MTokens: { input: 15.0, output: 75.0 }
  },
  
  // Claude 4.0 models
  {
    id: "anthropic.claude-opus-4-20250514-v1:0",
    name: "Claude 4.0 Opus",
    provider: "Anthropic"
  },
  {
    id: "anthropic.claude-sonnet-4-20250514-v1:0",
    name: "Claude 4.0 Sonnet",
    provider: "Anthropic"
  },
  
  // Claude 3.7 Sonnet
  {
    id: "anthropic.claude-3-7-sonnet-20250219-v1:0",
    name: "Claude 3.7 Sonnet",
    provider: "Anthropic"
  },
  
  // Claude 3.5 Haiku
  {
    id: "anthropic.claude-3-5-haiku-20241022-v1:0",
    name: "Claude 3.5 Haiku",
    provider: "Anthropic",
    capabilities: ["text", "vision"],
    contextWindow: 200000,
    costPer1MTokens: { input: 1.0, output: 5.0 }
  },
  
  // Claude 3 Haiku
  {
    id: "anthropic.claude-3-haiku-20240307-v1:0",
    name: "Claude 3 Haiku",
    provider: "Anthropic"
  },
  
  // Amazon Nova models
  {
    id: "amazon.nova-pro-v1:0",
    name: "Nova Pro",
    provider: "Amazon",
    capabilities: ["text", "vision"],
    contextWindow: 300000
  },
  {
    id: "amazon.nova-lite-v1:0",
    name: "Nova Lite",
    provider: "Amazon",
    capabilities: ["text", "vision"],
    contextWindow: 300000
  },
  {
    id: "amazon.nova-micro-v1:0",
    name: "Nova Micro",
    provider: "Amazon",
    capabilities: ["text"],
    contextWindow: 128000
  },
  {
    id: "amazon.nova-premier-v1:0",
    name: "Nova Premier",
    provider: "Amazon",
    capabilities: ["text", "vision"],
    contextWindow: 300000
  },
  
  // Nova multimodal
  {
    id: "amazon.nova-canvas-v1:0",
    name: "Nova Canvas",
    provider: "Amazon",
    capabilities: ["image_generation"],
    type: "image"
  },
  {
    id: "amazon.nova-reel-v1:0",
    name: "Nova Reel",
    provider: "Amazon",
    capabilities: ["video_generation"],
    type: "video"
  },
  
  // Titan
  {
    id: "amazon.titan-image-generator-v2:0",
    name: "Titan Image Generator V2",
    provider: "Amazon",
    capabilities: ["image_generation"],
    type: "image"
  }
];
```

### Ollama Models to Add

```typescript
const OLLAMA_MODELS = [
  // Qwen (RECOMMENDED for coding)
  {
    id: "qwen3:4b",
    name: "Qwen3 4B",
    provider: "Ollama",
    size: "4B",
    capabilities: ["text"],
    recommended: true,
    category: "lightweight"
  },
  {
    id: "qwen3:8b",
    name: "Qwen3 8B",
    provider: "Ollama",
    size: "8B",
    capabilities: ["text"],
    recommended: true,
    category: "balanced"
  },
  {
    id: "qwen3:14b",
    name: "Qwen3 14B",
    provider: "Ollama",
    capabilities: ["text"]
  },
  {
    id: "qwen3:30b",
    name: "Qwen3 30B",
    provider: "Ollama",
    capabilities: ["text"]
  },
  {
    id: "qwen3-coder:30b",
    name: "Qwen3 Coder 30B",
    provider: "Ollama",
    capabilities: ["text", "coding"],
    category: "coding"
  },
  
  // Llama
  {
    id: "llama3.3",
    name: "Llama 3.3",
    provider: "Ollama",
    capabilities: ["text"]
  },
  {
    id: "llama3.2:3b",
    name: "Llama 3.2 3B",
    provider: "Ollama",
    size: "3B"
  },
  {
    id: "llama3.2:1b",
    name: "Llama 3.2 1B",
    provider: "Ollama",
    size: "1B"
  },
  {
    id: "llama3.1:8b",
    name: "Llama 3.1 8B",
    provider: "Ollama",
    size: "8B"
  },
  {
    id: "llama3.2-vision:11b",
    name: "Llama 3.2 Vision 11B",
    provider: "Ollama",
    capabilities: ["text", "vision"]
  },
  
  // Phi
  {
    id: "phi4:14b",
    name: "Phi-4 14B",
    provider: "Ollama",
    capabilities: ["text", "reasoning"]
  },
  {
    id: "phi4-mini:3.8b",
    name: "Phi-4 Mini 3.8B",
    provider: "Ollama"
  },
  
  // DeepSeek
  {
    id: "deepseek-r1:8b",
    name: "DeepSeek R1 8B",
    provider: "Ollama",
    capabilities: ["text", "reasoning"]
  },
  {
    id: "deepseek-coder:6.7b",
    name: "DeepSeek Coder 6.7B",
    provider: "Ollama",
    capabilities: ["text", "coding"]
  },
  {
    id: "deepseek-v3",
    name: "DeepSeek V3",
    provider: "Ollama",
    capabilities: ["text"]
  }
];
```

## Docker Testing Infrastructure

### Architecture

```
Generated Agent → Build Docker Image → Run Container → Stream Logs → Return Results
                        ↓                    ↓              ↓
                  Dockerfile           Environment    Test Query
                  requirements.txt     Variables      
                  agent.py
```

### Implementation

1. **`convex/dockerService.ts`** (NEW)
   - Build image from generated code
   - Run container with timeout
   - Stream logs to frontend
   - Execute test queries
   - Cleanup resources

2. **`src/components/AgentTester.tsx`** (NEW)
   - UI for testing agents
   - Real-time log display
   - Test query input
   - Success/failure indicators
   - Performance metrics

## Advanced Features

### 1. Agents as Tools

Using `use_agent` from Strands Tools:

```python
from strands_tools import use_agent

@tool
def research_assistant(topic: str) -> str:
    """Use specialized research agent"""
    research_agent = Agent(
        model="anthropic.claude-sonnet-4-5-20250929-v1:0",
        tools=[tavily_search, browser, file_read],
        system_prompt="You are a research specialist..."
    )
    return use_agent(research_agent, topic)
```

### 2. MCP Integration

Create custom MCP servers for domains:

```python
# Generated gmail_mcp_server.py
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Gmail")

@mcp.tool()
def compose_email(to: str, subject: str, body: str) -> dict:
    """Compose an email"""
    # Gmail API integration
    return {"status": "drafted", "draft_id": "..."}

@mcp.resource("inbox://")
def get_inbox() -> str:
    """Get inbox emails"""
    # Gmail API integration
    return inbox_data
```

### 3. Agent-to-Agent Protocol

Using `a2a_client` from Strands Tools:

```python
from strands_tools import a2a_client

@tool
def consult_expert(question: str, expert_type: str) -> str:
    """Consult specialized expert agent"""
    return a2a_client.send_message(
        agent_id=f"{expert_type}_agent",
        message=question
    )
```

## Implementation Priority

### Week 1-2 (HIGH PRIORITY)
1. ✅ Complete Phase 7 (DONE)
2. 🔄 Tool Registry with Strands Tools metadata
3. 🔄 Model Selector enhancement (Bedrock + Ollama)
4. 🔄 Meta-Tooling: Prompt analyzer

### Week 3-4 (HIGH PRIORITY)
5. 🔄 Meta-Tooling: Tool generator with @tool decorator
6. 🔄 Docker testing infrastructure
7. 🔄 Testing UI component
8. 🔄 Workflow engine

### Week 5-6 (MEDIUM PRIORITY)
9. 🔄 MCP server generator
10. 🔄 Agents-as-tools support
11. 🔄 A2A protocol integration
12. 🔄 Advanced examples

## Success Criteria

- ✅ User can select from 50+ Strands Tools
- ✅ User can select Bedrock or Ollama models
- ✅ System analyzes prompts to detect tool requirements
- ✅ System generates @tool decorated functions when needed
- ✅ System generates MCP servers for custom domains
- ✅ User can test generated agents in Docker
- ✅ Agents can use other agents as tools
- ✅ Agents can communicate via A2A protocol

## Next Steps

1. Implement Tool Registry (`convex/toolRegistry.ts`)
2. Enhance Model Selector UI with all models
3. Create Meta-Tooling system (`convex/metaTooling.ts`)
4. Build Docker testing infrastructure
5. Add advanced features (agents-as-tools, MCP, A2A)
