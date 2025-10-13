# Comprehensive Agent Builder Plan

## Overview

This document outlines the complete plan for building an intelligent agent creation platform with automatic dependency management, testing, and deployment capabilities.

## Enhanced @agent Decorator Design

### Core Concept

Create an enhanced `@agent` decorator that handles:
1. Pre-processing and post-processing functions
2. Automatic tool dependency resolution
3. Container setup and testing
4. Pip package installation
5. Environment validation

### Decorator Signature

```python
from strands import agent, Agent
from typing import Callable, List, Dict, Optional

@agent(
    model: str,
    system_prompt: str,
    tools: List[str | Callable],
    
    # New: Pre/Post Processing
    pre_process: Optional[Callable] = None,
    post_process: Optional[Callable] = None,
    
    # New: Automatic Dependency Management
    auto_install_tools: bool = True,
    verify_dependencies: bool = True,
    
    # New: Container Configuration
    container_setup: Optional[Dict] = None,
    test_in_container: bool = False,
    
    # Existing
    memory: bool = True,
    code_interpreter: bool = True,
    reasoning: str = "interleaved"
)
class MyAgent(Agent):
    pass
```

### Example Usage

```python
from strands import agent, Agent, tool
from strands_tools import calculator, file_read, browser

# Define pre-processing function
def preprocess_input(message: str, context: dict) -> tuple[str, dict]:
    """Clean and validate input before agent processing"""
    message = message.strip().lower()
    context['preprocessed'] = True
    context['timestamp'] = datetime.now()
    return message, context

# Define post-processing function
def postprocess_output(response: str, context: dict) -> str:
    """Format and enhance output after agent processing"""
    response = response.strip()
    if context.get('add_timestamp'):
        response += f"\n\n[Generated at {context['timestamp']}]"
    return response

# Create agent with enhanced decorator
@agent(
    model="anthropic.claude-sonnet-4-5-20250929-v1:0",
    system_prompt="""You are a helpful research assistant that helps users 
    find and analyze information.""",
    
    # Tools - automatically resolved and installed
    tools=[
        calculator,
        file_read,
        browser,
        "http_request",  # String references auto-imported from strands_tools
        "diagram",       # Automatically installs extras: strands-agents-tools[diagram]
    ],
    
    # Pre/Post Processing
    pre_process=preprocess_input,
    post_process=postprocess_output,
    
    # Automatic Dependency Management
    auto_install_tools=True,  # Automatically pip install required packages
    verify_dependencies=True,  # Verify all dependencies before running
    
    # Container Configuration
    container_setup={
        "base_image": "python:3.11-slim",
        "environment_vars": {
            "BYPASS_TOOL_CONSENT": "true"
        },
        "volumes": ["./data:/app/data"],
        "ports": {"8080": "8080"}
    },
    test_in_container=True,  # Run test suite in container before deployment
    
    memory=True,
    code_interpreter=True,
    reasoning="interleaved"
)
class ResearchAgent(Agent):
    """Enhanced research agent with automatic setup"""
    
    async def custom_workflow(self, query: str):
        """Custom workflow that uses pre/post processing"""
        # Pre-processing happens automatically
        response = await self.process_message(query)
        # Post-processing happens automatically
        return response
```

## Automatic Dependency Resolution System

### Tool Registry

Create a comprehensive tool registry that maps tool names to their dependencies:

```python
# convex/toolRegistry.ts
export const TOOL_REGISTRY = {
    "calculator": {
        package: "strands-agents-tools",
        imports: ["from strands_tools import calculator"],
        extras: null,
        system_deps: [],
        platform_restrictions: []
    },
    "browser": {
        package: "strands-agents-tools",
        imports: ["from strands_tools import browser"],
        extras: "local_chromium_browser",
        system_deps: ["chromium", "chromium-driver"],
        platform_restrictions: []
    },
    "python_repl": {
        package: "strands-agents-tools",
        imports: ["from strands_tools import python_repl"],
        extras: null,
        system_deps: [],
        platform_restrictions: ["windows"]  // NOT SUPPORTED
    },
    "shell": {
        package: "strands-agents-tools",
        imports: ["from strands_tools import shell"],
        extras: null,
        system_deps: [],
        platform_restrictions: ["windows"]  // NOT SUPPORTED
    },
    "mem0_memory": {
        package: "strands-agents-tools",
        imports: ["from strands_tools import mem0_memory"],
        extras: "mem0_memory",
        system_deps: [],
        platform_restrictions: []
    },
    "diagram": {
        package: "strands-agents-tools",
        imports: ["from strands_tools import diagram"],
        extras: "diagram",
        system_deps: ["graphviz"],
        platform_restrictions: []
    },
    // ... all other tools
};
```

### Dependency Resolution Flow

```
1. User selects tools in UI
   ↓
2. System checks TOOL_REGISTRY for each tool
   ↓
3. Collect all dependencies:
   - Base package: strands-agents-tools
   - Extras: [mem0_memory, diagram, browser, ...]
   - System deps: [graphviz, chromium, ...]
   ↓
4. Check platform restrictions
   - Warn if tool not supported on Windows
   ↓
5. Generate requirements.txt:
   strands-agents>=1.0.0
   strands-agents-tools[mem0_memory,diagram,browser]>=1.0.0
   ↓
6. Generate Dockerfile with system dependencies:
   RUN apt-get install -y graphviz chromium
   ↓
7. Validate in test container
   ↓
8. Return validated agent code
```

## Container Testing System

### Test Container Workflow

```
Agent Configuration
   ↓
Generate Agent Code
   ↓
Create Test Container
   ↓
Install Dependencies
   ↓
Run Validation Tests:
   - Import all tools
   - Test each tool function
   - Verify model connection
   - Run sample queries
   ↓
Collect Results:
   - Success/Failure
   - Execution logs
   - Performance metrics
   ↓
Return to User
```

### Container Test Implementation

```typescript
// convex/containerTesting.ts

export const testAgentInContainer = action({
    args: {
        agentCode: v.string(),
        requirements: v.string(),
        dockerfile: v.string(),
        testQueries: v.array(v.string())
    },
    handler: async (ctx, args) => {
        // 1. Create temporary directory
        const tempDir = `/tmp/agent-test-${Date.now()}`;
        
        // 2. Write files
        await writeFile(`${tempDir}/agent.py`, args.agentCode);
        await writeFile(`${tempDir}/requirements.txt`, args.requirements);
        await writeFile(`${tempDir}/Dockerfile`, args.dockerfile);
        await writeFile(`${tempDir}/test_agent.py`, generateTestScript(args.testQueries));
        
        // 3. Build Docker image
        const imageName = `agent-test:${Date.now()}`;
        await execCommand(`docker build -t ${imageName} ${tempDir}`);
        
        // 4. Run tests in container
        const containerId = await execCommand(
            `docker run -d --name test-${Date.now()} ${imageName} python test_agent.py`
        );
        
        // 5. Stream logs
        const logs = await streamLogs(containerId);
        
        // 6. Get test results
        const results = await execCommand(
            `docker exec ${containerId} cat /app/test_results.json`
        );
        
        // 7. Cleanup
        await execCommand(`docker stop ${containerId}`);
        await execCommand(`docker rm ${containerId}`);
        await execCommand(`docker rmi ${imageName}`);
        await execCommand(`rm -rf ${tempDir}`);
        
        return {
            success: results.all_tests_passed,
            logs: logs,
            test_results: JSON.parse(results),
            metrics: {
                build_time: results.build_time,
                test_time: results.test_time,
                memory_used: results.memory_used
            }
        };
    }
});
```

## Enhanced Code Generation

### Generated Agent Structure

```python
"""
Generated Agent: {name}
Auto-generated with dependency validation and container testing
"""

import asyncio
import logging
from datetime import datetime
from typing import Optional, Dict, Any

# Strands imports
from strands import Agent, agent, tool
from strands.models import BedrockModel, OllamaModel

# Tool imports (auto-detected from TOOL_REGISTRY)
from strands_tools import {tool_list}

# AgentCore imports
from agentcore.memory import MemoryManager
from agentcore.interpreter import CodeInterpreter

# Observability
from langsmith import Client as LangSmithClient
from opentelemetry import trace

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Setup LangSmith
langsmith = LangSmithClient(
    api_key="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"
)

# Setup OpenTelemetry
tracer = trace.get_tracer(__name__)


# Pre-processing function
def preprocess_input(message: str, context: Optional[Dict] = None) -> tuple:
    """Pre-process input before agent handles it"""
    context = context or {}
    
    # Validation
    if not message or not message.strip():
        raise ValueError("Message cannot be empty")
    
    # Enhancement
    context['received_at'] = datetime.now().isoformat()
    context['preprocessed'] = True
    
    # Cleaning
    message = message.strip()
    
    logger.info(f"Pre-processed message: {message[:50]}...")
    return message, context


# Post-processing function
def postprocess_output(response: str, context: Optional[Dict] = None) -> str:
    """Post-process output before returning to user"""
    context = context or {}
    
    # Enhancement
    if response and not response.endswith(('.', '!', '?')):
        response += '.'
    
    # Metadata (optional)
    if context.get('add_metadata'):
        response += f"\n\n[Processed at {datetime.now().isoformat()}]"
    
    logger.info(f"Post-processed response: {response[:50]}...")
    return response


# Model configuration
{model_init_code}


# Agent definition with enhanced decorator
@agent(
    model=model,
    system_prompt=\"\"\"{system_prompt}\"\"\",
    tools=[{tool_list}],
    pre_process=preprocess_input,
    post_process=postprocess_output,
    memory=True,
    code_interpreter=True,
    reasoning="interleaved"
)
class {AgentClassName}(Agent):
    \"\"\"
    {agent_description}
    
    This agent was auto-generated with:
    - Verified tool dependencies
    - Container testing
    - Pre/post processing hooks
    \"\"\"
    
    def __init__(self):
        super().__init__()
        self.memory = MemoryManager()
        self.interpreter = CodeInterpreter()
        logger.info(f"Agent {self.__class__.__name__} initialized successfully")
    
    async def process_message(
        self, 
        message: str, 
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        \"\"\"
        Process message with full pipeline:
        1. Pre-processing (validation, enhancement)
        2. Agent processing (with tools, memory, reasoning)
        3. Post-processing (formatting, metadata)
        \"\"\"
        with tracer.start_as_current_span("process_message") as span:
            try:
                # Pre-processing happens via decorator
                # But we can add custom logic here too
                context = context or {}
                
                # Store in memory
                self.memory.store_message(message, context)
                
                # Generate response with interleaved reasoning
                response = await self.generate_response(
                    message=message,
                    context=context,
                    reasoning_mode="interleaved"
                )
                
                # Log to LangSmith
                langsmith.log_run({
                    "input": message,
                    "output": response,
                    "metadata": context
                })
                
                # Post-processing happens via decorator
                return response
                
            except Exception as e:
                logger.error(f"Error processing message: {e}")
                span.record_exception(e)
                raise


# Main execution
async def main():
    \"\"\"Interactive mode for testing\"\"\"
    agent = {AgentClassName}()
    
    print(f"🤖 {agent.__class__.__name__} is ready!")
    print("Type 'exit' to quit\\n")
    
    while True:
        try:
            user_input = input("You: ")
            if user_input.lower() in ['exit', 'quit']:
                break
            
            response = await agent.process_message(user_input)
            print(f"Agent: {response}\\n")
            
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"Error: {e}\\n")


if __name__ == "__main__":
    asyncio.run(main())
```

### Enhanced Requirements.txt Generation

```python
def generateRequirements(tools: Tool[]): string {
    const packages = new Set([
        'strands-agents>=1.0.0',
        'langsmith>=0.1.0',
        'opentelemetry-api>=1.0.0',
        'opentelemetry-sdk>=1.0.0'
    ]);
    
    // Collect all extras
    const extras = new Set<string>();
    
    for (const tool of tools) {
        // Base package
        packages.add('strands-agents-tools>=1.0.0');
        
        // Extras
        if (tool.extrasPip) {
            extras.add(tool.extrasPip);
        }
        
        // Additional pip packages
        if (tool.pipPackages && tool.pipPackages.length > 0) {
            tool.pipPackages.forEach(pkg => packages.add(pkg));
        }
    }
    
    // Combine base package with extras
    if (extras.size > 0) {
        packages.add(`strands-agents-tools[${Array.from(extras).join(',')}]>=1.0.0`);
    }
    
    return Array.from(packages).join('\\n');
}
```

### Enhanced Dockerfile Generation

```python
function generateDockerfile(tools: Tool[], modelProvider: string): string {
    const systemDeps = getSystemDependencies(tools);
    
    return `FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV BYPASS_TOOL_CONSENT=true

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    build-essential \\
    curl \\
    git \\
    ${systemDeps.join(' \\\n    ')} \\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \\
    pip install --no-cache-dir -r requirements.txt

# Copy agent code
COPY agent.py .
COPY tools/ ./tools/

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD python -c "import agent; print('healthy')"

# Run agent
CMD ["python", "agent.py"]
`;
}

function getSystemDependencies(tools: Tool[]): string[] {
    const deps = new Set<string>();
    
    tools.forEach(tool => {
        switch(tool.type) {
            case 'browser':
            case 'agent_core_browser':
                deps.add('chromium');
                deps.add('chromium-driver');
                break;
            case 'diagram':
                deps.add('graphviz');
                break;
            case 'use_computer':
                deps.add('xvfb');
                deps.add('x11vnc');
                break;
        }
    });
    
    return Array.from(deps);
}
```

## Implementation Task List

### Phase 1: Enhanced Model & Tool Support ✅
- [x] Add all Bedrock models with correct IDs
- [x] Add all Ollama models  
- [x] Add 50+ strands-agents-tools
- [x] Show pip extras and platform warnings

### Phase 2: Code Generator Enhancement (CURRENT)
- [ ] Update generateAgent action to handle new tool structure
- [ ] Implement model provider detection (Bedrock vs Ollama)
- [ ] Generate correct model initialization code
- [ ] Generate proper tool imports from strands_tools
- [ ] Create comprehensive requirements.txt with extras
- [ ] Add pre/post processing function generation
- [ ] Generate enhanced agent class with hooks

### Phase 3: Container Testing System
- [ ] Create Docker testing service in Convex
- [ ] Implement container build and test workflow
- [ ] Add test result streaming to frontend
- [ ] Create test validation UI component
- [ ] Add retry logic for failed builds

### Phase 4: Dependency Validation
- [ ] Create tool registry with full dependency mapping
- [ ] Implement platform compatibility checking
- [ ] Add system dependency detection
- [ ] Create dependency conflict resolution
- [ ] Generate warnings for unsupported combinations

### Phase 5: Enhanced @agent Decorator (Backend)
- [ ] Design decorator API with pre/post processing
- [ ] Implement automatic dependency resolution
- [ ] Add container setup configuration
- [ ] Create validation and testing hooks
- [ ] Document decorator parameters

### Phase 6: Diagram Generation
- [ ] Add diagram generation using strands_tools diagram
- [ ] Create architecture diagram from agent config
- [ ] Add diagram as downloadable tab in UI
- [ ] Generate Mermaid diagrams for workflows

### Phase 7: Complete Package Download
- [ ] Create ZIP download functionality
- [ ] Include all files: agent.py, requirements.txt, Dockerfile, etc.
- [ ] Add README with setup instructions
- [ ] Include deployment scripts for AWS/Azure/GCP
- [ ] Add docker-compose.yml for local testing

### Phase 8: Testing & Validation
- [ ] Test Bedrock model configurations
- [ ] Test Ollama model configurations
- [ ] Test all tool combinations
- [ ] Validate container builds
- [ ] Test complete deployment workflow

### Phase 9: Documentation
- [ ] Update WARP.md with new features
- [ ] Create agent decorator documentation
- [ ] Add container testing guide
- [ ] Create deployment tutorials
- [ ] Add troubleshooting guide

### Phase 10: Production Deployment
- [ ] Test all changes locally
- [ ] Deploy Convex backend updates
- [ ] Push frontend changes
- [ ] Update production environment variables
- [ ] Monitor for issues

## Success Criteria

### Functional Requirements
✅ User can select any Bedrock or Ollama model
✅ User can select any of 50+ strands-agents-tools
✅ Platform warnings shown for incompatible tools
✅ Extras dependencies correctly identified
- [ ] Pre/post processing functions generated
- [ ] Container testing validates all dependencies
- [ ] Generated code includes proper imports
- [ ] Requirements.txt includes all extras
- [ ] Dockerfile includes system dependencies
- [ ] ZIP download includes complete package
- [ ] Diagram shows agent architecture

### Non-Functional Requirements
- [ ] Code generation completes in < 10 seconds
- [ ] Container build completes in < 2 minutes
- [ ] Container tests complete in < 1 minute
- [ ] UI remains responsive during generation
- [ ] Error messages are clear and actionable
- [ ] All tools work in generated containers

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Agent Builder UI                         │
│  ┌────────────┐  ┌────────────┐  ┌─────────────┐           │
│  │   Model    │  │   Tools    │  │   Config    │           │
│  │  Selector  │  │  Selector  │  │   Editor    │           │
│  └─────┬──────┘  └─────┬──────┘  └──────┬──────┘           │
└────────┼───────────────┼─────────────────┼──────────────────┘
         │               │                 │
         └───────────────┴─────────────────┘
                         │
         ┌───────────────▼──────────────────┐
         │    Enhanced Code Generator        │
         │  ┌────────────────────────────┐  │
         │  │ 1. Resolve Dependencies    │  │
         │  │ 2. Generate Pre/Post Hooks │  │
         │  │ 3. Create Agent Class      │  │
         │  │ 4. Build Requirements.txt  │  │
         │  │ 5. Generate Dockerfile     │  │
         │  └────────────────────────────┘  │
         └───────────────┬──────────────────┘
                         │
         ┌───────────────▼──────────────────┐
         │    Container Testing System       │
         │  ┌────────────────────────────┐  │
         │  │ 1. Build Container         │  │
         │  │ 2. Install Dependencies    │  │
         │  │ 3. Validate Tools          │  │
         │  │ 4. Run Test Queries        │  │
         │  │ 5. Collect Metrics         │  │
         │  └────────────────────────────┘  │
         └───────────────┬──────────────────┘
                         │
         ┌───────────────▼──────────────────┐
         │         Download Package          │
         │  ┌────────────────────────────┐  │
         │  │ - agent.py                 │  │
         │  │ - requirements.txt         │  │
         │  │ - Dockerfile               │  │
         │  │ - docker-compose.yml       │  │
         │  │ - README.md                │  │
         │  │ - diagram.svg              │  │
         │  │ - aws_deploy.yaml          │  │
         │  └────────────────────────────┘  │
         └───────────────────────────────────┘
```

## Next Steps

1. Complete current frontend changes (models/tools) ✅
2. Implement enhanced code generator with new tool structure
3. Add container testing system
4. Implement diagram generation
5. Create complete package download
6. Test everything end-to-end
7. Deploy to production

## Notes

- Windows users will see warnings for python_repl and shell tools
- Container testing requires Docker to be installed and running
- Some tools require system dependencies (graphviz, chromium)
- Pre/post processing functions are optional but recommended
- All generated agents include LangSmith and OpenTelemetry by default
