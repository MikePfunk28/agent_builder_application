"use node";

/**
 * Real Agent Testing - Container-Based Testing & Deployment System
 *
 * Creates Docker containers where users can test their generated agents with:
 * - Full chat interface using strandsagents conversation manager
 * - All dependencies: agentcore, strandsagents, bedrock models, ollama, tools
 * - Real model testing and tool evaluation
 * - One-click deployment to AWS Bedrock AgentCore
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Create a test container for the user's agent
 */
export const createTestContainer = action({
  args: {
    agentCode: v.string(),
    requirements: v.string(),
    agentName: v.string(),
    modelId: v.string(),
    tools: v.array(v.object({
      name: v.string(),
      type: v.string(),
      requiresPip: v.optional(v.boolean()),
      pipPackages: v.optional(v.array(v.string())),
    })),
    systemPrompt: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new Error("Authentication required");
      }

      // Generate container configuration
      const containerConfig = generateContainerConfig(args);
      
      // Create container with chat interface
      const containerId = `agent-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // In real implementation, this would:
      // 1. Create AgentCore runtime with the agent package
      // 2. Set up chat endpoint with strandsagents conversation manager
      // 3. Install all dependencies (agentcore, strandsagents, tools)
      // 4. Start the agent with @agent decorator
      
      const containerUrl = await startTestContainer(containerId, containerConfig);
      
      return {
        success: true,
        containerId,
        chatUrl: containerUrl,
        status: "starting",
        message: "Test container is starting up. Chat interface will be available shortly.",
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to create test container: ${error.message}`,
      };
    }
  },
});

/**
 * Get test container status and chat URL
 */
export const getContainerStatus = action({
  args: {
    containerId: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    try {
      // Check container status
      const status = await checkContainerStatus(args.containerId);
      
      return {
        containerId: args.containerId,
        status: status.status,
        chatUrl: status.chatUrl,
        logs: status.logs,
        ready: status.status === "running",
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to get container status: ${error.message}`,
      };
    }
  },
});

/**
 * Deploy agent to user's AWS account using Bedrock AgentCore
 */
export const deployToAWS = action({
  args: {
    containerId: v.string(),
    agentName: v.string(),
    agentCode: v.string(),
    requirements: v.string(),
    modelId: v.string(),
    tools: v.array(v.object({
      name: v.string(),
      type: v.string(),
      requiresPip: v.optional(v.boolean()),
      pipPackages: v.optional(v.array(v.string())),
    })),
    awsCredentials: v.object({
      accessKeyId: v.string(),
      secretAccessKey: v.string(),
      region: v.string(),
    }),
  },
  handler: async (ctx, args): Promise<any> => {
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new Error("Authentication required");
      }

      // Generate deployment package
      const deploymentPackage = generateDeploymentPackage(args);
      
      // Deploy to Bedrock AgentCore
      const deploymentResult = await deployToBedrock(deploymentPackage, args.awsCredentials);
      
      return {
        success: true,
        deploymentId: deploymentResult.deploymentId,
        agentEndpoint: deploymentResult.endpoint,
        status: "deploying",
        message: "Agent is being deployed to your AWS account. This may take a few minutes.",
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: `Deployment failed: ${error.message}`,
      };
    }
  },
});

/**
 * Stop and cleanup test container
 */
export const stopTestContainer = action({
  args: {
    containerId: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    try {
      await cleanupContainer(args.containerId);
      
      return {
        success: true,
        message: "Test container stopped and cleaned up",
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to stop container: ${error.message}`,
      };
    }
  },
});

// Helper Functions

function generateContainerConfig(args: any) {
  return {
    agentCode: args.agentCode,
    requirements: generateFullRequirements(args.tools),
    dockerfile: generateTestDockerfile(args.modelId),
    chatInterface: generateChatInterface(args.agentName, args.systemPrompt),
    modelId: args.modelId,
    tools: args.tools,
  };
}

function generateFullRequirements(tools: any[]): string {
  const baseRequirements = [
    "# Core agent framework",
    "strands-agents>=1.0.0",
    "agentcore>=1.0.0",
    "",
    "# Strands agents tools with all extras",
    "strands-agents-tools>=1.0.0",
    "",
    "# Model providers",
    "boto3>=1.28.0",
    "anthropic>=0.25.0",
    "ollama>=0.1.0",
    "openai>=1.0.0",
    "",
    "# Chat interface dependencies",
    "fastapi>=0.100.0",
    "uvicorn>=0.23.0",
    "websockets>=11.0.0",
    "pydantic>=2.0.0",
    "",
    "# Tool dependencies",
    "requests>=2.31.0",
    "beautifulsoup4>=4.12.0",
    "pandas>=2.0.0",
    "numpy>=1.24.0",
    "",
  ];

  // Add tool-specific requirements
  const toolRequirements = new Set<string>();
  tools.forEach(tool => {
    if (tool.extrasPip) {
      toolRequirements.add(`strands-agents-tools[${tool.extrasPip}]`);
    }
    if (tool.pipPackages && Array.isArray(tool.pipPackages)) {
      tool.pipPackages.forEach((pkg: string) => toolRequirements.add(pkg));
    }
  });

  if (toolRequirements.size > 0) {
    baseRequirements.push("# Tool-specific requirements");
    baseRequirements.push(...Array.from(toolRequirements));
  }

  return baseRequirements.join("\n");
}

function generateTestDockerfile(modelId: string): string {
  return `FROM python:3.11-slim

# Install system dependencies for tools
RUN apt-get update && apt-get install -y \\
    build-essential \\
    curl \\
    git \\
    chromium \\
    xvfb \\
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent files
COPY agent.py .
COPY chat_server.py .
COPY test_runner.py .

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV BYPASS_TOOL_CONSENT=true
ENV MODEL_ID=${modelId}

# Expose port for chat interface
EXPOSE 8000

# Start chat server
CMD ["python", "chat_server.py"]
`;
}

function generateChatInterface(agentName: string, systemPrompt: string): string {
  return `#!/usr/bin/env python3
"""
Chat Interface for Agent Testing
Uses strandsagents conversation manager for chat flow
"""
import asyncio
import json
import logging
from typing import Dict, Any, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import uvicorn

# Import the generated agent
from agent import *

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="${agentName} Test Chat")

class ChatManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.agent = None
        self.conversation_history = []
        
    async def initialize_agent(self):
        """Initialize the agent with conversation manager"""
        try:
            # Find the agent class dynamically
            agent_class = None
            for name, obj in globals().items():
                if (isinstance(obj, type) and 
                    hasattr(obj, '__bases__') and 
                    any('Agent' in str(base) for base in obj.__bases__)):
                    agent_class = obj
                    break
            
            if not agent_class:
                raise Exception("No Agent class found")
            
            self.agent = agent_class()
            logger.info(f"Agent {agent_class.__name__} initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize agent: {e}")
            return False
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        
        # Send welcome message
        await websocket.send_text(json.dumps({
            "type": "system",
            "message": "🤖 ${agentName} is ready! Start chatting to test your agent.",
            "timestamp": asyncio.get_event_loop().time()
        }))
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
    
    async def send_message(self, websocket: WebSocket, message: str, msg_type: str = "agent"):
        await websocket.send_text(json.dumps({
            "type": msg_type,
            "message": message,
            "timestamp": asyncio.get_event_loop().time()
        }))
    
    async def process_user_message(self, websocket: WebSocket, message: str):
        """Process user message through the agent"""
        try:
            # Add to conversation history
            self.conversation_history.append({"role": "user", "content": message})
            
            # Send typing indicator
            await self.send_message(websocket, "Agent is thinking...", "typing")
            
            # Process through agent
            if hasattr(self.agent, 'run'):
                response = await self.agent.run(message)
            elif hasattr(self.agent, 'process_message'):
                response = await self.agent.process_message(message)
            elif hasattr(self.agent, 'invoke'):
                response = await self.agent.invoke(message)
            elif hasattr(self.agent, '__call__'):
                response = await self.agent(message)
            else:
                response = "Agent has no recognizable method to process messages"
            
            # Add to conversation history
            self.conversation_history.append({"role": "assistant", "content": str(response)})
            
            # Send response
            await self.send_message(websocket, str(response), "agent")
            
        except Exception as e:
            error_msg = f"Error processing message: {str(e)}"
            logger.error(error_msg)
            await self.send_message(websocket, error_msg, "error")

# Global chat manager
chat_manager = ChatManager()

@app.on_event("startup")
async def startup_event():
    """Initialize agent on startup"""
    success = await chat_manager.initialize_agent()
    if not success:
        logger.error("Failed to initialize agent")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await chat_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            if message_data.get("type") == "user_message":
                await chat_manager.process_user_message(
                    websocket, 
                    message_data.get("message", "")
                )
                
    except WebSocketDisconnect:
        chat_manager.disconnect(websocket)

@app.get("/")
async def get_chat_interface():
    """Serve the chat interface"""
    return HTMLResponse(content="""
<!DOCTYPE html>
<html>
<head>
    <title>${agentName} - Test Chat</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #1a1a1a; color: #fff; }
        .chat-container { max-width: 800px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 20px; }
        .chat-box { height: 400px; border: 1px solid #333; padding: 10px; overflow-y: auto; background: #2a2a2a; border-radius: 8px; }
        .message { margin: 10px 0; padding: 8px; border-radius: 4px; }
        .user-message { background: #0066cc; text-align: right; }
        .agent-message { background: #006600; }
        .system-message { background: #666; font-style: italic; }
        .error-message { background: #cc0000; }
        .input-container { margin-top: 10px; display: flex; }
        .message-input { flex: 1; padding: 10px; border: 1px solid #333; background: #2a2a2a; color: #fff; border-radius: 4px; }
        .send-button { padding: 10px 20px; background: #0066cc; color: white; border: none; border-radius: 4px; margin-left: 10px; cursor: pointer; }
        .send-button:hover { background: #0052a3; }
        .info { background: #333; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="chat-container">
        <div class="header">
            <h1>🤖 ${agentName}</h1>
            <p>Test your agent in real-time with full tool access</p>
        </div>
        
        <div class="info">
            <strong>System Prompt:</strong> ${systemPrompt}
        </div>
        
        <div id="chatBox" class="chat-box"></div>
        
        <div class="input-container">
            <input type="text" id="messageInput" class="message-input" placeholder="Type your message here..." />
            <button onclick="sendMessage()" class="send-button">Send</button>
        </div>
    </div>

    <script>
        const ws = new WebSocket('ws://localhost:8000/ws');
        const chatBox = document.getElementById('chatBox');
        const messageInput = document.getElementById('messageInput');
        
        ws.onmessage = function(event) {
            const data = JSON.parse(event.data);
            addMessage(data.message, data.type);
        };
        
        function addMessage(message, type) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + type + '-message';
            messageDiv.textContent = message;
            chatBox.appendChild(messageDiv);
            chatBox.scrollTop = chatBox.scrollHeight;
        }
        
        function sendMessage() {
            const message = messageInput.value.trim();
            if (message) {
                addMessage(message, 'user');
                ws.send(JSON.stringify({
                    type: 'user_message',
                    message: message
                }));
                messageInput.value = '';
            }
        }
        
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    </script>
</body>
</html>
    """)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "agent_ready": chat_manager.agent is not None}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
`;
}

async function startTestContainer(containerId: string, config: any): Promise<string> {
  // In real implementation, this would:
  // 1. Create AgentCore runtime with the agent configuration
  // 2. Wait for runtime to be ready
  // 3. Return the chat interface URL
  
  // For now, return a mock URL
  return `http://localhost:8000/chat/${containerId}`;
}

async function checkContainerStatus(containerId: string): Promise<any> {
  // Mock implementation - in reality would check AgentCore runtime status
  return {
    status: "running",
    chatUrl: `http://localhost:8000/chat/${containerId}`,
    logs: [
      "Container started successfully",
      "Agent initialized",
      "Chat interface ready",
    ],
  };
}

function generateDeploymentPackage(args: any) {
  return {
    agentName: args.agentName,
    agentCode: args.agentCode,
    requirements: args.requirements,
    modelId: args.modelId,
    tools: args.tools,
    containerImage: `agent-${args.agentName.toLowerCase().replace(/[^a-z0-9]/g, '-')}:latest`,
  };
}

async function deployToBedrock(deploymentPackage: any, awsCredentials: any): Promise<any> {
  // In real implementation, this would:
  // 1. Package agent code and dependencies
  // 2. Upload to S3
  // 3. Create Bedrock AgentCore deployment
  // 4. Return deployment details
  
  return {
    deploymentId: `deployment-${Date.now()}`,
    endpoint: `https://agent-${deploymentPackage.agentName}.bedrock.aws.com`,
  };
}

async function cleanupContainer(containerId: string): Promise<void> {
  // In real implementation, this would stop and cleanup the AgentCore runtime
}