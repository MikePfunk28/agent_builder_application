# Current Session Summary - Model Registry & AgentCore Integration

**Date**: 2025-10-13
**Focus**: Model Registry Implementation + AgentCore Deployment Understanding

## Completed This Session

### 1. Model Registry Implementation ✅ (752 lines)
**File**: `convex/modelRegistry.ts`

Comprehensive registry with **49 models**:

#### AWS Bedrock Models (17 models)
- **Claude 4.5 Sonnet** - Latest with interleaved reasoning ⭐ RECOMMENDED
- **Claude 4.1 Opus** - Most capable for complex reasoning
- **Claude 4.0 Series** - Opus & Sonnet variants
- **Claude 3.7 Sonnet** - Previous generation
- **Claude 3.5 Haiku** - Fast and cost-effective ⭐ RECOMMENDED
- **Claude 3.5 Sonnet** - Previous generation
- **Claude 3 Haiku** - Fastest Claude 3
- **Amazon Nova Pro** - Flagship multimodal ⭐ RECOMMENDED
- **Amazon Nova Lite** - Lightweight multimodal
- **Amazon Nova Micro** - Ultra-fast text-only
- **Amazon Nova Premier** - Most capable Nova
- **Amazon Nova Canvas** - Image generation
- **Amazon Nova Reel** - Video generation
- **Amazon Titan Image Generator V2** - Image generation

#### Ollama Models (32 models)
**Qwen3 Series** (7 models):
- `qwen3:4b` ⭐ Lightweight
- `qwen3:8b` ⭐ Balanced
- `qwen3:14b`, `qwen3:30b`
- `qwen3-coder:30b` ⭐ Coding specialist
- `qwen3-embedding:4b`, `qwen3-embedding:8b`

**Llama Series** (5 models):
- `llama3.3` ⭐ Latest flagship
- `llama3.2:3b`, `llama3.2:1b`, `llama3.1:8b`
- `llama3.2-vision:11b` - Multimodal

**Phi Series** (3 models):
- `phi4:14b` ⭐ Reasoning-focused
- `phi4-mini:3.8b`, `phi4-mini-reasoning:3.8b`

**Gemma Series** (4 models):
- `gemma3:4b`, `gemma3:12b`, `gemma3:27b`
- `codegemma:7b` - Coding specialist

**DeepSeek Series** (4 models):
- `deepseek-r1:8b` ⭐ Reasoning model
- `deepseek-coder:6.7b` ⭐ Coding specialist
- `deepseek-coder:33b`, `deepseek-v3`

**Mistral Series** (2 models):
- `mistral-nemo`, `devstral:24b` - Coding specialist

### 2. Code Generator Integration ✅
**File**: `convex/codeGenerator.ts` (Updated)

Integrated model registry with code generator:
- `getModelConfig()` function provides model-specific imports
- Automatic model initialization code based on provider
- Bedrock models get boto3 and botocore imports
- Ollama models get OllamaModel imports
- LangSmith and OpenTelemetry monitoring added

### 3. AgentCore Deployment Documentation Review ✅
**File**: `docs/manual_deploy.md`

Key insights from manual deployment process:

#### AgentCore Runtime Requirements
1. **Platform**: MUST be `linux/arm64` (critical!)
2. **Endpoints Required**:
   - `/invocations` (POST) - Main agent interaction
   - `/ping` (GET) - Health check
3. **Port**: Application runs on port 8080
4. **Container**: Must be deployed to ECR
5. **Runtime Format**: FastAPI server with Pydantic models

#### FastAPI Structure for AgentCore
```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class InvocationRequest(BaseModel):
    input: Dict[str, Any]

class InvocationResponse(BaseModel):
    output: Dict[str, Any]

@app.post("/invocations")
async def invoke_agent(request: InvocationRequest):
    # Process with Strands Agent
    return InvocationResponse(output=result)

@app.get("/ping")
async def ping():
    return {"status": "healthy"}
```

#### Deployment Process
1. **Build ARM64 image**: `docker buildx build --platform linux/arm64`
2. **Push to ECR**: AWS container registry
3. **Create AgentCore Runtime**: Using `bedrock-agentcore-control` client
4. **Invoke Agent**: Using `bedrock-agentcore` client

#### Observability Features
- Built-in CloudWatch integration
- AWS OpenTelemetry Distro for tracing
- Transaction search in CloudWatch
- Session ID propagation
- Custom headers support

## Architecture Decisions

### Model Configuration Strategy
Instead of hardcoding model imports, we use `getModelConfig()`:

```typescript
// For Bedrock models
{
  provider: "bedrock",
  imports: [
    "from strandsagents.models import BedrockModel",
    "import boto3",
    "from botocore.config import Config"
  ],
  initCode: `
config = Config(
    region_name=os.getenv("AWS_REGION", "us-east-1"),
    retries={'max_attempts': 3, 'mode': 'adaptive'}
)
model = BedrockModel(
    model_id="anthropic.claude-sonnet-4-5-20250929-v1:0",
    config=config,
    temperature=0.3,
    streaming=True
)`
}

// For Ollama models
{
  provider: "ollama",
  imports: ["from strandsagents.models import OllamaModel"],
  initCode: `
model = OllamaModel(
    model_id="qwen3:8b",
    host=os.getenv("OLLAMA_HOST", "http://localhost:11434"),
    temperature=0.7
)`
}
```

### Platform Detection Pattern
From `tools_list.md`, we see the proper pattern for Windows compatibility:

```python
if platform.system() != "Windows":
    from strands_tools import python_repl, shell
    tools |= {
        "python_repl": python_repl,
        "shell": shell,
    }
```

This matches our tool registry's `notSupportedOn: ["windows"]` approach.

## Generated Agent Structure

With model registry integration, generated agents now have:

```python
"""
Generated Agent: MyAgent
Model: anthropic.claude-sonnet-4-5-20250929-v1:0
Generated: 2025-10-13T14:36:59Z
"""

# Core imports
import os, sys, asyncio
from typing import Any, Dict, List, Optional, Callable
import logging

# Strands Agents imports
from strandsagents import agent, Agent, tool

# Model imports (from model registry)
from strandsagents.models import BedrockModel
import boto3
from botocore.config import Config

# Tool imports
from strandsagents.tools import (
    calculator,
    file_read,
    http_request,
    # ... based on selected tools
)

# Monitoring imports
from langsmith import Client as LangSmithClient
from opentelemetry import trace

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize monitoring
langsmith_client = LangSmithClient(
    api_key=os.getenv('LANGSMITH_API_KEY', 'lsv2_...')
)
tracer = trace.get_tracer(__name__)

# ============================================================================
# MODEL CONFIGURATION (from model registry)
# ============================================================================
config = Config(
    region_name=os.getenv("AWS_REGION", "us-east-1"),
    retries={'max_attempts': 3, 'mode': 'adaptive'}
)

model = BedrockModel(
    model_id="anthropic.claude-sonnet-4-5-20250929-v1:0",
    config=config,
    temperature=0.3,
    streaming=True
)

# ============================================================================
# AGENT DEFINITION
# ============================================================================
@agent(
    model=model,
    system_prompt="...",
    tools=[calculator, file_read, http_request],
    memory=True,
    reasoning="interleaved"
)
class MyAgent(Agent):
    # ... agent implementation
```

## Next Implementation Steps

### Priority 1: AgentCore Deployment Generator ⏳
**File**: `convex/agentcoreDeployment.ts` (NEW)

Based on `manual_deploy.md`, create generators for:

1. **FastAPI Wrapper**
```python
# agentcore_server.py
from fastapi import FastAPI
from pydantic import BaseModel
from strands import Agent

app = FastAPI()

# Wrap generated agent
agent = GeneratedAgent()

@app.post("/invocations")
async def invoke_agent(request: InvocationRequest):
    result = await agent.run(request.input["prompt"])
    return InvocationResponse(output={"message": result})

@app.get("/ping")
async def ping():
    return {"status": "healthy"}
```

2. **ARM64 Dockerfile**
```dockerfile
FROM --platform=linux/arm64 ghcr.io/astral-sh/uv:python3.11-bookworm-slim
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-cache
COPY agent.py agentcore_server.py ./
EXPOSE 8080
CMD ["uv", "run", "uvicorn", "agentcore_server:app", "--host", "0.0.0.0", "--port", "8080"]
```

3. **Deployment Script**
```python
# deploy_to_agentcore.py
import boto3

client = boto3.client('bedrock-agentcore-control')
response = client.create_agent_runtime(
    agentRuntimeName='my-agent',
    agentRuntimeArtifact={
        'containerConfiguration': {
            'containerUri': '<ecr-uri>'
        }
    },
    networkConfiguration={"networkMode": "PUBLIC"},
    roleArn='<iam-role-arn>'
)
```

4. **Invocation Script**
```python
# invoke_agent.py
import boto3
import json

client = boto3.client('bedrock-agentcore')
response = client.invoke_agent_runtime(
    agentRuntimeArn='<runtime-arn>',
    runtimeSessionId='<session-id>',  # 33+ chars
    payload=json.dumps({"input": {"prompt": "Hello"}}),
    qualifier="DEFAULT"
)
```

### Priority 2: Meta-Tooling System ⏳
**File**: `convex/metaTooling.ts` (NEW)

Implement:
- `analyzePromptForTools()` - Detect tool requirements
- `generateToolCode()` - Create @tool decorated functions
- `generateMCPServer()` - Create MCP servers for domains

### Priority 3: Docker Testing Infrastructure ⏳
**Files**: 
- `convex/dockerService.ts` (NEW)
- `src/components/AgentTester.tsx` (NEW)

## Statistics

### Code Generated
- **Model Registry**: 752 lines
- **Code Generator Updates**: ~50 lines modified
- **Total New Code**: ~800 lines

### Total Project
- **Phase 7 Code Generation**: 1,307 lines
- **Tool Registry**: 773 lines
- **Model Registry**: 752 lines
- **Total Backend**: ~2,832 lines
- **Documentation**: ~3,600 lines
- **Total Project**: ~6,432 lines

## Key Insights from Documentation

### 1. AgentCore is ARM64 Only
This is CRITICAL - all containers MUST be built for `linux/arm64`:
```bash
docker buildx build --platform linux/arm64 -t my-agent:arm64
```

### 2. FastAPI is the Standard
AgentCore expects a FastAPI server with specific endpoints:
- `/invocations` - POST endpoint for agent interaction
- `/ping` - GET endpoint for health checks

### 3. Observability is Built-In
AgentCore provides:
- Automatic CloudWatch integration
- X-Ray tracing support
- Session ID tracking
- Custom headers for enhanced tracing

### 4. ECR is Required
Cannot use Docker Hub or other registries - MUST deploy to ECR:
```bash
aws ecr create-repository --repository-name my-agent
aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
```

### 5. Session IDs Must Be 33+ Characters
From documentation:
```python
runtimeSessionId='dfmeoagmreaklgmrkleafremoigrmtesogmtrskhmtkrlshmt'  # 33+ chars
```

## Recommended Model Configurations

Based on model registry + use cases:

### General Purpose Agents
- **Bedrock**: `anthropic.claude-sonnet-4-5-20250929-v1:0` (flagship)
- **Ollama**: `qwen3:8b` (balanced)

### Fast/Cost-Effective
- **Bedrock**: `anthropic.claude-3-5-haiku-20241022-v1:0`
- **Ollama**: `qwen3:4b`

### Coding Specialists
- **Ollama**: `qwen3-coder:30b`, `deepseek-coder:6.7b`, `codegemma:7b`

### Reasoning Tasks
- **Bedrock**: `anthropic.claude-opus-4-1-20250805-v1:0`
- **Ollama**: `phi4:14b`, `deepseek-r1:8b`

### Multimodal
- **Bedrock**: `amazon.nova-pro-v1:0` (text + vision)
- **Ollama**: `llama3.2-vision:11b`

### Image/Video Generation
- **Bedrock**: `amazon.nova-canvas-v1:0` (images), `amazon.nova-reel-v1:0` (videos)

## Success Criteria

### Completed ✅
- 49 models with complete metadata
- Model-specific import generation
- Proper initialization code per provider
- Cost estimates for Bedrock models
- Context window and capability tracking
- Recommended models flagged
- Category-based organization

### In Progress 🔄
- AgentCore deployment file generation
- FastAPI wrapper for AgentCore
- ARM64 Docker configuration
- ECR deployment scripts
- Meta-tooling system

### Planned ⏳
- Model selector UI enhancement
- Docker testing infrastructure
- Workflow engine with model selection
- Template library with recommended models

## Technical Decisions

### 1. Model Registry in Code vs Database
**Decision**: Keep in TypeScript constant
**Rationale**: 
- Models don't change frequently
- Easier version control
- Faster queries (no DB lookup)
- Can migrate later if needed

### 2. Provider-Specific Imports
**Decision**: Generate imports dynamically from model config
**Rationale**:
- Avoids duplication
- Correct imports for each provider
- Easier to add new providers
- Single source of truth

### 3. Monitoring Always Included
**Decision**: Always add LangSmith + OpenTelemetry
**Rationale**:
- Production-ready by default
- Matches AgentCore observability
- Easy to disable if not needed
- Better debugging experience

## Next Session Focus

1. **Implement AgentCore Deployment Generator**
   - FastAPI server wrapper
   - ARM64 Dockerfile
   - ECR deployment scripts
   - Invocation examples

2. **Create Meta-Tooling System**
   - Prompt analysis
   - Tool requirement detection
   - Dynamic tool generation

3. **Build Docker Testing Infrastructure**
   - Local testing before deployment
   - Log streaming
   - Performance metrics

---

**Files Modified This Session**:
- `convex/modelRegistry.ts` - Created (NEW) - 752 lines
- `convex/codeGenerator.ts` - Updated imports and model init
- `docs/current_session_summary.md` - Created (NEW)

**Ready for Next Phase**: AgentCore Deployment Generator
