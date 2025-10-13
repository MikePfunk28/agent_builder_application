## Build and deploy the agent manually, using containerUri
```python
import boto3

# Create the client
client = boto3.client('bedrock-agentcore-control', region_name="us-east-1")
my_agent_name = 'my-agent'
# Call the CreateAgentRuntime operation
response = client.create_agent_runtime(
    agentRuntimeName='{{my_agent_name}}',
    agentRuntimeArtifact={
        'containerConfiguration': {
            # Your ECR image Uri
            'containerUri': '058264416770.dkr.ecr.us-east-1.amazonaws.com/my-agent:latest'
        }
    },
    networkConfiguration={"networkMode":"PUBLIC"},
    # Your AgentCore Runtime role arn
    roleArn='arn:aws:iam::058264416770:role/devpost-hackathon'
)
```

## Invoke the agent
```python
import boto3
import json

# Initialize the AgentCore Runtime client
agent_core_client = boto3.client('bedrock-agentcore')

# Prepare the payload
payload = json.dumps({"prompt": prompt}).encode()

# Invoke the agent
response = agent_core_client.invoke_agent_runtime(
    agentRuntimeArn=agent_arn, # you will get this from deployment
    runtimeSessionId=session_id, # you will get this from deployment
    payload=payload
)
```
===============================================================================
Option B: Custom Agent
This section is complete - follow all steps below if you choose the custom agent approach.

This approach demonstrates how to deploy a custom agent using FastAPI and Docker, following AgentCore Runtime requirements.

Requirements

FastAPI Server: Web server framework for handling requests
/invocations Endpoint: POST endpoint for agent interactions (REQUIRED)
/ping Endpoint: GET endpoint for health checks (REQUIRED)
Container Engine: Docker, Finch, or Podman (required for this example)
Docker Container: ARM64 containerized deployment package
Step 1: Quick Start Setup
Install uv
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```
Create Project

```bash
mkdir my-custom-agent && cd my-custom-agent
uv init --python 3.11
uv add fastapi uvicorn[standard] pydantic httpx strands-agents
```
Project Structure example

my-custom-agent/
├── agent.py                 # FastAPI application
├── Dockerfile               # ARM64 container configuration
├── pyproject.toml          # Created by uv init
└── uv.lock                 # Created automatically by uv
Step 2: Prepare your agent code
Example: agent.py
```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
from datetime import datetime,timezone
from strands import Agent

app = FastAPI(title="Strands Agent Server", version="1.0.0")

# Initialize Strands agent
strands_agent = Agent()

class InvocationRequest(BaseModel):
    input: Dict[str, Any]

class InvocationResponse(BaseModel):
    output: Dict[str, Any]

@app.post("/invocations", response_model=InvocationResponse)
async def invoke_agent(request: InvocationRequest):
    try:
        user_message = request.input.get("prompt", "")
        if not user_message:
            raise HTTPException(
                status_code=400,
                detail="No prompt found in input. Please provide a 'prompt' key in the input."
            )

        result = strands_agent(user_message)
        response = {
            "message": result.message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "model": "strands-agent",
        }

        return InvocationResponse(output=response)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent processing failed: {str(e)}")

@app.get("/ping")
async def ping():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
```
Step 3: Test Locally
# Run the application
```bash
uv run uvicorn agent:app --host 0.0.0.0 --port 8080
```
# Test /ping endpoint
```bash
curl http://localhost:8080/ping
```
# Test /invocations endpoint
```bash
curl -X POST http://localhost:8080/invocations \
  -H "Content-Type: application/json" \
  -d '{
    "input": {"prompt": "What is artificial intelligence?"}
  }'
```
Step 4: Prepare your docker image
Create docker file
```dockerfile
# Use uv's ARM64 Python base image
FROM --platform=linux/arm64 ghcr.io/astral-sh/uv:python3.11-bookworm-slim

WORKDIR /app

# Copy uv files
COPY pyproject.toml uv.lock ./

# Install dependencies (including strands-agents)
RUN uv sync --frozen --no-cache

# Copy agent file
COPY agent.py ./

# Expose port
EXPOSE 8080

# Run application
CMD ["uv", "run", "uvicorn", "agent:app", "--host", "0.0.0.0", "--port", "8080"]
```
Setup Docker buildx

docker buildx create --use
Build and Test Locally

# Build the image
docker buildx build --platform linux/arm64 -t my-agent:arm64 --load .

# Test locally with credentials
docker run --platform linux/arm64 -p 8080:8080 \
  -e AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
  -e AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
  -e AWS_SESSION_TOKEN="$AWS_SESSION_TOKEN" \
  -e AWS_REGION="$AWS_REGION" \
  my-agent:arm64
Deploy to ECR

# Create ECR repository
aws ecr create-repository --repository-name my-strands-agent --region us-west-2

# Login to ECR
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-west-2.amazonaws.com

# Build and push to ECR
docker buildx build --platform linux/arm64 -t <account-id>.dkr.ecr.us-west-2.amazonaws.com/my-strands-agent:latest --push .

# Verify the image
aws ecr describe-images --repository-name my-strands-agent --region us-west-2
Step 5: Deploy Agent Runtime
Example: deploy_agent.py

import boto3

client = boto3.client('bedrock-agentcore-control')

response = client.create_agent_runtime(
    agentRuntimeName='strands_agent',
    agentRuntimeArtifact={
        'containerConfiguration': {
            'containerUri': '<account-id>.dkr.ecr.us-west-2.amazonaws.com/my-strands-agent:latest'
        }
    },
    networkConfiguration={"networkMode": "PUBLIC"},
    roleArn='arn:aws:iam::<account-id>:role/AgentRuntimeRole'
)

print(f"Agent Runtime created successfully!")
print(f"Agent Runtime ARN: {response['agentRuntimeArn']}")
print(f"Status: {response['status']}")
Execute python file

uv run deploy_agent.py
Step 6: Invoke Your Agent
Example: invoke_agent.py

import boto3
import json

agent_core_client = boto3.client('bedrock-agentcore', region_name='us-west-2')
payload = json.dumps({
    "input": {"prompt": "Explain machine learning in simple terms"}
})

response = agent_core_client.invoke_agent_runtime(
    agentRuntimeArn='arn:aws:bedrock-agentcore:us-west-2:<account-id>:runtime/myStrandsAgent-suffix',
    runtimeSessionId='dfmeoagmreaklgmrkleafremoigrmtesogmtrskhmtkrlshmt',  # Must be 33+ chars
    payload=payload,
    qualifier="DEFAULT"
)

response_body = response['response'].read()
response_data = json.loads(response_body)
print("Agent Response:", response_data)
Execute python file

uv run invoke_agent.py
Expected Response Format

{
  "output": {
    "message": {
      "role": "assistant",
      "content": [
        {
          "text": "# Artificial Intelligence in Simple Terms\n\nArtificial Intelligence (AI) is technology that allows computers to do tasks that normally need human intelligence. Think of it as teaching machines to:\n\n- Learn from information (like how you learn from experience)\n- Make decisions based on what they've learned\n- Recognize patterns (like identifying faces in photos)\n- Understand language (like when I respond to your questions)\n\nInstead of following specific step-by-step instructions for every situation, AI systems can adapt to new information and improve over time.\n\nExamples you might use every day include voice assistants like Siri, recommendation systems on streaming services, and email spam filters that learn which messages are unwanted."
        }
      ]
    },
    "timestamp": "2025-07-13T01:48:06.740668",
    "model": "strands-agent"
  }
}
Shared Information
This section applies to both deployment approaches - reference as needed regardless of which option you chose.

AgentCore Runtime Requirements Summary
Platform: Must be linux/arm64
Endpoints: /invocations POST and /ping GET are mandatory
ECR: Images must be deployed to ECR
Port: Application runs on port 8080
Strands Integration: Uses Strands Agent for AI processing
Credentials: Require AWS credentials for operation
Best Practices
Development

Test locally before deployment
Use version control
Keep dependencies updated
Configuration

Use appropriate IAM roles
Implement proper error handling
Monitor agent performance
Security

Follow the least privilege principle
Secure sensitive information
Regular security updates
Troubleshooting
Deployment Failures

Verify AWS credentials are configured correctly
Check IAM role permissions
Ensure container engine is running (for local testing with agentcore launch --local or Option B custom deployments)
Runtime Errors

Check CloudWatch logs
Verify environment variables
Test agent locally first
Container Issues

Verify container engine installation (Docker, Finch, or Podman)
Check port configurations
Review Dockerfile if customized
Observability Enablement
Amazon Bedrock AgentCore provides built-in metrics to monitor your Strands agents. This section explains how to enable observability for your agents to view metrics, spans, and traces in CloudWatch.

With AgentCore, you can also view metrics for agents that aren't running in the AgentCore runtime. Additional setup steps are required to configure telemetry outputs for non-AgentCore agents. See the instructions in Configure Observability for agents hosted outside of the AgentCore runtime to learn more.

Step 1: Enable CloudWatch Transaction Search
Before you can view metrics and traces, complete this one-time setup:

Via AgentCore Console

Look for the "Enable Observability" button when creating a memory resource

If you don't see this button while configuring your agent (for example, if you don't create a memory resource in the console), you must enable observability manually by using the CloudWatch console to enable Transaction Search as described in the following procedure.

Via CloudWatch Console

Open the CloudWatch console
Navigate to Application Signals (APM) > Transaction search
Choose "Enable Transaction Search"
Select the checkbox to ingest spans as structured logs
Optionally adjust the X-Ray trace indexing percentage (default is 1%)
Choose Save
Step 2: Add ADOT to Your Strands Agent
Add to your requirements.txt:

aws-opentelemetry-distro>=0.10.1
boto3
Or install directly:

pip install aws-opentelemetry-distro>=0.10.1 boto3
Run With Auto-Instrumentation

For SDK Integration (Option A):
opentelemetry-instrument python my_agent.py
For Docker Deployment:
CMD ["opentelemetry-instrument", "python", "main.py"]
For Custom Agent (Option B):
CMD ["opentelemetry-instrument", "uvicorn", "agent:app", "--host", "0.0.0.0", "--port", "8080"]
Step 3: Viewing Your Agent's Observability Data
Open the CloudWatch console
Navigate to the GenAI Observability page
Find your agent service
View traces, metrics, and logs
Session ID support
To propagate session ID, you need to invoke using session identifier in the OTEL baggage:

from opentelemetry import baggage,context

ctx = baggage.set_baggage("session.id", session_id) # Set the session.id in baggage
context.attach(ctx)
Enhanced AgentCore observability with custom headers (Optional)
You can invoke your agent with additional HTTP headers to provide enhanced observability options. The following example shows invocations including optional additional header requests for agents hosted in the AgentCore runtime.

```python
import boto3

def invoke_agent(agent_id, payload, session_id=None):
    client = boto3.client("bedrock-agentcore", region_name="us-west-2")
    response = client.invoke_agent_runtime(
        agentRuntimeArn=f"arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/{agent_id}",
        runtimeSessionId="12345678-1234-5678-9abc-123456789012",
        payload=payload
    )
    return response
```
Common Tracing Headers Examples:

| Header | Description | Sample Value |
| X-Amzn-Trace-Id | X-Ray format trace ID | Root=1-5759e988-bd862e3fe1be46a994272793;  Parent=53995c3f42cd8ad8;Sampled=1 |
| traceparent | W3C standard tracing header | 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01 |
| X-Amzn-Bedrock-AgentCore-Runtime-Session-Id	| Session identifier	|aea8996f-dcf5-4227-b5ea-f9e9c1843729 |
| baggage	| User-defined properties	| userId=alice,serverRegion=us-east-1 |
For more supported headers details, please check Bedrock AgentCore Runtime Observability Configuration

Best Practices
Use consistent session IDs across related requests
Set appropriate sampling rates (1% is default)
Monitor key metrics like latency, error rates, and token usage
Set up CloudWatch alarms for critical thresholds
Notes
Amazon Bedrock AgentCore is in preview release and is subject to change.
Keep your AgentCore Runtime and Strands packages updated for latest features and security fixes

Additional Resources
Amazon Bedrock AgentCore Runtime Documentation
Strands Documentation
AWS IAM Documentation
Docker Documentation
Amazon Bedrock AgentCore Observability