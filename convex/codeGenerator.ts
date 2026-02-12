/**
 * Phase 7: Enhanced Code Generation
 * Implementation per comprehensive_plan.md lines 952-1178
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import { getModelConfig } from "./modelRegistry";

/**
 * Meta-tooling instructions added to agent system prompts
 */
const META_TOOLING_INSTRUCTIONS = `
## Meta-Tooling Capability

You have the ability to create new tools dynamically when you need functionality that is not currently available.

### When to Use Meta-Tooling

Use meta-tooling when you need a specific capability that is not provided by your existing tools.

### How to Request a New Tool

When you determine you need a new tool, describe what you need and the system will help you create it.

### Tool Code Requirements

Your tool code must:
1. Use the @tool decorator from strandsagents
2. Be syntactically valid Python
3. Include proper error handling
4. Have clear docstrings
5. Return a string or JSON-serializable result
`;

export const generateAgent = action({
  args: {
    name: v.string(),
    model: v.string(),
    systemPrompt: v.string(),
    tools: v.array(v.object({
      name: v.string(),
      type: v.string(),
      config: v.optional(v.any()),
      requiresPip: v.optional(v.boolean()),
      pipPackages: v.optional(v.array(v.string())),
      extrasPip: v.optional(v.string()),
      notSupportedOn: v.optional(v.array(v.string())),
    })),
    deploymentType: v.string(),
    mcpServers: v.optional(v.array(v.object({
      name: v.string(),
      command: v.string(),
      args: v.array(v.string()),
      env: v.optional(v.any()),
      disabled: v.optional(v.boolean()),
    }))),
    dynamicTools: v.optional(v.array(v.object({
      name: v.string(),
      code: v.string(),
      parameters: v.any(),
    }))),
  },
  handler: async (ctx, args) => {
    const { name, model, systemPrompt, tools, deploymentType, mcpServers, dynamicTools } = args;
    const timestamp = new Date().toISOString();
    const className = name.replace(/[^a-zA-Z0-9]/g, '') + 'Agent';
    
    // Generate complete agent code following comprehensive_plan.md template
    const generatedCode = generateCompleteAgentCode({
      name,
      className,
      model,
      systemPrompt,
      tools,
      deploymentType,
      timestamp,
      dynamicTools
    });
    
    // Generate requirements.txt per Phase 7.2 spec (lines 1160-1178)
    const requirementsTxt = generateRequirementsTxt(tools);
    
    // Generate MCP configuration if MCP servers are provided
    const mcpConfig = mcpServers && mcpServers.length > 0 
      ? generateMCPConfig(mcpServers)
      : null;
    
    return {
      generatedCode,
      requirementsTxt,
      mcpConfig,
    };
  },
});

function generateImports(tools: any[], deploymentType: string, modelId?: string): string {
  const imports = [
    "# Core imports",
    "import os",
    "import sys",
    "import asyncio",
    "from typing import Any, Dict, List, Optional, Callable",
    "import logging",
    "",
    "# Bedrock AgentCore Runtime",
    "from bedrock_agentcore.runtime import BedrockAgentCoreApp",
    "",
    "# Strands Agents imports",
    "from strandsagents import agent, Agent, tool",
  ];
  
  // Add model-specific imports if model ID provided
  if (modelId) {
    try {
      const modelConfig = getModelConfig(modelId);
      imports.push("");
      imports.push("# Model imports");
      imports.push(...modelConfig.imports);
    } catch (error) {
      // Fallback to generic imports if model not found
      imports.push("");
      imports.push("# Model imports");
      imports.push("from strandsagents.models import BedrockModel");
    }
  }
  
  imports.push("");
  imports.push("# Tool imports");
  imports.push("from strands_tools import (");
  
  // Add tool imports from strands-agents-tools
  const toolImports = new Set<string>();
  tools.forEach(tool => {
    switch (tool.type) {
      // RAG & Memory
      case "retrieve":
        toolImports.add("    retrieve");
        break;
      case "memory":
        toolImports.add("    memory");
        break;
      case "agent_core_memory":
        toolImports.add("    agent_core_memory");
        break;
      case "mem0_memory":
        toolImports.add("    mem0_memory");
        break;
      
      // File Operations
      case "editor":
        toolImports.add("    editor");
        break;
      case "file_read":
        toolImports.add("    file_read");
        break;
      case "file_write":
        toolImports.add("    file_write");
        break;
      
      // Shell & System
      case "environment":
        toolImports.add("    environment");
        break;
      case "shell":
        toolImports.add("    shell");
        break;
      case "cron":
        toolImports.add("    cron");
        break;
      case "use_computer":
        toolImports.add("    use_computer");
        break;
      
      // Code Interpretation
      case "python_repl":
        toolImports.add("    python_repl");
        break;
      case "code_interpreter":
        toolImports.add("    code_interpreter");
        break;
      
      // Web & Network
      case "http_request":
        toolImports.add("    http_request");
        break;
      case "slack":
        toolImports.add("    slack");
        break;
      case "browser":
        toolImports.add("    browser");
        break;
      case "agent_core_browser":
        toolImports.add("    agent_core_browser");
        break;
      case "rss":
        toolImports.add("    rss");
        break;
      
      // Multi-modal
      case "vision":
        toolImports.add("    vision");
        break;
      case "image_gen":
        toolImports.add("    image_gen");
        break;
      case "audio_transcription":
        toolImports.add("    audio_transcription");
        break;
      case "text_to_speech":
        toolImports.add("    text_to_speech");
        break;
      
      // AWS Services
      case "bedrock_kb":
        toolImports.add("    bedrock_kb");
        break;
      case "s3":
        toolImports.add("    s3");
        break;
      case "dynamodb":
        toolImports.add("    dynamodb");
        break;
      case "lambda_invoke":
        toolImports.add("    lambda_invoke");
        break;
      
      // Utilities
      case "search":
        toolImports.add("    search");
        break;
      case "tavily_search":
        toolImports.add("    tavily_search");
        break;
      case "calculator":
        toolImports.add("    calculator");
        break;
      case "datetime":
        toolImports.add("    datetime");
        break;
      
      // Agents & Workflows
      case "use_agent":
        toolImports.add("    use_agent");
        break;
      case "think":
        toolImports.add("    think");
        break;
      case "use_llm":
        toolImports.add("    use_llm");
        break;
      case "workflow":
        toolImports.add("    workflow");
        break;
      case "batch":
        toolImports.add("    batch");
        break;
      case "a2a_client":
        toolImports.add("    a2a_client");
        break;
    }
  });
  
  if (toolImports.size > 0) {
    imports.push(...Array.from(toolImports));
    imports.push(")");
  } else {
    imports.push(")");
  }
  
  imports.push("");
  
  // Add AWS and monitoring imports
  imports.push("# AWS and Monitoring imports");
  if (deploymentType === "aws" || deploymentType === "agentcore") {
    imports.push("import boto3");
    imports.push("from botocore.config import Config");
  }
  imports.push("from opentelemetry import trace");
  imports.push("from opentelemetry.sdk.trace import TracerProvider");
  imports.push("from opentelemetry.sdk.trace.export import BatchSpanProcessor");
  imports.push("");
  
  // Add logging setup
  imports.push("# Configure logging");
  imports.push("logging.basicConfig(");
  imports.push("    level=os.getenv('LOG_LEVEL', 'INFO'),");
  imports.push("    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'");
  imports.push(")");
  imports.push("logger = logging.getLogger(__name__)");
  imports.push("");
  
  // Add optional monitoring initialization
  imports.push("# Initialize OpenTelemetry tracing");
  imports.push("trace.set_tracer_provider(TracerProvider())");
  imports.push("tracer = trace.get_tracer(__name__)");
  imports.push("");
  
  imports.push("# Optional: Initialize LangSmith if API key is provided");
  imports.push("langsmith_client = None");
  imports.push("if os.getenv('LANGSMITH_API_KEY'):");
  imports.push("    try:");
  imports.push("        from langsmith import Client as LangSmithClient");
  imports.push("        langsmith_client = LangSmithClient()");
  imports.push("        logger.info('LangSmith monitoring enabled')");
  imports.push("    except ImportError:");
  imports.push("        logger.warning('langsmith package not installed. Monitoring disabled.')");
  imports.push("else:");
  imports.push("    logger.info('LangSmith monitoring disabled (no API key provided)')");
  imports.push("");
  
  return imports.join("\n");
}

function generateToolConfigs(tools: any[], linkedAgents?: Array<{agentId: string, agentName: string, description: string}>): string {
  const toolCode: string[] = [];
  
  // Generate agent-as-tool wrappers for linked agents
  if (linkedAgents && linkedAgents.length > 0) {
    toolCode.push("# Agent-as-Tool Wrappers");
    toolCode.push("# These agents can be invoked as tools for hierarchical coordination\n");
    linkedAgents.forEach(agent => {
      toolCode.push(generateAgentToolWrapper(agent.agentId, agent.agentName, agent.description));
    });
    toolCode.push("");
  }
  
  // Generate custom tool functions with @tool decorator
  const customTools = tools
    .filter(tool => !isBuiltInTool(tool.type))
    .map(tool => generateCustomToolFunction(tool));
  
  if (customTools.length > 0) {
    toolCode.push("# Custom Tools");
    toolCode.push(...customTools);
  }
  
  if (toolCode.length === 0) {
    return "# All tools are built-in from strands-agents-tools";
  }
  
  return toolCode.join("\n\n");
}

/**
 * Check if a tool is built-in to strands-agents-tools
 */
function isBuiltInTool(toolType: string): boolean {
  const builtInTools = [
    // RAG & Memory
    "retrieve", "memory", "agent_core_memory", "mem0_memory",
    // File Operations
    "editor", "file_read", "file_write",
    // Shell & System
    "environment", "shell", "cron", "use_computer",
    // Code Interpretation
    "python_repl", "code_interpreter",
    // Web & Network
    "http_request", "slack", "browser", "agent_core_browser", "rss",
    // Multi-modal
    "vision", "image_gen", "audio_transcription", "text_to_speech",
    // AWS Services
    "bedrock_kb", "s3", "dynamodb", "lambda_invoke",
    // Utilities
    "search", "tavily_search", "calculator", "datetime",
    // Agents & Workflows
    "use_agent", "think", "use_llm", "workflow", "batch", "a2a_client"
  ];
  
  return builtInTools.includes(toolType);
}

/**
 * Generate agent-as-tool wrapper
 */
function generateAgentToolWrapper(agentId: string, agentName: string, description: string): string {
  const toolName = agentName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  
  return `@tool(
    name="${toolName}",
    description="${description || `Invoke ${agentName} agent`}",
    parameters={
        "task": {
            "type": "string",
            "description": "Task or question for ${agentName}",
            "required": True
        }
    }
)
async def ${toolName}(task: str) -> str:
    """
    Invoke ${agentName} agent as a tool.
    Enables hierarchical agent coordination.
    """
    import os
    import requests
    
    api_url = os.getenv("PLATFORM_API_URL", "https://api.mikepfunk.com")
    
    response = requests.post(
        f"{api_url}/execute-agent",
        json={"agentId": "${agentId}", "message": task},
        headers={"Authorization": f"Bearer {os.getenv('PLATFORM_API_KEY')}"},
        timeout=300
    )
    
    result = response.json()
    return result.get("content", "") if result.get("success") else f"Error: {result.get('error')}"`;
}

/**
 * Generate a custom tool function with @tool decorator
 */
function generateCustomToolFunction(tool: any): string {
  const functionName = tool.type.replace(/[^a-zA-Z0-9_]/g, '_');
  const description = tool.config?.description || `Custom tool: ${tool.name}`;
  
  // Extract parameters from tool config
  const params = tool.config?.parameters || [];
  const paramSignature = params.length > 0
    ? params.map((p: any) => `${p.name}: ${p.type || 'str'}`).join(', ')
    : '**kwargs';
  
  // Generate parameter schema for @tool decorator
  const paramSchema = params.length > 0
    ? `{
${params.map((p: any) => `        "${p.name}": {
            "type": "${p.type || 'string'}",
            "description": "${p.description || p.name}"${p.required ? ',\n            "required": True' : ''}
        }`).join(',\n')}
    }`
    : '{}';
  
  // Generate helpful implementation guidance based on parameters
  const paramsList = params.length > 0
    ? params.map((p: any) => `${p.name}: ${p.description || 'parameter value'}`).join('\n    #   ')
    : 'No parameters defined';

  const exampleLogic = tool.config?.exampleImplementation ||
    (params.length > 0
      ? `# Example: Process the parameters
        # Access parameters: ${params.map((p: any) => p.name).join(', ')}
        # Perform your custom logic here
        # Return a string result`
      : `# Implement your custom tool logic here
        # Return a string result`);

  return `@tool(
    name="${tool.name}",
    description="${description}",
    parameters=${paramSchema}
)
async def ${functionName}(${paramSignature}) -> str:
    """
    ${description}

    This is a custom tool function that can be invoked by the agent.

    Parameters:
    ${paramsList}

    Returns:
        str: Result of the tool execution
    """
    try:
        logger.info(f"Executing custom tool: ${tool.name}")

        ${exampleLogic}

        # Placeholder implementation - replace with your actual logic
        result = f"Tool ${tool.name} executed successfully"
        ${params.length > 0 ? `
        # Available parameters: ${params.map((p: any) => p.name).join(', ')}
        logger.debug(f"Parameters: {locals()}")` : ''}

        return result
    except Exception as e:
        logger.error(f"Error in custom tool ${tool.name}: {str(e)}")
        raise`;
}

function generateAgentClass(name: string, model: string, systemPrompt: string, tools: any[], enableMetaTooling: boolean = true): string {
  const className = name.replace(/[^a-zA-Z0-9]/g, "") + "Agent";
  const toolList = tools.map(t => t.type).join(", ");
  
  // Add meta-tooling instructions to system prompt if enabled
  const enhancedSystemPrompt = enableMetaTooling 
    ? `${systemPrompt}\n\n${META_TOOLING_INSTRUCTIONS}`
    : systemPrompt;
  
  return `
# Pre-processing hook
async def preprocess_message(message: str, context: Optional[Dict[str, Any]] = None) -> tuple[str, Dict[str, Any]]:
    """
    Pre-process incoming messages before agent processing.
    Add custom validation, transformation, or enrichment logic here.
    
    Args:
        message: The incoming user message
        context: Optional context dictionary
    
    Returns:
        Tuple of (processed_message, updated_context)
    """
    logger.info(f"Pre-processing message: {message[:50]}...")
    
    # Initialize context if not provided
    if context is None:
        context = {}
    
    # Add timestamp
    context['received_at'] = asyncio.get_event_loop().time()
    
    # Example: Add custom enrichment
    # message = f"[User Query]: {message}"
    
    return message, context


# Post-processing hook
async def postprocess_response(response: str, context: Optional[Dict[str, Any]] = None) -> str:
    """
    Post-process agent responses before returning to user.
    Add custom formatting, filtering, or enhancement logic here.
    
    Args:
        response: The agent's generated response
        context: Optional context dictionary
    
    Returns:
        Processed response string
    """
    logger.info(f"Post-processing response: {response[:50]}...")
    
    # Example: Add response metadata
    if context and 'received_at' in context:
        processing_time = asyncio.get_event_loop().time() - context['received_at']
        logger.info(f"Processing time: {processing_time:.2f}s")
    
    # Example: Custom formatting
    # response = f"Agent Response:\n{response}"
    
    return response


@agent(
    model="${model}",
    system_prompt="""${enhancedSystemPrompt}""",
    tools=[${toolList}],
    memory=True,
    reasoning="interleaved",
    # Container setup for deployment
    container_setup={
        "base_image": "python:3.11-slim",
        "system_packages": ["gcc", "g++"],
        "environment_vars": {
            "LOG_LEVEL": "INFO",
            "AGENT_NAME": "${name}",
        },
    },
    # Pre/post processing hooks
    preprocess=preprocess_message,
    postprocess=postprocess_response,
)
class ${className}(Agent):
    """
    ${name} - AI Agent powered by Strands Agents
    
    This agent uses interleaved reasoning with Claude Sonnet 4.5 and has access
    to the following tools: ${tools.map(t => t.name).join(", ")}
    """
    
    def __init__(self):
        super().__init__()
        logger.info(f"Initializing {self.__class__.__name__}")
    
    async def run(self, message: str, context: Optional[Dict[str, Any]] = None) -> str:
        """
        Main entry point for processing messages.
        
        Args:
            message: The user's input message
            context: Optional context dictionary for maintaining state
        
        Returns:
            The agent's response as a string
        """
        try:
            logger.info(f"Processing message: {message[:100]}...")
            
            # Pre-process
            processed_message, updated_context = await preprocess_message(message, context)
            
            # Generate response using the agent's reasoning capabilities
            response = await self.generate_response(
                message=processed_message,
                context=updated_context,
            )
            
            # Post-process
            final_response = await postprocess_response(response, updated_context)
            
            logger.info("Message processed successfully")
            return final_response
            
        except Exception as e:
            logger.error(f"Error processing message: {str(e)}", exc_info=True)
            raise
    
    async def stream_response(self, message: str, context: Optional[Dict[str, Any]] = None):
        """
        Stream responses token by token for real-time interaction.
        
        Args:
            message: The user's input message
            context: Optional context dictionary
        
        Yields:
            Response tokens as they are generated
        """
        try:
            processed_message, updated_context = await preprocess_message(message, context)
            
            async for token in self.generate_stream(
                message=processed_message,
                context=updated_context,
            ):
                yield token
                
        except Exception as e:
            logger.error(f"Error streaming response: {str(e)}", exc_info=True)
            raise`;
}

function getToolClassName(toolType: string): string {
  switch (toolType) {
    case "web_search": return "WebSearchTool";
    case "file_operations": return "FileOperationsTool";
    case "database": return "DatabaseTool";
    default: return "GenericTool";
  }
}

function generateDeploymentConfig(deploymentType: string, tools: any[], agentName: string): string {
  const className = agentName.replace(/[^a-zA-Z0-9]/g, "") + "Agent";

  switch (deploymentType) {
    case "aws":
      return `
# AWS Deployment Configuration with Bedrock AgentCore
app = BedrockAgentCoreApp()

# Global agent variable
agent_instance = None

@app.entrypoint
async def agent_entrypoint(payload):
    """
    Bedrock AgentCore entrypoint for agent execution.
    This function is called by AgentCore when the agent is invoked.

    Args:
        payload: Dictionary containing the user input and context
            - prompt: The user's input message
            - conversation_history: Optional conversation history
            - context: Optional additional context

    Returns:
        The agent's response as a string
    """
    global agent_instance

    logger.info("AgentCore entrypoint called")

    # Initialize agent on first invocation
    if agent_instance is None:
        logger.info("Initializing ${className}...")
        agent_instance = ${className}()
        logger.info("Agent initialized successfully")

    # Extract user input from payload
    user_input = payload.get("prompt", "")
    if not user_input:
        raise ValueError("No 'prompt' field in payload")

    logger.info(f"Processing user input: {user_input[:100]}...")

    # Get conversation history if provided
    conversation_history = payload.get("conversation_history", [])
    context = payload.get("context", {})

    try:
        # Run the agent with the user input
        response = await agent_instance.run(user_input, context=context)
        logger.info("Agent response generated successfully")
        return response
    except Exception as e:
        logger.error(f"Error in agent processing: {str(e)}", exc_info=True)
        raise

if __name__ == "__main__":
    # Run the AgentCore app
    app.run()`;
    
    case "ollama":
      return `
# Ollama Deployment Configuration with Bedrock AgentCore
app = BedrockAgentCoreApp()

# Global agent variable
agent_instance = None

@app.entrypoint
async def agent_entrypoint(payload):
    """
    Bedrock AgentCore entrypoint for Ollama-based agent execution.
    This function is called by AgentCore when the agent is invoked.

    Args:
        payload: Dictionary containing the user input and context
            - prompt: The user's input message
            - conversation_history: Optional conversation history
            - context: Optional additional context

    Returns:
        The agent's response as a string
    """
    global agent_instance

    logger.info("AgentCore entrypoint called (Ollama)")

    # Initialize agent on first invocation
    if agent_instance is None:
        ollama_host = os.getenv("OLLAMA_HOST", "localhost:11434")
        logger.info(f"Initializing ${className} with Ollama at {ollama_host}...")
        agent_instance = ${className}()
        logger.info("Agent initialized successfully with Ollama")

    # Extract user input from payload
    user_input = payload.get("prompt", "")
    if not user_input:
        raise ValueError("No 'prompt' field in payload")

    logger.info(f"Processing user input: {user_input[:100]}...")

    # Get conversation history if provided
    conversation_history = payload.get("conversation_history", [])
    context = payload.get("context", {})

    try:
        # Run the agent with the user input
        response = await agent_instance.run(user_input, context=context)
        logger.info("Agent response generated successfully")
        return response
    except Exception as e:
        logger.error(f"Error in agent processing: {str(e)}", exc_info=True)
        raise

if __name__ == "__main__":
    # Run the AgentCore app
    app.run()`;
    
    case "docker":
      return `
# Docker Deployment Configuration with Bedrock AgentCore
app = BedrockAgentCoreApp()

# Global agent variable
agent_instance = None

@app.entrypoint
async def agent_entrypoint(payload):
    """
    Bedrock AgentCore entrypoint for Docker-based agent execution.
    This function is called by AgentCore when the agent is invoked.

    Args:
        payload: Dictionary containing the user input and context
            - prompt: The user's input message
            - conversation_history: Optional conversation history
            - context: Optional additional context

    Returns:
        The agent's response as a string
    """
    global agent_instance

    logger.info("AgentCore entrypoint called (Docker)")

    # Initialize agent on first invocation
    if agent_instance is None:
        logger.info("Initializing ${className}...")
        agent_instance = ${className}()
        logger.info("Agent initialized successfully in Docker")

    # Extract user input from payload
    user_input = payload.get("prompt", "")
    if not user_input:
        raise ValueError("No 'prompt' field in payload")

    logger.info(f"Processing user input: {user_input[:100]}...")

    # Get conversation history if provided
    conversation_history = payload.get("conversation_history", [])
    context = payload.get("context", {})

    try:
        # Run the agent with the user input
        response = await agent_instance.run(user_input, context=context)
        logger.info("Agent response generated successfully")
        return response
    except Exception as e:
        logger.error(f"Error in agent processing: {str(e)}", exc_info=True)
        raise

if __name__ == "__main__":
    # Run the AgentCore app
    app.run()`;

    default:
      return `
# Local Development Configuration
if __name__ == "__main__":
    async def main():
        """Run agent locally for development and testing"""
        agent = ${className}()
        logger.info("Agent initialized for local development")
        
        # Interactive mode
        print("Agent ready. Type 'quit' or 'exit' to stop.")
        print("Type 'stream' to test streaming mode.\n")
        
        while True:
            try:
                user_input = input("You: ")
                if user_input.lower() in ['quit', 'exit']:
                    break
                
                if user_input.lower() == 'stream':
                    user_input = input("You (streaming): ")
                    print("\nAgent (streaming): ", end="", flush=True)
                    async for token in agent.stream_response(user_input):
                        print(token, end="", flush=True)
                    print("\n")
                else:
                    response = await agent.run(user_input)
                    print(f"\nAgent: {response}\n")
                    
            except KeyboardInterrupt:
                print("\nShutting down...")
                break
            except Exception as e:
                logger.error(f"Error: {e}", exc_info=True)
    
    asyncio.run(main())`;
  }
}

function generateDockerConfig(tools: any[]): string {
  const pipPackages = tools
    .filter(tool => tool.requiresPip)
    .flatMap(tool => tool.pipPackages || [])
    .filter((pkg, index, arr) => arr.indexOf(pkg) === index);
  
  const extrasPipPackages = tools
    .filter(tool => tool.extrasPip)
    .map(tool => `strands-agents-tools[${tool.extrasPip}]`)
    .filter((pkg, index, arr) => arr.indexOf(pkg) === index);
  
  return `FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    gcc \\
    g++ \\
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install additional packages for tools
${pipPackages.length > 0 ? `RUN pip install ${pipPackages.join(" ")}` : "# No additional packages needed"}

# Install strands-agents-tools extras
${extrasPipPackages.length > 0 ? `RUN pip install ${extrasPipPackages.join(" ")}` : "# No extras needed"}

# Copy agent code
COPY . .

# Expose port
EXPOSE 8000

# Run the agent
CMD ["python", "agent.py"]`;
}

function generateRequirements(tools: any[], deploymentType: string): string {
  const baseRequirements = [
    "strandsagents>=1.0.0",
    "agentcore>=1.0.0",
  ];
  
  // Add deployment-specific requirements
  if (deploymentType === "aws") {
    baseRequirements.push("boto3>=1.28.0");
    baseRequirements.push("bedrock-client>=1.0.0");
  } else if (deploymentType === "ollama") {
    baseRequirements.push("ollama>=0.1.0");
  }
  
  // Add tool-specific requirements
  const toolRequirements = new Set<string>();
  tools.forEach(tool => {
    // Add pip packages
    if (tool.pipPackages && Array.isArray(tool.pipPackages)) {
      tool.pipPackages.forEach((pkg: string) => toolRequirements.add(pkg));
    }
    
    // Add extras pip packages
    if (tool.extrasPip) {
      toolRequirements.add(`strands-agents-tools[${tool.extrasPip}]`);
    }
    
    // Add standard tool requirements based on tool type
    switch (tool.type) {
      case "web_search":
      case "http_request":
        toolRequirements.add("requests>=2.31.0");
        toolRequirements.add("beautifulsoup4>=4.12.0");
        break;
      case "database":
        toolRequirements.add("pandas>=2.0.0");
        break;
      case "data_analysis":
        toolRequirements.add("numpy>=1.24.0");
        toolRequirements.add("pandas>=2.0.0");
        toolRequirements.add("matplotlib>=3.7.0");
        break;
      case "slack":
        toolRequirements.add("slack-sdk>=3.0.0");
        break;
    }
  });
  
  return [...baseRequirements, ...Array.from(toolRequirements)].join("\n");
}

/**
 * Generate MCP configuration file (mcp.json)
 * This file is used by the agent to connect to MCP servers
 */
function generateMCPConfig(mcpServers: any[]): string {
  const config = {
    mcpServers: {} as Record<string, any>
  };
  
  for (const server of mcpServers) {
    config.mcpServers[server.name] = {
      command: server.command,
      args: server.args,
      env: server.env || {},
      disabled: server.disabled || false,
    };
  }
  
  return JSON.stringify(config, null, 2);
}

/**
 * Generate code for dynamic tools created via meta-tooling
 */
function generateDynamicToolsCode(dynamicTools: any[]): string {
  if (!dynamicTools || dynamicTools.length === 0) {
    return "";
  }
  
  const toolsCode = dynamicTools.map(tool => {
    // The tool code should already include the @tool decorator
    return `# Dynamic Tool: ${tool.name}\n${tool.code}`;
  }).join('\n\n');
  
  return `# These tools were dynamically created via meta-tooling
# They are automatically loaded and available to the agent

${toolsCode}`;
}

/**
 * Generate complete agent code following comprehensive_plan.md template (lines 959-1154)
 */
function generateCompleteAgentCode(config: {
  name: string;
  className: string;
  model: string;
  systemPrompt: string;
  tools: any[];
  deploymentType: string;
  timestamp: string;
  dynamicTools?: any[];
}): string {
  const { name, className, model, systemPrompt, tools, deploymentType, timestamp, dynamicTools } = config;
  
  const header = `"""
Generated Agent: ${name}
Description: AI Agent powered by Strands Agents
Model: ${model}
Generated: ${timestamp}

This agent was automatically generated by the Agent Builder Application.
"""
`;

  const imports = generateImports(tools, deploymentType, model);
  const toolConfigs = generateToolConfigs(tools);
  
  // Generate dynamic tools code if provided
  const dynamicToolsCode = dynamicTools && dynamicTools.length > 0
    ? generateDynamicToolsCode(dynamicTools)
    : "";
  
  // Get model initialization code from model registry
  let modelInitCode = "";
  try {
    const modelConfig = getModelConfig(model);
    modelInitCode = modelConfig.initCode;
  } catch (error) {
    // Fallback for unknown models
    modelInitCode = `# Model initialization\nmodel = "${model}"`;
  }
  
  const agentClass = generateAgentClass(name, model, systemPrompt, tools, true);
  const deploymentConfig = generateDeploymentConfig(deploymentType, tools, name);

  return `${header}
${imports}

# ============================================================================
# MODEL CONFIGURATION
# ============================================================================
${modelInitCode}

# ============================================================================
# TOOL CONFIGURATIONS
# ============================================================================
${toolConfigs}

${dynamicToolsCode ? `# ============================================================================
# DYNAMIC TOOLS (Meta-tooling)
# ============================================================================
${dynamicToolsCode}
` : ''}
# ============================================================================
# AGENT DEFINITION
# ============================================================================
${agentClass}

# ============================================================================
# DEPLOYMENT CONFIGURATION
# ============================================================================
${deploymentConfig}
`;
}

/**
 * Generate requirements.txt per Phase 7.2 spec (lines 1160-1178)
 */
function generateRequirementsTxt(tools: any[]): string {
  const packages = new Set([
    'strands-agents>=1.0.0',
    'opentelemetry-api>=1.0.0',
    'opentelemetry-sdk>=1.0.0'
  ]);

  // Base tools package
  packages.add('strands-agents-tools>=1.0.0');

  // Add tool-specific extras
  for (const tool of tools) {
    if (tool.extrasPip) {
      packages.add(`strands-agents-tools[${tool.extrasPip}]`);
    }
    
    // Add specific pip packages
    if (tool.pipPackages && Array.isArray(tool.pipPackages)) {
      tool.pipPackages.forEach((pkg: string) => packages.add(pkg));
    }
  }

  return Array.from(packages).join('\n');
}

/**
 * Generate Dockerfile for containerization
 */
function generateDockerfile(tools: any[]): string {
  const dockerfile = `FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    build-essential \\
    curl \\
    git \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent code
COPY agent.py .
COPY tools/ ./tools/

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV BYPASS_TOOL_CONSENT=true

# Expose port for API
EXPOSE 8000

# Run the agent
CMD ["python", "agent.py"]
`;

  return dockerfile;
}

/**
 * Generate docker-compose.yml for local deployment
 */
function generateDockerCompose(agentName: string): string {
  return `version: '3.8'

services:
  ${agentName.toLowerCase().replace(/[^a-z0-9]/g, '-')}:
    build: .
    container_name: ${agentName.toLowerCase().replace(/[^a-z0-9]/g, '-')}
    ports:
      - "8000:8000"
    environment:
      # AWS Configuration
      - AWS_REGION=\${AWS_REGION:-us-east-1}
      - AWS_ACCESS_KEY_ID=\${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=\${AWS_SECRET_ACCESS_KEY}
      - AWS_SESSION_TOKEN=\${AWS_SESSION_TOKEN}
      
      # Optional: LangSmith monitoring (if API key is set)
      - LANGSMITH_API_KEY=\${LANGSMITH_API_KEY:-}
      
      # Logging
      - LOG_LEVEL=\${LOG_LEVEL:-INFO}
    volumes:
      - ./data:/app/data
    restart: unless-stopped
    networks:
      - agent-network

networks:
  agent-network:
    driver: bridge

volumes:
  data:
`;
}

/**
 * Generate AWS SAM template for Lambda/ECS deployment
 */
function generateSAMTemplate(agentName: string, model: string): string {
  const functionName = agentName.replace(/[^a-zA-Z0-9]/g, '');
  
  return `AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: >
  ${agentName} - AI Agent powered by Strands Agents
  
Globals:
  Function:
    Timeout: 300
    MemorySize: 1024
    Runtime: python3.11

Resources:
  ${functionName}Function:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: ${functionName}
      CodeUri: .
      Handler: agent.lambda_handler
      Environment:
        Variables:
          MODEL_ID: ${model}
          AWS_REGION: !Ref AWS::Region
          LOG_LEVEL: INFO
      Policies:
        - AWSLambdaBasicExecutionRole
        - Statement:
          - Effect: Allow
            Action:
              - bedrock:InvokeModel
              - bedrock:InvokeModelWithResponseStream
            Resource: '*'
      Events:
        InvokeAPI:
          Type: Api
          Properties:
            Path: /invoke
            Method: post

  ${functionName}LogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: !Sub /aws/lambda/\${${functionName}Function}
      RetentionInDays: 7

Outputs:
  AgentApi:
    Description: "API Gateway endpoint URL"
    Value: !Sub "https://\${ServerlessRestApi}.execute-api.\${AWS::Region}.amazonaws.com/Prod/invoke/"
  
  AgentFunction:
    Description: "Agent Lambda Function ARN"
    Value: !GetAtt ${functionName}Function.Arn
  
  AgentFunctionIamRole:
    Description: "Implicit IAM Role created for Agent function"
    Value: !GetAtt ${functionName}FunctionRole.Arn
`;
}

/**
 * Generate Azure Container Instances deployment config
 */
function generateAzureDeployment(agentName: string, containerImage: string): string {
  return `{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "containerGroupName": {
      "type": "string",
      "defaultValue": "${agentName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-container",
      "metadata": {
        "description": "Name for the container group"
      }
    },
    "location": {
      "type": "string",
      "defaultValue": "[resourceGroup().location]",
      "metadata": {
        "description": "Location for all resources"
      }
    }
  },
  "resources": [
    {
      "type": "Microsoft.ContainerInstance/containerGroups",
      "apiVersion": "2021-09-01",
      "name": "[parameters('containerGroupName')]",
      "location": "[parameters('location')]",
      "properties": {
        "containers": [
          {
            "name": "${agentName.toLowerCase().replace(/[^a-z0-9]/g, '-')}",
            "properties": {
              "image": "${containerImage}",
              "ports": [
                {
                  "port": 8000,
                  "protocol": "TCP"
                }
              ],
              "resources": {
                "requests": {
                  "cpu": 1,
                  "memoryInGb": 1.5
                }
              },
              "environmentVariables": [
                {
                  "name": "LOG_LEVEL",
                  "value": "INFO"
                }
              ]
            }
          }
        ],
        "osType": "Linux",
        "restartPolicy": "Always",
        "ipAddress": {
          "type": "Public",
          "ports": [
            {
              "port": 8000,
              "protocol": "TCP"
            }
          ]
        }
      }
    }
  ],
  "outputs": {
    "containerIPv4Address": {
      "type": "string",
      "value": "[reference(resourceId('Microsoft.ContainerInstance/containerGroups', parameters('containerGroupName'))).ipAddress.ip]"
    }
  }
}
`;
}

/**
 * Generate Google Cloud Run deployment config
 */
function generateGCPCloudRun(agentName: string, containerImage: string): string {
  return `apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: ${agentName.toLowerCase().replace(/[^a-z0-9]/g, '-')}
  labels:
    cloud.googleapis.com/location: us-central1
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "0"
        autoscaling.knative.dev/maxScale: "10"
    spec:
      containerConcurrency: 80
      timeoutSeconds: 300
      containers:
      - image: ${containerImage}
        ports:
        - name: http1
          containerPort: 8000
        env:
        - name: LOG_LEVEL
          value: "INFO"
        - name: PYTHONUNBUFFERED
          value: "1"
        resources:
          limits:
            cpu: "1000m"
            memory: "512Mi"
  traffic:
  - percent: 100
    latestRevision: true
`;
}

/**
 * Generate AgentCore manifest for Bedrock deployment
 */
function generateAgentCoreManifest(agentName: string, model: string, tools: any[]): string {
  return `{
  "name": "${agentName}",
  "version": "1.0.0",
  "description": "${agentName} - AI Agent powered by Strands Agents",
  "runtime": {
    "type": "container",
    "image": "${agentName.toLowerCase().replace(/[^a-z0-9]/g, '-')}:latest",
    "port": 8000
  },
  "model": {
    "provider": "bedrock",
    "model_id": "${model}",
    "parameters": {
      "temperature": 0.3,
      "max_tokens": 4096
    }
  },
  "tools": [
    ${tools.map(t => `"${t.type}"`).join(',\n    ')}
  ],
  "memory": {
    "enabled": true,
    "type": "bedrock-knowledge-base"
  },
  "resources": {
    "cpu": "0.5",
    "memory": "512Mi",
    "storage": "1Gi"
  },
  "scaling": {
    "min_instances": 0,
    "max_instances": 10,
    "target_concurrency": 5
  },
  "monitoring": {
    "enabled": true,
    "metrics": ["requests", "latency", "errors"],
    "log_level": "INFO"
  }
}
`;
}

/**
 * Generate deployment script for AWS
 */
function generateAWSDeployScript(agentName: string): string {
  return `#!/bin/bash
set -e

echo "Deploying ${agentName} to AWS..."

# Variables
REGION=\${AWS_REGION:-us-east-1}
STACK_NAME="${agentName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-stack"

# Build and package
echo "Building agent..."
sam build

echo "Packaging agent..."
sam package \\
  --output-template-file packaged.yaml \\
  --s3-bucket \${S3_BUCKET}

echo "Deploying agent..."
sam deploy \\
  --template-file packaged.yaml \\
  --stack-name \${STACK_NAME} \\
  --capabilities CAPABILITY_IAM \\
  --region \${REGION}

echo "Getting outputs..."
aws cloudformation describe-stacks \\
  --stack-name \${STACK_NAME} \\
  --region \${REGION} \\
  --query "Stacks[0].Outputs"

echo "Deployment complete!"
`;
}

/**
 * Generate deployment script for Azure
 */
function generateAzureDeployScript(agentName: string): string {
  return `#!/bin/bash
set -e

echo "Deploying ${agentName} to Azure..."

# Variables
RESOURCE_GROUP=\${AZURE_RESOURCE_GROUP:-agent-rg}
LOCATION=\${AZURE_LOCATION:-eastus}
CONTAINER_NAME="${agentName.toLowerCase().replace(/[^a-z0-9]/g, '-')}"

# Create resource group
echo "Creating resource group..."
az group create --name \${RESOURCE_GROUP} --location \${LOCATION}

# Deploy container
echo "Deploying container..."
az deployment group create \\
  --resource-group \${RESOURCE_GROUP} \\
  --template-file azure_deploy.json

echo "Getting container IP..."
az container show \\
  --resource-group \${RESOURCE_GROUP} \\
  --name \${CONTAINER_NAME} \\
  --query "ipAddress.ip" \\
  --output tsv

echo "Deployment complete!"
`;
}

/**
 * Generate deployment script for GCP
 */
function generateGCPDeployScript(agentName: string): string {
  return `#!/bin/bash
set -e

echo "Deploying ${agentName} to Google Cloud..."

# Variables
PROJECT_ID=\${GCP_PROJECT_ID}
REGION=\${GCP_REGION:-us-central1}
SERVICE_NAME="${agentName.toLowerCase().replace(/[^a-z0-9]/g, '-')}"

# Build container
echo "Building container image..."
gcloud builds submit --tag gcr.io/\${PROJECT_ID}/\${SERVICE_NAME}

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy \${SERVICE_NAME} \\
  --image gcr.io/\${PROJECT_ID}/\${SERVICE_NAME} \\
  --platform managed \\
  --region \${REGION} \\
  --allow-unauthenticated \\
  --memory 512Mi \\
  --timeout 300

echo "Getting service URL..."
gcloud run services describe \${SERVICE_NAME} \\
  --region \${REGION} \\
  --format "value(status.url)"

echo "Deployment complete!"
`;
}

/**
 * Generate README with deployment instructions
 */
function generateREADME(agentName: string, model: string, tools: any[], deploymentType: string): string {
  return `# ${agentName}

AI Agent powered by Strands Agents

## Description

This agent was automatically generated by the Agent Builder Application.

- **Model**: ${model}
- **Tools**: ${tools.map(t => t.name).join(', ')}
- **Deployment**: ${deploymentType}

## Prerequisites

- Python 3.11 or higher
- Docker (for containerized deployment)
- AWS CLI (for AWS deployment)
- Azure CLI (for Azure deployment)
- Google Cloud SDK (for GCP deployment)

## Local Development

### Setup

\`\`\`bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\\Scripts\\activate

# Install dependencies
pip install -r requirements.txt
\`\`\`

### Run Agent

\`\`\`bash
python agent.py
\`\`\`

## Docker Deployment

### Build Image

\`\`\`bash
docker build -t ${agentName.toLowerCase().replace(/[^a-z0-9]/g, '-')} .
\`\`\`

### Run Container

\`\`\`bash
# Using AWS credentials
docker run -p 8000:8000 \\
  -e AWS_REGION=us-east-1 \\
  -e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \\
  -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \\
  ${agentName.toLowerCase().replace(/[^a-z0-9]/g, '-')}

# Optional: Add LangSmith monitoring
docker run -p 8000:8000 \\
  -e AWS_REGION=us-east-1 \\
  -e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \\
  -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \\
  -e LANGSMITH_API_KEY=$LANGSMITH_API_KEY \\
  ${agentName.toLowerCase().replace(/[^a-z0-9]/g, '-')}
\`\`\`

### Using Docker Compose

\`\`\`bash
docker-compose up -d
\`\`\`

## Cloud Deployment

### AWS (SAM)

\`\`\`bash
# Install SAM CLI
pip install aws-sam-cli

# Deploy
bash deploy_aws.sh
\`\`\`

### Azure (Container Instances)

\`\`\`bash
# Install Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Deploy
bash deploy_azure.sh
\`\`\`

### Google Cloud (Cloud Run)

\`\`\`bash
# Install gcloud SDK
curl https://sdk.cloud.google.com | bash

# Deploy
bash deploy_gcp.sh
\`\`\`

## Environment Variables

### Required
- \`AWS_REGION\`: AWS region for Bedrock (default: us-east-1)
- \`AWS_ACCESS_KEY_ID\`: AWS access key (or use IAM role)
- \`AWS_SECRET_ACCESS_KEY\`: AWS secret key (or use IAM role)

### Optional
- \`LANGSMITH_API_KEY\`: LangSmith API key for monitoring (optional)
- \`LOG_LEVEL\`: Logging level (default: INFO)
- \`BYPASS_TOOL_CONSENT\`: Auto-approve tool usage (default: true for container)
- \`OTEL_EXPORTER_OTLP_ENDPOINT\`: OpenTelemetry endpoint for custom tracing

### Security Note
Never hardcode API keys or credentials in your code. Use:
- AWS IAM roles when running in AWS
- AWS Secrets Manager for sensitive credentials
- Environment variables (but never commit .env files to git)

## API Usage

Once deployed, you can interact with the agent via HTTP:

\`\`\`bash
curl -X POST http://localhost:8000/invoke \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Hello, how can you help me?",
    "context": {}
  }'
\`\`\`

## Monitoring

This agent includes:
- **OpenTelemetry** for distributed tracing and metrics
- **AWS CloudWatch** integration (when deployed to AWS)
- **AWS X-Ray** support for trace visualization
- **Optional LangSmith** integration (set LANGSMITH_API_KEY environment variable)
- Structured logging to stdout/CloudWatch

### AWS Native Monitoring

When deployed to AWS, the agent automatically integrates with:
- **CloudWatch Logs**: All logs are streamed
- **CloudWatch Metrics**: Custom metrics for invocations, latency, errors
- **X-Ray**: Distributed tracing across services

### Optional: LangSmith

To enable LangSmith monitoring:
\`\`\`bash
# Set environment variable
export LANGSMITH_API_KEY=your-api-key

# Or store in AWS Secrets Manager (recommended)
aws secretsmanager create-secret \\
  --name /agent/${agentName}/langsmith-key \\
  --secret-string "your-api-key"
\`\`\`

## Troubleshooting

### Container fails to start
- Check logs: \`docker logs <container_id>\`
- Verify environment variables are set
- Ensure port 8000 is not in use

### Agent errors during execution
- Check \`LOG_LEVEL\` is set to DEBUG for detailed logs
- Verify model ID is correct for your deployment
- Ensure AWS credentials are properly configured

## License

Generated by Agent Builder Application
`;
}

/**
 * Export action to generate all deployment files
 */
export const generateDeploymentFiles = action({
  args: {
    agentId: v.string(),
    name: v.string(),
    model: v.string(),
    tools: v.array(v.any()),
    containerImage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { name, model, tools, containerImage } = args;
    
    return {
      dockerfile: generateDockerfile(tools),
      dockerCompose: generateDockerCompose(name),
      samTemplate: generateSAMTemplate(name, model),
      azureDeployment: generateAzureDeployment(name, containerImage || `${name}:latest`),
      gcpCloudRun: generateGCPCloudRun(name, containerImage || `${name}:latest`),
      agentCoreManifest: generateAgentCoreManifest(name, model, tools),
      deployScripts: {
        aws: generateAWSDeployScript(name),
        azure: generateAzureDeployScript(name),
        gcp: generateGCPDeployScript(name),
      },
      readme: generateREADME(name, model, tools, "multi-cloud"),
    };
  },
});
