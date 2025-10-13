# Agent Builder Application - Comprehensive Implementation Plan

## Executive Summary

This plan outlines a complete overhaul of the Agent Builder Application to:
1. Support all AWS Bedrock and Ollama models with correct model IDs
2. Integrate full strands-agents-tools suite with proper pip dependencies
3. Implement Docker-based testing infrastructure for generated agents
4. Add intelligent prompt interpretation with meta-tooling capabilities
5. Support multi-cloud deployment (AWS, Azure, Google Cloud) via MCP documentation
6. Use AgentCore for containerized agent deployment
7. Create architectural diagrams for the system

---

## Architecture Diagrams

### Current System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React/Vite)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ AgentBuilder │  │  Dashboard   │  │ ModelSelector│          │
│  │   (Wizard)   │  │  (Agents)    │  │ ToolSelector │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                  │                   │
└─────────┼─────────────────┼──────────────────┼───────────────────┘
          │                 │                  │
          │    ConvexReactClient (WebSocket)   │
          │                 │                  │
┌─────────▼─────────────────▼──────────────────▼───────────────────┐
│                     Convex Backend                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Database (agents, templates)                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  agents.ts   │  │codeGenerator │  │ templates.ts │          │
│  │  (CRUD)      │  │  (Actions)   │  │  (Queries)   │          │
│  └──────────────┘  └──────┬───────┘  └──────────────┘          │
└─────────────────────────────┼──────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Generated Code   │
                    │  (Download only)  │
                    └───────────────────┘
```

### Target System Architecture with Testing & Deployment

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Frontend (React/Vite)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ AgentBuilder │  │  Dashboard   │  │ ModelSelector│  │ AgentTester │ │
│  │   (Wizard)   │  │  (Agents)    │  │ ToolSelector │  │  (Live UI)  │ │
│  │              │  │              │  │ (Enhanced)   │  │             │ │
│  │  - Basic     │  │ - My Agents  │  │ - Bedrock    │  │ - Input     │ │
│  │  - Model     │  │ - Public     │  │ - Ollama     │  │ - Logs      │ │
│  │  - Tools     │  │ - Templates  │  │ - OpenAI     │  │ - Streaming │ │
│  │  - Deploy    │  │ - Test       │  │ - Azure      │  │ - Results   │ │
│  │  - Test      │  │              │  │ - Google     │  │             │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
└─────────┼─────────────────┼──────────────────┼──────────────────┼────────┘
          │                 │                  │                  │
          │        ConvexReactClient (WebSocket + Streaming)      │
          │                 │                  │                  │
┌─────────▼─────────────────▼──────────────────▼──────────────────▼────────┐
│                          Convex Backend                                   │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  Database Schema (Enhanced)                                        │  │
│  │  - agents (+ testResults, modelProvider, status, containerImage)  │  │
│  │  - templates (+ cloudPlatform, deploymentType)                    │  │
│  │  - toolRegistry (+ dependencies, imports, documentation)           │  │
│  │  - testRuns (query, response, logs, metrics, timestamp)           │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │  agents.ts   │  │codeGenerator │  │ templates.ts │  │agentTesting │  │
│  │  (CRUD)      │  │  (Enhanced)  │  │  (Enhanced)  │  │  (Docker)   │  │
│  │              │  │              │  │              │  │             │  │
│  │ - list()     │  │ - generate() │  │ - list()     │  │ - test()    │  │
│  │ - create()   │  │ - enhance()  │  │ - get()      │  │ - stream()  │  │
│  │ - update()   │  │ - validate() │  │ - create()   │  │ - cleanup() │  │
│  │ - delete()   │  │              │  │              │  │             │  │
│  └──────────────┘  └──────┬───────┘  └──────────────┘  └──────┬──────┘  │
│                           │                                     │         │
│  ┌──────────────┐  ┌──────▼───────┐  ┌──────────────┐  ┌──────▼──────┐  │
│  │ toolRegistry │  │ metaTooling  │  │mcpIntegration│  │dockerService│  │
│  │  (Actions)   │  │  (Actions)   │  │  (Actions)   │  │  (Actions)  │  │
│  │              │  │              │  │              │  │             │  │
│  │ - fetchTools │  │ - interpret()│  │ - getDocs()  │  │ - build()   │  │
│  │ - parseSpec  │  │ - createTool │  │ - getModels()│  │ - run()     │  │
│  │ - getImports │  │ - workflow() │  │ - getPlatform│  │ - logs()    │  │
│  └──────────────┘  └──────────────┘  └──────┬───────┘  └──────┬──────┘  │
└────────────────────────────────────────────────┼──────────────────┼──────┘
                                                 │                  │
         ┌───────────────────────────────────────┼──────────────────┼──────┐
         │                                       │                  │      │
┌────────▼────────┐  ┌────────────────────┐  ┌──▼──────────┐  ┌───▼─────┐│
│ MCP Servers     │  │  Docker Engine     │  │  AgentCore  │  │ Storage ││
│                 │  │                    │  │             │  │         ││
│ - Context7      │  │ - Test Containers │  │ - Deploy    │  │ - Code  ││
│ - AWS Docs      │  │ - Build Images    │  │ - Host      │  │ - Images││
│ - Azure Docs    │  │ - Stream Logs     │  │ - Monitor   │  │ - Logs  ││
│ - Google Docs   │  │ - Cleanup         │  │ - Scale     │  │         ││
└─────────────────┘  └───────────────────┘  └─────────────┘  └─────────┘│
                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Generated Agent Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Generated Agent Container                         │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  agent.py (Main Agent File)                                │    │
│  │                                                             │    │
│  │  from strands import Agent, tool                           │    │
│  │  from strands.models import BedrockModel, OllamaModel      │    │
│  │  from strands_tools import (calculator, file_read, ...)    │    │
│  │  from agentcore.memory import MemoryManager                │    │
│  │  from agentcore.interpreter import CodeInterpreter         │    │
│  │                                                             │    │
│  │  @agent(                                                    │    │
│  │      model=<selected_model>,                               │    │
│  │      system_prompt=<enhanced_prompt>,                      │    │
│  │      tools=[...],                                          │    │
│  │      memory=True,                                          │    │
│  │      code_interpreter=True,                                │    │
│  │      reasoning="interleaved"                               │    │
│  │  )                                                          │    │
│  │  class GeneratedAgent(Agent):                              │    │
│  │      def __init__(self):                                   │    │
│  │          super().__init__()                                │    │
│  │          self.memory = MemoryManager()                     │    │
│  │          self.interpreter = CodeInterpreter()             │    │
│  │          # Initialize custom tools                        │    │
│  │                                                             │    │
│  │      async def process_message(self, msg, ctx):           │    │
│  │          # Meta-tooling: Analyze if new tools needed      │    │
│  │          if self._needs_new_tool(msg):                    │    │
│  │              new_tool = await self._create_tool(msg)      │    │
│  │              self.add_tool(new_tool)                      │    │
│  │                                                             │    │
│  │          # Process with memory and reasoning              │    │
│  │          self.memory.store_message(msg, ctx)              │    │
│  │          response = await self.generate_response(          │    │
│  │              message=msg,                                  │    │
│  │              context=ctx,                                  │    │
│  │              reasoning_mode="interleaved"                  │    │
│  │          )                                                  │    │
│  │          return response                                   │    │
│  │                                                             │    │
│  │      @tool                                                  │    │
│  │      async def _create_tool(self, requirement):           │    │
│  │          \"\"\"Meta-tool: Create new tools dynamically\"\"\"     │    │
│  │          # Use LLM to generate tool code                  │    │
│  │          # Validate and add to agent                      │    │
│  │          pass                                              │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  tools/ (Custom Tools Directory)                           │    │
│  │  ├── custom_tool_1.py                                      │    │
│  │  ├── custom_tool_2.py                                      │    │
│  │  └── __init__.py                                           │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  requirements.txt                                          │    │
│  │  strands-agents>=1.0.0                                     │    │
│  │  strands-agents-tools>=1.0.0                               │    │
│  │  strands-agents-tools[mem0_memory]                         │    │
│  │  strands-agents-tools[agent_core_browser]                  │    │
│  │  # ... tool-specific dependencies                          │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Dockerfile                                                │    │
│  │  FROM python:3.11-slim                                     │    │
│  │  WORKDIR /app                                              │    │
│  │  COPY requirements.txt .                                   │    │
│  │  RUN pip install -r requirements.txt                       │    │
│  │  COPY . .                                                  │    │
│  │  CMD ["python", "agent.py"]                                │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Deployment Configs                                        │    │
│  │  ├── aws_sam_template.yaml (AWS Lambda/ECS)               │    │
│  │  ├── azure_deploy.json (Azure Container Instances)        │    │
│  │  ├── gcp_deploy.yaml (Google Cloud Run)                   │    │
│  │  ├── docker-compose.yml (Local/AgentCore)                 │    │
│  │  └── agentcore_manifest.json                              │    │
│  └────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Model Enhancement (Priority: CRITICAL)

### 1.1 AWS Bedrock Model Integration

**Location:** `src/components/ModelSelector.tsx`

**Implementation:**
- Add all Bedrock models from `.cursor/docs/model_capabilities.md`:
  - Claude 4.5 Sonnet: `anthropic.claude-sonnet-4-5-20250929-v1:0` ⭐ RECOMMENDED
  - Claude 4.1 Opus: `anthropic.claude-opus-4-1-20250805-v1:0`
  - Claude 4.0 Opus: `anthropic.claude-opus-4-20250514-v1:0`
  - Claude 4.0 Sonnet: `anthropic.claude-sonnet-4-20250514-v1:0`
  - Claude 3.7 Sonnet: `anthropic.claude-3-7-sonnet-20250219-v1:0`
  - Claude 3.5 Haiku: `anthropic.claude-3-5-haiku-20241022-v1:0`
  - Claude 3.5 Sonnet: `anthropic.claude-3-5-sonnet-20240620-v1:0`
  - Claude 3 Haiku: `anthropic.claude-3-haiku-20240307-v1:0`
  - Nova Pro: `amazon.nova-pro-v1:0`
  - Nova Lite: `amazon.nova-lite-v1:0`
  - Nova Micro: `amazon.nova-micro-v1:0`
  - Nova Premier: `amazon.nova-premier-v1:0`
  - Nova Canvas: `amazon.nova-canvas-v1:0` (image generation)
  - Nova Reel: `amazon.nova-reel-v1:0` (video generation)
  - Titan Image Gen V2: `amazon.titan-image-generator-v2:0`

**UI Enhancements:**
- Group models by provider (tabs or dropdown)
- Show capability badges (text, image, video, reasoning)
- Display model size and performance score
- Add "Recommended for" tags
- Show cost estimates
- Filter by capability

### 1.2 Ollama Model Integration

**Location:** `src/components/ModelSelector.tsx`

**Models to Add:**
- Qwen3:
  - `qwen3:4b` ⭐ RECOMMENDED (light, fast)
  - `qwen3:8b` ⭐ RECOMMENDED (balanced)
  - `qwen3:14b` (advanced)
  - `qwen3:30b` (enterprise)
  - `qwen3-coder:30b` (coding specialist)
  - `qwen3-embedding:4b` (embeddings)
  - `qwen3-embedding:8b` (embeddings)
- Llama:
  - `llama3.3` ⭐ VERIFY THIS MODEL ID
  - `llama3.2:3b`
  - `llama3.2:1b`
  - `llama3.1:8b`
  - `llama3.2-vision:11b` (vision)
- Phi:
  - `phi4:14b` (reasoning)
  - `phi4-mini:3.8b`
  - `phi4-mini-reasoning:3.8b`
- Gemma:
  - `gemma3:4b`
  - `gemma3:12b`
  - `gemma3:27b`
  - `codegemma:7b` (coding)
- DeepSeek:
  - `deepseek-r1:8b` (reasoning)
  - `deepseek-coder:6.7b` (coding)
  - `deepseek-coder:33b` (enterprise coding)
  - `deepseek-v3` (max performance)
- Mistral:
  - `mistral-nemo`
  - `devstral:24b` (coding)

**Ollama Configuration:**
- Add Ollama host configuration (default: `http://localhost:11434`)
- Test connection to Ollama server
- Auto-detect available models from Ollama API
- Show model download status

**Code Generation Updates:**
```python
# For Ollama models
from strands.models.ollama import OllamaModel

model = OllamaModel(
    host="http://localhost:11434",
    model_id="qwen3:8b"
)
agent = Agent(model=model)
```

### 1.3 Model Provider Detection

**Location:** `convex/codeGenerator.ts`

**Function:** `detectModelProvider(modelId: string)`
```typescript
function detectModelProvider(modelId: string): {
  provider: 'bedrock' | 'ollama' | 'openai' | 'anthropic' | 'azure' | 'google';
  imports: string[];
  initCode: string;
} {
  if (modelId.startsWith('anthropic.') || modelId.startsWith('amazon.')) {
    return {
      provider: 'bedrock',
      imports: ['from strands.models import BedrockModel'],
      initCode: `model = BedrockModel(model_id="${modelId}", temperature=0.3, streaming=True)`
    };
  }
  if (modelId.includes(':') && !modelId.includes('.')) {
    return {
      provider: 'ollama',
      imports: ['from strands.models.ollama import OllamaModel'],
      initCode: `model = OllamaModel(host="http://localhost:11434", model_id="${modelId}")`
    };
  }
  // ... other providers
}
```

---

## Phase 2: Tool Registry Enhancement (Priority: CRITICAL)

### 2.1 Strands Tools Integration

**Location:** `convex/toolRegistry.ts` (NEW FILE)

**Fetch Tools from GitHub:**
```typescript
export const fetchStrandsTools = action({
  args: {},
  handler: async (ctx) => {
    // Fetch from GitHub API
    const toolsUrl = "https://api.github.com/repos/strands-agents/tools/contents/src/strands_tools";
    const response = await fetch(toolsUrl);
    const files = await response.json();

    const tools = [];
    for (const file of files) {
      if (file.name.endsWith('.py')) {
        const toolData = await parseToolFile(file.download_url);
        tools.push(toolData);
      }
    }

    // Store in database
    return tools;
  }
});
```

**All Strands Tools from `.cursor/docs/strandsagents_tools.md`:**

#### RAG & Memory
- ✅ `retrieve` - Amazon Bedrock Knowledge Bases RAG
- ✅ `memory` - Agent memory in Bedrock KB
- ✅ `agent_core_memory` - Bedrock Agent Core Memory (needs: `strands-agents-tools[agent_core_memory]`)
- ✅ `mem0_memory` - Mem0 integration (needs: `strands-agents-tools[mem0_memory]`)

#### File Operations
- ✅ `editor` - File editing, search, undo
- ✅ `file_read` - Read and parse files
- ✅ `file_write` - Create and modify files

#### Shell & System
- ✅ `environment` - Environment variables
- ✅ `shell` - Execute shell commands
- ✅ `cron` - Task scheduling
- ✅ `use_computer` - Desktop automation (needs: `strands-agents-tools[use_computer]`)

#### Code Interpretation
- ✅ `python_repl` - Run Python code (NOT WINDOWS)
- ✅ `code_interpreter` - Isolated sandbox execution

#### Web & Network
- ✅ `http_request` - API calls and HTTP
- ✅ `slack` - Slack integration
- ✅ `browser` - Browser automation (needs: `strands-agents-tools[local_chromium_browser]` or `[agent_core_browser]`)
- ✅ `rss` - RSS feeds (needs: `strands-agents-tools[rss]`)

#### Multi-modal
- ✅ `generate_image_stability` - Stability AI images
- ✅ `image_reader` - Image analysis
- ✅ `generate_image` - Bedrock image generation
- ✅ `nova_reels` - Nova Reels video
- ✅ `speak` - Text-to-speech
- ✅ `diagram` - Architecture diagrams (needs: `strands-agents-tools[diagram]`)

#### AWS Services
- ✅ `use_aws` - AWS service interaction

#### Utilities
- ✅ `calculator` - Math operations
- ✅ `current_time` - Date and time
- ✅ `load_tool` - Dynamic tool loading
- ✅ `sleep` - Pause execution

#### Agents & Workflows
- ✅ `graph` - Multi-agent graph systems
- ✅ `agent_graph` - Agent graphs
- ✅ `journal` - Structured task logs
- ✅ `swarm` - Agent swarms
- ✅ `stop` - Force stop event loop
- ✅ `handoff_to_user` - Human-in-the-loop
- ✅ `use_agent` - Run new agent
- ✅ `think` - Parallel reasoning branches
- ✅ `use_llm` - Custom prompts
- ✅ `workflow` - Sequenced workflows
- ✅ `batch` - Multiple tool calls
- ✅ `a2a_client` - Agent-to-agent communication (needs: `strands-agents-tools[a2a_client]`)

### 2.2 Tool Dependency Mapping

**Location:** `convex/toolRegistry.ts`

**Tool Metadata Structure:**
```typescript
interface ToolMetadata {
  name: string;
  description: string;
  category: string;
  capabilities: string[];
  requiresBasePip: boolean;
  extrasPip?: string; // e.g., "mem0_memory", "browser"
  imports: string[];
  notSupportedOn?: string[]; // e.g., ["windows"]
  documentation: string;
  exampleUsage?: string;
}
```

**Dependency Matrix:**
```typescript
const TOOL_DEPENDENCIES = {
  // Base tools (included in strands-agents-tools)
  calculator: {
    pip: 'strands-agents-tools',
    imports: ['from strands_tools import calculator']
  },

  // Extra dependencies
  mem0_memory: {
    pip: 'strands-agents-tools[mem0_memory]',
    imports: ['from strands_tools import mem0_memory']
  },

  agent_core_browser: {
    pip: 'strands-agents-tools[agent_core_browser]',
    imports: ['from strands_tools import browser']
  },

  // Platform restrictions
  python_repl: {
    pip: 'strands-agents-tools',
    imports: ['from strands_tools import python_repl'],
    notSupportedOn: ['windows']
  }
};
```

### 2.3 Enhanced Tool Selector UI

**Location:** `src/components/ToolSelector.tsx`

**Features:**
- Display all 50+ strands_tools
- Show dependency requirements clearly
- Warn about platform restrictions
- One-click "Recommended Tools" preset
- Tool categories with icons
- Search and filter functionality
- Dependency graph visualization

---

## Phase 3: Intelligent Prompt Interpretation & Meta-Tooling (Priority: HIGH)

### 3.1 Smart Prompt Analyzer

**Location:** `convex/metaTooling.ts` (NEW FILE)

**Purpose:** Analyze user prompts to determine if custom tools need to be created

**Workflow:**
```
User Prompt → Analyze Intent → Determine if existing tools suffice
                    ↓ No
            Create Tool Specification
                    ↓
            Generate Tool Code using @tool decorator
                    ↓
            Validate Tool Code
                    ↓
            Add to Agent Tools
                    ↓
            Continue with Agent Generation
```

**Implementation:**
```typescript
export const analyzePromptForTools = action({
  args: {
    systemPrompt: v.string(),
    selectedTools: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Use LLM to analyze prompt
    const analysis = await analyzewithClaude({
      prompt: `Analyze this agent prompt and determine if additional custom tools are needed:

      System Prompt: ${args.systemPrompt}
      Existing Tools: ${args.selectedTools.join(', ')}

      If custom tools are needed, provide:
      1. Tool name
      2. Tool description
      3. Required parameters
      4. Implementation logic
      5. Required pip packages`,
    });

    return analysis;
  }
});
```

### 3.2 Dynamic Tool Generator

**Location:** `convex/metaTooling.ts`

**Function:** Generate Python tool code using @tool decorator

```typescript
function generateToolCode(toolSpec: ToolSpec): string {
  return `
from strands import tool
${toolSpec.imports.join('\n')}

@tool
async def ${toolSpec.name}(${toolSpec.parameters.map(p => `${p.name}: ${p.type}`).join(', ')}) -> ${toolSpec.returnType}:
    \"\"\"${toolSpec.description}

    Args:
        ${toolSpec.parameters.map(p => `${p.name}: ${p.description}`).join('\n        ')}
    \"\"\"
    ${toolSpec.implementation}

    return result
`;
}
```

### 3.3 Workflow-Based Agent Generation

**Location:** `convex/workflowEngine.ts` (NEW FILE)

**Concept:** Create a workflow that:
1. Analyzes the task
2. Determines required capabilities
3. Selects or creates appropriate tools
4. Generates agent with proper configuration
5. Tests the agent
6. Iterates if needed

**Workflow Structure:**
```typescript
interface AgentWorkflow {
  steps: [
    {
      name: "analyze_requirements",
      action: analyzePromptForTools,
      output: "required_tools"
    },
    {
      name: "validate_tools",
      action: validateToolAvailability,
      output: "tool_status"
    },
    {
      name: "create_missing_tools",
      action: generateCustomTools,
      output: "generated_tools"
    },
    {
      name: "generate_agent",
      action: generateAgentCode,
      output: "agent_code"
    },
    {
      name: "test_agent",
      action: testAgentInDocker,
      output: "test_results"
    }
  ]
}
```

---

## Phase 4: Docker Testing Infrastructure (Priority: HIGH)

### 4.1 Docker Service

**Location:** `convex/dockerService.ts` (NEW FILE)

**Requirements:**
- Build Docker images from generated code
- Run containers with resource limits
- Stream logs to frontend
- Handle timeouts
- Clean up resources
- Support both local and remote Docker (Docker Desktop, Docker Engine)

**Implementation:**
```typescript
export const testAgentInDocker = action({
  args: {
    agentCode: v.string(),
    requirements: v.string(),
    testQuery: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Create temporary directory
    const tempDir = await createTempDir();

    // 2. Write files
    await writeFile(`${tempDir}/agent.py`, args.agentCode);
    await writeFile(`${tempDir}/requirements.txt`, args.requirements);
    await writeFile(`${tempDir}/Dockerfile`, generateDockerfile());

    // 3. Build image
    const imageName = `agent-test-${Date.now()}`;
    await buildDockerImage(tempDir, imageName);

    // 4. Run container
    const containerId = await runContainer(imageName, {
      env: {
        TEST_QUERY: args.testQuery,
        BYPASS_TOOL_CONSENT: "true"
      },
      timeout: 60000, // 60 seconds
    });

    // 5. Stream logs
    const logs = await streamContainerLogs(containerId);

    // 6. Get output
    const output = await getContainerOutput(containerId);

    // 7. Cleanup
    await stopContainer(containerId);
    await removeImage(imageName);
    await cleanupTempDir(tempDir);

    return {
      success: true,
      logs,
      output,
      metrics: {
        executionTime: logs.executionTime,
        memoryUsed: logs.memoryUsed
      }
    };
  }
});
```

### 4.2 Base Docker Images

**Location:** `docker/` (NEW DIRECTORY)

**Files to Create:**

#### `docker/agent-base.Dockerfile`
```dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    build-essential \\
    curl \\
    git \\
    && rm -rf /var/lib/apt/lists/*

# Install base Python packages
RUN pip install --no-cache-dir \\
    strands-agents>=1.0.0 \\
    strands-agents-tools>=1.0.0

WORKDIR /app

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV BYPASS_TOOL_CONSENT=true

CMD ["python", "agent.py"]
```

#### `docker/agent-full.Dockerfile`
```dockerfile
FROM python:3.11-slim

# Install ALL strands-agents-tools extras
RUN pip install --no-cache-dir \\
    'strands-agents-tools[mem0_memory]' \\
    'strands-agents-tools[local_chromium_browser]' \\
    'strands-agents-tools[agent_core_browser]' \\
    'strands-agents-tools[agent_core_code_interpreter]' \\
    'strands-agents-tools[a2a_client]' \\
    'strands-agents-tools[diagram]' \\
    'strands-agents-tools[rss]' \\
    'strands-agents-tools[use_computer]'

WORKDIR /app
CMD ["python", "agent.py"]
```

### 4.3 Testing UI Component

**Location:** `src/components/AgentTester.tsx` (NEW FILE)

**Features:**
- Input field for test query
- "Test Agent" button
- Real-time log streaming
- Response display
- Error handling
- Performance metrics
- "Test Another Query" option

**UI Flow:**
```
┌────────────────────────────────┐
│  Test Your Agent               │
├────────────────────────────────┤
│  Test Query:                   │
│  [______________________]      │
│                                │
│  [Test Agent] [Cancel]         │
│                                │
│  Status: Building container... │
│                                │
│  Logs:                         │
│  ┌──────────────────────────┐ │
│  │ > Installing deps...     │ │
│  │ > Starting agent...      │ │
│  │ > Processing query...    │ │
│  │ > Response generated     │ │
│  └──────────────────────────┘ │
│                                │
│  Response:                     │
│  ┌──────────────────────────┐ │
│  │ [Agent's response here]  │ │
│  └──────────────────────────┘ │
│                                │
│  Metrics:                      │
│  ⏱ Execution: 3.2s            │
│  💾 Memory: 128MB              │
│  ✅ Status: Success            │
└────────────────────────────────┘
```

---

## Phase 5: Multi-Cloud Deployment via MCP (Priority: MEDIUM)

### 5.1 MCP Integration for Platform Documentation

**Location:** `convex/mcpIntegration.ts` (NEW FILE)

**Purpose:** Use MCP servers to fetch deployment documentation for multiple cloud platforms

**MCP Servers to Integrate:**
1. **Context7 MCP** - For library documentation
2. **AWS Documentation MCP** - For AWS deployment guides
3. **Azure MCP** (if available) - For Azure deployment guides
4. **Google Cloud MCP** (if available) - For GCP deployment guides

**Implementation:**
```typescript
export const getPlatformDeploymentDocs = action({
  args: {
    platform: v.union(v.literal("aws"), v.literal("azure"), v.literal("gcp")),
    serviceType: v.string(), // "lambda", "ecs", "cloud-run", etc.
  },
  handler: async (ctx, args) => {
    // Use Context7 or AWS MCP to fetch docs
    const docs = await fetchFromMCP({
      server: getPlatformMCPServer(args.platform),
      query: `How to deploy containerized Python application on ${args.platform} ${args.serviceType}`
    });

    return docs;
  }
});
```

### 5.2 Platform-Specific Code Generation

**Location:** `convex/codeGenerator.ts` (ENHANCE)

**Add Functions:**
```typescript
function generateAWSDeployment(agentConfig) {
  return {
    samTemplate: generateSAMTemplate(agentConfig),
    ecsTask: generateECSTaskDefinition(agentConfig),
    lambda: generateLambdaFunction(agentConfig)
  };
}

function generateAzureDeployment(agentConfig) {
  // Use MCP docs to generate Azure-specific config
  return {
    containerInstance: generateAzureContainerInstance(agentConfig),
    functionApp: generateAzureFunctionApp(agentConfig)
  };
}

function generateGCPDeployment(agentConfig) {
  // Use MCP docs to generate GCP-specific config
  return {
    cloudRun: generateCloudRunService(agentConfig),
    cloudFunction: generateCloudFunction(agentConfig)
  };
}
```

### 5.3 Deployment Templates

**Location:** `templates/deployment/` (NEW DIRECTORY)

**Structure:**
```
templates/
├── deployment/
│   ├── aws/
│   │   ├── sam-template.yaml
│   │   ├── ecs-task-definition.json
│   │   ├── lambda-function.py
│   │   └── deploy.sh
│   ├── azure/
│   │   ├── container-instance.json
│   │   ├── function-app.json
│   │   └── deploy.sh
│   ├── gcp/
│   │   ├── cloud-run.yaml
│   │   ├── cloud-function.yaml
│   │   └── deploy.sh
│   ├── docker/
│   │   ├── docker-compose.yml
│   │   ├── Dockerfile
│   │   └── .dockerignore
│   └── agentcore/
│       ├── manifest.json
│       ├── Dockerfile
│       └── deploy.sh
```

---

## Phase 6: AgentCore Integration (Priority: MEDIUM)

### 6.1 AgentCore Deployment Support

**Purpose:** Use Amazon Bedrock AgentCore to host and manage agents

**Benefits:**
- Managed infrastructure
- Automatic scaling
- Built-in monitoring
- Session management
- Memory persistence

**Location:** `convex/agentcoreService.ts` (NEW FILE)

**Implementation:**
```typescript
export const deployToAgentCore = action({
  args: {
    agentId: v.id("agents"),
    containerImage: v.string(),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);

    // Create AgentCore manifest
    const manifest = {
      name: agent.name,
      description: agent.description,
      container: {
        image: args.containerImage,
        port: 8080
      },
      resources: {
        memory: "512Mi",
        cpu: "0.5"
      },
      environment: {
        MODEL_ID: agent.model,
        AGENT_NAME: agent.name
      }
    };

    // Deploy to AgentCore
    const deployment = await deployToBedrockAgentCore(manifest);

    // Update agent record
    await ctx.db.patch(args.agentId, {
      status: "deployed",
      deploymentUrl: deployment.url,
      containerImage: args.containerImage
    });

    return deployment;
  }
});
```

### 6.2 AgentCore Code Generation

**Add to generated agent:**
```python
# main.py - FastAPI wrapper for AgentCore
from fastapi import FastAPI
from strands import Agent
from agentcore.runtime import AgentCoreRuntime

app = FastAPI()
runtime = AgentCoreRuntime()

@app.post("/invoke")
async def invoke_agent(request: dict):
    agent = GeneratedAgent()
    response = await agent.process_message(
        request["message"],
        request.get("context", {})
    )
    return response

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
```

---

## Phase 7: Enhanced Code Generation (Priority: HIGH)

### 7.1 Complete Agent Template

**Location:** `convex/codeGenerator.ts`

**Generated Code Structure:**
```python
\"\"\"
Generated Agent: {name}
Description: {description}
Model: {model}
Generated: {timestamp}
\"\"\"

# ============================================================================
# IMPORTS
# ============================================================================
from strands import Agent, tool
from strands.models import {model_provider_import}
from strands_tools import {selected_tools}
{custom_tool_imports}

# AgentCore & Memory
from agentcore.memory import MemoryManager
from agentcore.interpreter import CodeInterpreter

# Logging & Monitoring
import logging
from langsmith import Client as LangSmithClient
from opentelemetry import trace

# Standard library
import asyncio
import os
from typing import Dict, Any, Optional

# ============================================================================
# CONFIGURATION
# ============================================================================
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# LangSmith Configuration
langsmith_client = LangSmithClient(
    api_key=os.getenv("LANGSMITH_API_KEY", "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")
)

# OpenTelemetry Configuration
tracer = trace.get_tracer(__name__)

# ============================================================================
# MODEL CONFIGURATION
# ============================================================================
{model_init_code}

# ============================================================================
# CUSTOM TOOLS
# ============================================================================
{custom_tool_definitions}

# ============================================================================
# AGENT DEFINITION
# ============================================================================
@agent(
    model=model,
    system_prompt=\"\"\"{system_prompt}\"\"\",
    tools=[{tool_list}],
    memory=True,
    code_interpreter=True,
    reasoning="interleaved"  # Claude 4.5 Sonnet feature
)
class {AgentClassName}(Agent):
    \"\"\"Generated Agent with meta-tooling capabilities\"\"\"

    def __init__(self):
        super().__init__()
        self.memory = MemoryManager()
        self.interpreter = CodeInterpreter()
        self.langsmith = langsmith_client
        logger.info(f"Agent {self.__class__.__name__} initialized")

    async def process_message(
        self,
        message: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        \"\"\"
        Process incoming message with interleaved reasoning and meta-tooling

        Args:
            message: User input message
            context: Optional context dictionary

        Returns:
            Agent response with metadata
        \"\"\"
        with tracer.start_as_current_span("process_message"):
            try:
                # Store message in memory
                self.memory.store_message(message, context)

                # Check if new tools are needed (meta-tooling)
                if await self._needs_new_tool(message):
                    new_tool = await self._create_dynamic_tool(message)
                    self.add_tool(new_tool)

                # Generate response with interleaved reasoning
                response = await self.generate_response(
                    message=message,
                    context=context,
                    reasoning_mode="interleaved"
                )

                # Log to LangSmith
                self.langsmith.log_run({
                    "input": message,
                    "output": response,
                    "metadata": context
                })

                return response

            except Exception as e:
                logger.error(f"Error processing message: {e}")
                raise

    async def _needs_new_tool(self, message: str) -> bool:
        \"\"\"Determine if a new tool needs to be created\"\"\"
        # Use LLM to analyze if existing tools are sufficient
        analysis = await self.generate_response(
            message=f"Do I need a new tool to handle this request? {message}",
            reasoning_mode="interleaved"
        )
        return "yes" in analysis.lower()

    @tool
    async def _create_dynamic_tool(self, requirement: str) -> callable:
        \"\"\"
        Meta-tool: Create new tools dynamically based on requirements

        Args:
            requirement: Description of what the tool should do
        \"\"\"
        # Generate tool code using LLM
        tool_code = await self.generate_response(
            message=f\"\"\"Create a Python tool using @tool decorator for: {requirement}

            Requirements:
            - Use proper type hints
            - Include comprehensive docstring
            - Handle errors gracefully
            - Return structured response
            \"\"\",
            reasoning_mode="interleaved"
        )

        # Validate and execute tool code
        # (In production, use proper sandboxing)
        exec(tool_code)

        return locals()[tool_code.split("def ")[1].split("(")[0]]

    async def execute_tool(
        self,
        tool_name: str,
        **kwargs
    ) -> Any:
        \"\"\"Execute a tool by name with given parameters\"\"\"
        with tracer.start_as_current_span(f"execute_tool_{tool_name}"):
            tool = getattr(self, tool_name.lower(), None)
            if tool and callable(tool):
                return await tool(**kwargs)
            raise ValueError(f"Tool {tool_name} not found")

# ============================================================================
# MAIN EXECUTION
# ============================================================================
async def main():
    \"\"\"Main entry point for agent execution\"\"\"
    agent = {AgentClassName}()

    # Interactive mode
    print(f"Agent {agent.__class__.__name__} is ready!")
    print("Type 'exit' to quit\\n")

    while True:
        try:
            user_input = input("You: ")
            if user_input.lower() == 'exit':
                break

            response = await agent.process_message(user_input)
            print(f"Agent: {response}\\n")

        except KeyboardInterrupt:
            break
        except Exception as e:
            logger.error(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
```

### 7.2 Requirements.txt Generation

**Dynamic based on selected tools:**
```python
def generateRequirements(tools: Tool[]): string {
  const packages = new Set([
    'strands-agents>=1.0.0',
    'langsmith>=0.1.0',
    'opentelemetry-api>=1.0.0'
  ]);

  // Base tools package
  packages.add('strands-agents-tools>=1.0.0');

  // Add tool-specific extras
  for (const tool of tools) {
    if (tool.extrasPip) {
      packages.add(`strands-agents-tools[${tool.extrasPip}]`);
    }
  }

  return Array.from(packages).join('\\n');
}
```

---

## Phase 8: Database Schema Updates (Priority: MEDIUM)

### 8.1 Enhanced Schema

**Location:** `convex/schema.ts`

```typescript
const applicationTables = {
  agents: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    model: v.string(),
    modelProvider: v.string(), // "bedrock", "ollama", "openai", etc.
    systemPrompt: v.string(),
    tools: v.array(v.object({
      name: v.string(),
      type: v.string(),
      config: v.optional(v.any()),
      requiresPip: v.optional(v.boolean()),
      pipPackages: v.optional(v.array(v.string())),
      extrasPip: v.optional(v.string()),
    })),
    generatedCode: v.string(),
    dockerConfig: v.optional(v.string()),
    deploymentType: v.string(),
    deploymentPlatform: v.optional(v.string()), // "aws", "azure", "gcp", "agentcore"
    containerImage: v.optional(v.string()),
    deploymentUrl: v.optional(v.string()),
    status: v.string(), // "draft", "generated", "tested", "deployed"
    testResults: v.optional(v.array(v.object({
      query: v.string(),
      response: v.string(),
      logs: v.string(),
      success: v.boolean(),
      executionTime: v.number(),
      memoryUsed: v.number(),
      timestamp: v.number(),
    }))),
    createdBy: v.id("users"),
    isPublic: v.optional(v.boolean()),
  }).index("by_user", ["createdBy"])
    .index("by_public", ["isPublic"])
    .index("by_status", ["status"]),

  toolRegistry: defineTable({
    name: v.string(),
    displayName: v.string(),
    description: v.string(),
    category: v.string(),
    capabilities: v.array(v.string()),
    requiresBasePip: v.boolean(),
    extrasPip: v.optional(v.string()),
    imports: v.array(v.string()),
    notSupportedOn: v.optional(v.array(v.string())),
    documentation: v.string(),
    exampleUsage: v.optional(v.string()),
    githubUrl: v.string(),
    lastUpdated: v.number(),
  }).index("by_category", ["category"])
    .index("by_name", ["name"]),

  testRuns: defineTable({
    agentId: v.id("agents"),
    query: v.string(),
    response: v.string(),
    logs: v.string(),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    executionTime: v.number(),
    memoryUsed: v.number(),
    timestamp: v.number(),
  }).index("by_agent", ["agentId"])
    .index("by_timestamp", ["timestamp"]),
};
```

---

## Phase 9: Documentation & Diagrams (Priority: LOW)

### 9.1 Update WARP.md

**Add sections:**
- Model selection guide
- Tool selection best practices
- Docker testing workflow
- Multi-cloud deployment options
- Meta-tooling capabilities
- AgentCore integration guide

### 9.2 Create Architecture Diagrams

**Files to Create:**
- `docs/architecture/system-overview.md` - High-level architecture
- `docs/architecture/data-flow.md` - Data flow diagrams
- `docs/architecture/deployment.md` - Deployment architecture
- `docs/architecture/testing-workflow.md` - Testing infrastructure

### 9.3 API Documentation

**Create OpenAPI spec for generated agents:**
```yaml
# docs/api/agent-api-spec.yaml
openapi: 3.0.0
info:
  title: Generated Agent API
  version: 1.0.0
paths:
  /invoke:
    post:
      summary: Invoke the agent
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                context:
                  type: object
      responses:
        '200':
          description: Agent response
```

---

## Phase 10: Testing & Validation (Priority: HIGH)

### 10.1 Unit Tests

**Create test suite:**
```
tests/
├── unit/
│   ├── test_code_generator.ts
│   ├── test_model_selector.ts
│   ├── test_tool_registry.ts
│   └── test_meta_tooling.ts
├── integration/
│   ├── test_docker_service.ts
│   ├── test_agent_generation.ts
│   └── test_deployment.ts
└── e2e/
    ├── test_agent_creation_flow.ts
    └── test_agent_testing_flow.ts
```

### 10.2 Validation Rules

**Implement validation for:**
- Model ID format
- Tool compatibility
- Platform restrictions (e.g., python_repl on Windows)
- Dependency conflicts
- Resource limits
- Security checks

---

## Implementation Timeline

### Week 1-2: Phase 1 & 2 (CRITICAL PATH)
- [ ] Day 1-3: Model Selector enhancement (Bedrock + Ollama)
- [ ] Day 4-7: Tool Registry integration
- [ ] Day 8-10: Enhanced Tool Selector UI
- [ ] Day 11-14: Code generation updates

### Week 3-4: Phase 3 & 4 (HIGH PRIORITY)
- [ ] Day 15-18: Meta-tooling system
- [ ] Day 19-21: Docker testing infrastructure
- [ ] Day 22-25: Testing UI component
- [ ] Day 26-28: Integration testing

### Week 5-6: Phase 5 & 6 (MEDIUM PRIORITY)
- [ ] Day 29-32: MCP integration for multi-cloud
- [ ] Day 33-36: AgentCore integration
- [ ] Day 37-40: Platform-specific deployment templates
- [ ] Day 41-42: Documentation

### Week 7-8: Phase 7-10 (POLISH & VALIDATION)
- [ ] Day 43-46: Enhanced code generation
- [ ] Day 47-49: Database schema updates
- [ ] Day 50-52: Testing & validation
- [ ] Day 53-56: Bug fixes & optimization

---

## Success Criteria

### Phase 1-2 Complete When:
- ✅ All Bedrock models selectable with correct IDs
- ✅ All Ollama models selectable with correct IDs
- ✅ All 50+ strands_tools available in UI
- ✅ Tool dependencies correctly mapped
- ✅ Generated code uses proper imports

### Phase 3-4 Complete When:
- ✅ Prompt analysis identifies missing tools
- ✅ Dynamic tool generation works
- ✅ Docker testing runs successfully
- ✅ Test results displayed in UI
- ✅ Resource cleanup works properly

### Phase 5-6 Complete When:
- ✅ AWS deployment configs generated
- ✅ Azure deployment configs generated
- ✅ GCP deployment configs generated
- ✅ AgentCore deployment works
- ✅ MCP documentation integration functional

### Overall Success When:
- ✅ User can select any model and it works
- ✅ User can add any tool and dependencies are correct
- ✅ User can test agent in Docker before deployment
- ✅ User can deploy to multiple platforms
- ✅ Meta-tooling creates functional tools
- ✅ All tests pass
- ✅ Documentation is complete

---

## Risk Mitigation

### Technical Risks:
1. **Docker on Windows** - Some tools (python_repl) don't work on Windows
   - Mitigation: Detect platform and warn users

2. **Ollama Connectivity** - Ollama must be running locally
   - Mitigation: Test connection before generation

3. **Tool Dependency Conflicts** - Some tools may have conflicting dependencies
   - Mitigation: Test in isolated environments

4. **LLM API Limits** - Meta-tooling may hit rate limits
   - Mitigation: Implement caching and rate limiting

### Operational Risks:
1. **Docker Resource Usage** - Testing may consume significant resources
   - Mitigation: Implement cleanup and resource limits

2. **Cost of Cloud Deployments** - Users may incur unexpected costs
   - Mitigation: Show cost estimates and warnings

---

## Next Steps

1. **Review this plan** - Validate approach and timeline
2. **Set up development environment** - Ensure Docker, Convex, etc. are ready
3. **Create feature branches** - One per phase
4. **Begin Phase 1** - Start with model selector enhancements
5. **Daily standups** - Track progress and blockers

---

## Questions to Address Before Starting:

1. ✅ Confirmed: Use `llama3.3` or `llama3.3:70b` for Ollama?
2. ✅ Confirmed: Docker Desktop is installed and running?
3. ✅ Confirmed: Convex deployment is fully functional?
4. ✅ Need to clarify: What is the preferred AgentCore deployment method?
5. ✅ Need to clarify: Should we support Anthropic Direct API in addition to Bedrock?
6. ✅ Confirmed: LangSmith API key is ready to use?

---
