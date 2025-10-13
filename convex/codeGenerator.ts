/**
 * Phase 7: Enhanced Code Generation
 * Implementation per comprehensive_plan.md lines 952-1178
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import { getModelConfig } from "./modelRegistry";

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
  },
  handler: async (ctx, args) => {
    const { name, model, systemPrompt, tools, deploymentType } = args;
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
      timestamp
    });
    
    // Generate requirements.txt per Phase 7.2 spec (lines 1160-1178)
    const requirementsTxt = generateRequirementsTxt(tools);
    
    return {
      generatedCode,
      requirementsTxt,
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
  imports.push("from strandsagents.tools import (");
  
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
  
  // Add LangSmith and OpenTelemetry imports for monitoring
  imports.push("# Monitoring imports");
  imports.push("from langsmith import Client as LangSmithClient");
  imports.push("from opentelemetry import trace");
  imports.push("");
  
  // Add logging setup
  imports.push("# Configure logging");
  imports.push("logging.basicConfig(");
  imports.push("    level=logging.INFO,");
  imports.push("    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'");
  imports.push(")");
  imports.push("logger = logging.getLogger(__name__)");
  imports.push("");
  
  imports.push("# Initialize monitoring");
  imports.push("langsmith_client = LangSmithClient(");
  imports.push("    api_key=os.getenv('LANGSMITH_API_KEY', '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')");
  imports.push(")");
  imports.push("tracer = trace.get_tracer(__name__)");
  imports.push("");
  
  return imports.join("\n");
}

function generateToolConfigs(tools: any[]): string {
  return tools.map(tool => {
    switch (tool.type) {
      case "web_search":
        return `
class WebSearchTool:
    def __init__(self):
        self.session = requests.Session()
    
    def search(self, query: str, max_results: int = 5):
        """Search the web for information"""
        # Implementation for web search
        pass`;
      
      case "file_operations":
        return `
class FileOperationsTool:
    def __init__(self, base_path: str = "./"):
        self.base_path = base_path
    
    def read_file(self, filepath: str):
        """Read contents of a file"""
        with open(os.path.join(self.base_path, filepath), 'r') as f:
            return f.read()
    
    def write_file(self, filepath: str, content: str):
        """Write content to a file"""
        with open(os.path.join(self.base_path, filepath), 'w') as f:
            f.write(content)`;
      
      case "database":
        return `
class DatabaseTool:
    def __init__(self, db_path: str = "agent.db"):
        self.db_path = db_path
    
    def query(self, sql: str):
        """Execute SQL query"""
        conn = sqlite3.connect(self.db_path)
        result = pd.read_sql_query(sql, conn)
        conn.close()
        return result`;
      
      default:
        return `# ${tool.name} tool configuration`;
    }
  }).join("\n\n");
}

function generateAgentClass(name: string, model: string, systemPrompt: string, tools: any[]): string {
  const className = name.replace(/[^a-zA-Z0-9]/g, "") + "Agent";
  const toolList = tools.map(t => t.type).join(", ");
  
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
    system_prompt="""${systemPrompt}""",
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
# AWS Deployment Configuration
if __name__ == "__main__":
    async def main():
        """Deploy agent to AWS"""
        # Initialize Bedrock client with retry configuration
        config = Config(
            region_name=os.getenv("AWS_REGION", "us-east-1"),
            retries={'max_attempts': 3, 'mode': 'adaptive'}
        )
        bedrock = boto3.client('bedrock-runtime', config=config)
        
        # Create agent instance
        agent = ${className}()
        logger.info("Agent initialized for AWS deployment")
        
        # Example: Process a test message
        response = await agent.run("Hello, I need help with a task.")
        print(f"Agent Response: {response}")
    
    asyncio.run(main())`;
    
    case "ollama":
      return `
# Ollama Deployment Configuration
if __name__ == "__main__":
    async def main():
        """Run agent with Ollama"""
        # Initialize Ollama client
        ollama_host = os.getenv("OLLAMA_HOST", "localhost:11434")
        logger.info(f"Connecting to Ollama at {ollama_host}")
        
        # Create agent instance
        agent = ${className}()
        logger.info("Agent initialized for Ollama deployment")
        
        # Example: Process a test message
        response = await agent.run("Hello, I need help with a task.")
        print(f"Agent Response: {response}")
    
    asyncio.run(main())`;
    
    case "docker":
      return `
# Docker Deployment Configuration
if __name__ == "__main__":
    async def main():
        """Run agent in Docker container"""
        # Create agent instance
        agent = ${className}()
        logger.info("Agent initialized for Docker deployment")
        
        # Start FastAPI server or other deployment method
        # Example: Interactive mode for testing
        print("Agent ready. Type 'quit' or 'exit' to stop.")
        while True:
            try:
                user_input = input("\nYou: ")
                if user_input.lower() in ['quit', 'exit']:
                    break
                
                response = await agent.run(user_input)
                print(f"\nAgent: {response}")
            except KeyboardInterrupt:
                print("\nShutting down...")
                break
            except Exception as e:
                logger.error(f"Error: {e}")
    
    asyncio.run(main())`;
    
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
}): string {
  const { name, className, model, systemPrompt, tools, deploymentType, timestamp } = config;
  
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
  
  // Get model initialization code from model registry
  let modelInitCode = "";
  try {
    const modelConfig = getModelConfig(model);
    modelInitCode = modelConfig.initCode;
  } catch (error) {
    // Fallback for unknown models
    modelInitCode = `# Model initialization\nmodel = "${model}"`;
  }
  
  const agentClass = generateAgentClass(name, model, systemPrompt, tools);
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
      - AWS_REGION=\${AWS_REGION:-us-east-1}
      - LANGSMITH_API_KEY=\${LANGSMITH_API_KEY}
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
docker run -p 8000:8000 \\
  -e AWS_REGION=us-east-1 \\
  -e LANGSMITH_API_KEY=your_key \\
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

- \`AWS_REGION\`: AWS region for Bedrock (default: us-east-1)
- \`LANGSMITH_API_KEY\`: LangSmith API key for monitoring
- \`LOG_LEVEL\`: Logging level (default: INFO)
- \`BYPASS_TOOL_CONSENT\`: Auto-approve tool usage (default: true for container)

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
- **LangSmith** integration for tracing
- **OpenTelemetry** for metrics
- Structured logging to stdout

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
