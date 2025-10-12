import { action } from "./_generated/server";
import { v } from "convex/values";

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
    })),
    deploymentType: v.string(),
  },
  handler: async (ctx, args) => {
    const { name, model, systemPrompt, tools, deploymentType } = args;
    
    // Generate imports
    const imports = generateImports(tools, deploymentType);
    
    // Generate tool configurations
    const toolConfigs = generateToolConfigs(tools);
    
    // Generate agent class
    const agentClass = generateAgentClass(name, model, systemPrompt, tools);
    
    // Generate deployment configuration
    const deploymentConfig = generateDeploymentConfig(deploymentType, tools);
    
    const generatedCode = `${imports}

${toolConfigs}

${agentClass}

${deploymentConfig}`;

    // Generate Docker configuration if needed
    const dockerConfig = deploymentType === "docker" ? generateDockerConfig(tools) : undefined;
    
    return {
      generatedCode,
      dockerConfig,
    };
  },
});

function generateImports(tools: any[], deploymentType: string): string {
  const imports = [
    "from strandsagents import agent, Agent",
    "from agentcore.memory import MemoryManager",
    "from agentcore.interpreter import CodeInterpreter",
  ];
  
  if (deploymentType === "aws") {
    imports.push("import boto3");
    imports.push("from bedrock import BedrockClient");
  }
  
  if (deploymentType === "ollama") {
    imports.push("from ollama import Client as OllamaClient");
  }
  
  // Add tool-specific imports
  const toolImports = new Set<string>();
  tools.forEach(tool => {
    switch (tool.type) {
      case "web_search":
        toolImports.add("import requests");
        toolImports.add("from bs4 import BeautifulSoup");
        break;
      case "file_operations":
        toolImports.add("import os");
        toolImports.add("import json");
        break;
      case "database":
        toolImports.add("import sqlite3");
        toolImports.add("import pandas as pd");
        break;
      case "api_client":
        toolImports.add("import httpx");
        break;
      case "data_analysis":
        toolImports.add("import numpy as np");
        toolImports.add("import pandas as pd");
        toolImports.add("import matplotlib.pyplot as plt");
        break;
    }
  });
  
  return [...imports, ...Array.from(toolImports)].join("\n");
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
  const toolInstances = tools.map(tool => `        self.${tool.name.toLowerCase()} = ${getToolClassName(tool.type)}()`).join("\n");
  
  return `
@agent(
    model="${model}",
    system_prompt="""${systemPrompt}""",
    tools=[${tools.map(t => `"${t.name}"`).join(", ")}],
    memory=True,
    code_interpreter=True,
    reasoning="interleaved"
)
class ${className}(Agent):
    def __init__(self):
        super().__init__()
        self.memory = MemoryManager()
        self.interpreter = CodeInterpreter()
${toolInstances}
    
    async def process_message(self, message: str, context: dict = None):
        """Process incoming message with interleaved reasoning"""
        # Store message in memory
        self.memory.store_message(message, context)
        
        # Use Claude Sonnet 4.5 with interleaved reasoning
        response = await self.generate_response(
            message=message,
            context=context,
            reasoning_mode="interleaved"
        )
        
        return response
    
    async def execute_tool(self, tool_name: str, **kwargs):
        """Execute a tool by name"""
        tool = getattr(self, tool_name.lower(), None)
        if tool and hasattr(tool, kwargs.get('method', 'execute')):
            return await getattr(tool, kwargs.get('method', 'execute'))(**kwargs)
        raise ValueError(f"Tool {tool_name} not found or method not available")`;
}

function getToolClassName(toolType: string): string {
  switch (toolType) {
    case "web_search": return "WebSearchTool";
    case "file_operations": return "FileOperationsTool";
    case "database": return "DatabaseTool";
    default: return "GenericTool";
  }
}

function generateDeploymentConfig(deploymentType: string, tools: any[]): string {
  switch (deploymentType) {
    case "aws":
      return `
# AWS Deployment Configuration
if __name__ == "__main__":
    import asyncio
    
    async def main():
        # Initialize Bedrock client
        bedrock = BedrockClient(region_name="us-east-1")
        
        # Create agent instance
        agent = ${generateAgentClassName()}()
        
        # Deploy to AWS Lambda or ECS
        await agent.deploy_to_aws(bedrock_client=bedrock)
    
    asyncio.run(main())`;
    
    case "ollama":
      return `
# Ollama Deployment Configuration
if __name__ == "__main__":
    import asyncio
    
    async def main():
        # Initialize Ollama client
        ollama = OllamaClient(host="localhost:11434")
        
        # Create agent instance
        agent = ${generateAgentClassName()}()
        
        # Run with Ollama
        await agent.run_with_ollama(ollama_client=ollama)
    
    asyncio.run(main())`;
    
    case "docker":
      return `
# Docker Deployment Configuration
if __name__ == "__main__":
    import asyncio
    from agentcore.hosting import DockerHost
    
    async def main():
        # Create agent instance
        agent = ${generateAgentClassName()}()
        
        # Deploy to Docker container
        host = DockerHost()
        await host.deploy_agent(agent)
    
    asyncio.run(main())`;
    
    default:
      return `
# Local Development Configuration
if __name__ == "__main__":
    import asyncio
    
    async def main():
        agent = ${generateAgentClassName()}()
        
        # Interactive mode
        while True:
            user_input = input("You: ")
            if user_input.lower() in ['quit', 'exit']:
                break
            
            response = await agent.process_message(user_input)
            print(f"Agent: {response}")
    
    asyncio.run(main())`;
  }
}

function generateAgentClassName(): string {
  return "Agent"; // Simplified for template
}

function generateDockerConfig(tools: any[]): string {
  const pipPackages = tools
    .filter(tool => tool.requiresPip)
    .flatMap(tool => tool.pipPackages || [])
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

# Copy agent code
COPY . .

# Expose port
EXPOSE 8000

# Run the agent
CMD ["python", "agent.py"]`;
}
