Great question! Here's how to set up and use the agent sandbox to test your Strands agents with AgentCore:

Setting Up the Agent Testing Environment
1. Install Dependencies:

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install required packages
pip install strands-agents
pip install strands-agents-tools
pip install bedrock-agentcore
pip install bedrock-agentcore-starter-toolkit

Run in CloudShell
2. Create Your Agent File (e.g., my_agent.py):
```python
from strands import Agent, tool
from strands.models import BedrockModel
from bedrock_agentcore.runtime import BedrockAgentCoreApp

# Your agent code
@tool
def web_search(query: str) -> str:
    """Search the web for information"""
    # Your tool implementation
    return f"Search results for: {query}"

model = BedrockModel(model_id="anthropic.claude-3-5-sonnet")
agent = Agent(
    model=model,
    tools=[web_search],
    system_prompt="You are a helpful assistant."
)

# AgentCore Runtime wrapper
app = BedrockAgentCoreApp()

@app.entrypoint
def agent_handler(payload):
    user_input = payload.get("prompt")
    response = agent(user_input)
    return response.message['content'][0]['text']

if __name__ == "__main__":
    app.run()
```
Testing Your Agent
Option 1: Local Testing (Development)

# Run locally for development
python my_agent.py

Run in CloudShell
Option 2: Deploy to AgentCore Runtime (Sandbox)

# Configure the agent
agentcore configure --entrypoint my_agent.py

# Deploy to AgentCore Runtime
agentcore launch

# Test the deployed agent
agentcore invoke --prompt "Hello, how are you?"

Run in CloudShell
AgentCore Starter Toolkit Commands
Configure:

agentcore configure --entrypoint my_agent.py
# This creates IAM roles, ECR repository, and configuration

Run in CloudShell
Launch:

agentcore launch
# Builds Docker container, pushes to ECR, deploys to AgentCore Runtime

Run in CloudShell
Invoke/Test:

# Test your deployed agent
agentcore invoke --prompt "Your test message"

# Or with JSON payload
agentcore invoke --payload '{"prompt": "Test message", "session_id": "test123"}'

Run in CloudShell
Testing Environment Features
Sandbox Benefits:

✅ Session Isolation: Each test runs in isolated microVM
✅ Automatic Observability: Built-in tracing and monitoring
✅ Secure Environment: No cross-contamination between tests
✅ Real AWS Integration: Test with actual AWS services
✅ Framework Agnostic: Works with Strands, LangGraph, CrewAI, etc.
Available Regions for Testing:

US East (N. Virginia)
US West (Oregon)
Asia Pacific (Sydney)
Europe (Frankfurt)
Testing Different Agent Types
Memory-Enabled Agent:

from bedrock_agentcore.memory import MemoryClient
from bedrock_agentcore.memory.integrations.strands.session_manager import AgentCoreMemorySessionManager

# Add memory to your agent for testing
client = MemoryClient(region_name="us-east-1")
memory = client.create_memory(name="TestMemory")
# ... configure memory and test

Multi-Agent Testing:

# Test agent-to-agent communication
from strands.multiagent.a2a import A2AServer

# Set up A2A server for testing
a2a_agent = A2AServer(agent=agent, port=9000)

Monitoring Your Tests
Built-in Observability:

CloudWatch Integration: Automatic metrics and logs
X-Ray Tracing: Complete execution traces
Custom Scoring: Evaluate agent performance
Session Tracking: Monitor user interactions
The AgentCore sandbox is perfect for:

Testing agent logic before production
Validating tool integrations
Performance testing
Security testing in isolated environment
Multi-agent orchestration testing
Ready to set up your first agent test? The sandbox environment gives you a production-like testing experience with full AWS integration!