/**
 * AgentCore Deployment Generator
 * 
 * Generates all necessary files for deploying agents to AWS Bedrock AgentCore
 * based on the manual deployment process documented in docs/manual_deploy.md
 * 
 * AgentCore Requirements:
 * - Platform: linux/arm64 (CRITICAL!)
 * - Endpoints: /invocations (POST), /ping (GET)
 * - Port: 8080
 * - Container: Must be in ECR
 * - Session IDs: Must be 33+ characters
 */

import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Generate FastAPI server wrapper for AgentCore
 * This wraps the generated agent to expose the required /invocations and /ping endpoints
 */
function generateAgentCoreServer(agentName: string, className: string): string {
  return `"""
AgentCore FastAPI Server Wrapper
This file wraps your Strands agent to expose the required AgentCore endpoints.

Required Endpoints:
- /invocations (POST) - Main agent interaction endpoint
- /ping (GET) - Health check endpoint

Port: 8080
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import logging
import os

# AWS and OpenTelemetry imports for observability
import boto3
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

# Import the generated agent
from agent import ${className}

# Configure logging with CloudWatch format
logging.basicConfig(
    level=os.getenv('LOG_LEVEL', 'INFO'),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    force=True
)
logger = logging.getLogger(__name__)

# Initialize OpenTelemetry tracing for AWS X-Ray
# If AWS_LAMBDA_FUNCTION_NAME is set, ADOT is already configured
if not os.getenv('AWS_LAMBDA_FUNCTION_NAME'):
    try:
        trace_provider = TracerProvider()
        # Use OTLP exporter for AWS X-Ray (ADOT collector)
        otlp_exporter = OTLPSpanExporter(
            endpoint=os.getenv('OTEL_EXPORTER_OTLP_ENDPOINT', 'localhost:4317'),
            insecure=True
        )
        trace_provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
        trace.set_tracer_provider(trace_provider)
        logger.info('OpenTelemetry tracing configured for AWS X-Ray')
    except Exception as e:
        logger.warning(f'Failed to configure OpenTelemetry: {e}. Continuing without tracing.')

tracer = trace.get_tracer(__name__)

# Optional: Initialize LangSmith if API key is provided (via environment variable)
langsmith_enabled = False
if os.getenv('LANGSMITH_API_KEY'):
    try:
        from langsmith import Client as LangSmithClient
        langsmith_client = LangSmithClient()
        langsmith_enabled = True
        logger.info('LangSmith monitoring enabled via environment variable')
    except ImportError:
        logger.warning('langsmith package not installed. Install with: pip install langsmith')
    except Exception as e:
        logger.warning(f'Failed to initialize LangSmith: {e}')
else:
    logger.info('LangSmith monitoring disabled (set LANGSMITH_API_KEY to enable)')

# Create FastAPI app
app = FastAPI(
    title="${agentName} AgentCore Runtime",
    description="Strands Agent deployed on AWS Bedrock AgentCore",
    version="1.0.0"
)

# Initialize the agent
logger.info("Initializing ${className}...")
try:
    agent = ${className}()
    logger.info("${className} initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize agent: {e}")
    raise


# Request/Response models
class InvocationRequest(BaseModel):
    """
    AgentCore invocation request format.
    The input field contains the user's prompt and any additional context.
    """
    input: Dict[str, Any]


class InvocationResponse(BaseModel):
    """
    AgentCore invocation response format.
    The output field contains the agent's response and metadata.
    """
    output: Dict[str, Any]


@app.post("/invocations", response_model=InvocationResponse)
async def invoke_agent(request: InvocationRequest):
    """
    Main agent invocation endpoint (REQUIRED by AgentCore).
    
    Processes user prompts through the Strands agent and returns responses.
    """
    # Start OpenTelemetry span for tracing
    with tracer.start_as_current_span("agent_invocation") as span:
        try:
            # Extract prompt from input
            user_message = request.input.get("prompt", "")
            if not user_message:
                raise HTTPException(
                    status_code=400,
                    detail="No prompt found in input. Please provide a 'prompt' key in the input."
                )
            
            # Add span attributes for tracing
            span.set_attribute("agent.name", "${agentName}")
            span.set_attribute("agent.model", "${className}")
            span.set_attribute("message.length", len(user_message))
            
            logger.info(f"Processing message: {user_message[:100]}...")
            
            # Process with Strands agent
            result = await agent.run(user_message, context=request.input.get("context", {}))
            
            # Format response for AgentCore
            response = {
                "message": result,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "model": "${className}",
                "agent_name": "${agentName}"
            }
            
            span.set_attribute("response.length", len(str(result)))
            span.set_attribute("status", "success")
            
            logger.info("Message processed successfully")
            return InvocationResponse(output=response)
        
        except HTTPException:
            span.set_attribute("status", "error")
            span.set_attribute("error.type", "validation_error")
            raise
        except Exception as e:
            span.set_attribute("status", "error")
            span.set_attribute("error.type", type(e).__name__)
            span.set_attribute("error.message", str(e))
            logger.error(f"Agent processing failed: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Agent processing failed: {str(e)}"
            )


@app.get("/ping")
async def ping():
    """
    Health check endpoint (REQUIRED by AgentCore).
    
    Returns the health status of the agent service.
    """
    return {
        "status": "healthy",
        "agent": "${agentName}",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/")
async def root():
    """
    Root endpoint with service information.
    """
    return {
        "service": "${agentName} AgentCore Runtime",
        "version": "1.0.0",
        "endpoints": {
            "invocations": "/invocations (POST)",
            "health": "/ping (GET)"
        },
        "status": "running"
    }


if __name__ == "__main__":
    import uvicorn
    
    # Run on port 8080 as required by AgentCore
    port = int(os.getenv("PORT", "8080"))
    logger.info(f"Starting AgentCore server on port {port}")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )
`;
}

/**
 * Generate ARM64 Dockerfile for AgentCore
 * CRITICAL: Must use linux/arm64 platform
 */
function generateAgentCoreDockerfile(): string {
  return `# AgentCore Dockerfile - ARM64 Platform Required
# This Dockerfile builds a container compatible with AWS Bedrock AgentCore

# CRITICAL: Must use ARM64 platform for AgentCore
FROM --platform=linux/arm64 ghcr.io/astral-sh/uv:python3.11-bookworm-slim

# Set working directory
WORKDIR /app

# Copy uv dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies using uv (faster than pip)
# --frozen ensures reproducible builds
# --no-cache reduces image size
RUN uv sync --frozen --no-cache

# Copy agent files
COPY agent.py ./
COPY agentcore_server.py ./

# Copy custom tools if they exist
COPY tools/ ./tools/ 2>/dev/null || true

# Expose port 8080 (AgentCore standard)
EXPOSE 8080

# Set environment variables
ENV PORT=8080
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:8080/ping || exit 1

# Run the AgentCore server using uv
CMD ["uv", "run", "uvicorn", "agentcore_server:app", "--host", "0.0.0.0", "--port", "8080"]
`;
}

/**
 * Generate pyproject.toml for uv dependency management
 */
function generatePyProjectToml(agentName: string, tools: any[]): string {
  const dependencies = [
    'fastapi>=0.104.0',
    'uvicorn[standard]>=0.24.0',
    'pydantic>=2.5.0',
    'httpx>=0.25.0',
    'strandsagents>=1.0.0',
    'strands-agents-tools>=1.0.0',
    'opentelemetry-api>=1.0.0',
    'opentelemetry-sdk>=1.0.0',
    'aws-opentelemetry-distro>=0.3.0',
    'boto3>=1.28.0',
    'botocore>=1.31.0',
  ];

  // Add tool-specific dependencies
  const toolExtras = new Set<string>();
  tools.forEach(tool => {
    if (tool.extrasPip) {
      toolExtras.add(tool.extrasPip);
    }
  });

  if (toolExtras.size > 0) {
    dependencies.push(
      ...Array.from(toolExtras).map(extra => `strands-agents-tools[${extra}]`)
    );
  }

  return `[project]
name = "${agentName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}"
version = "1.0.0"
description = "Strands Agent deployed on AWS Bedrock AgentCore"
requires-python = ">=3.11"
dependencies = [
${dependencies.map(dep => `    "${dep}",`).join('\n')}
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.uv]
dev-dependencies = []
`;
}

/**
 * Generate deployment script for AgentCore
 */
function generateDeployToAgentCore(agentName: string): string {
  const sanitizedName = agentName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  
  return `"""
Deploy Agent to AWS Bedrock AgentCore

This script handles the complete deployment process:
1. Build ARM64 Docker image
2. Push to Amazon ECR
3. Create AgentCore Runtime
4. Display runtime information

Prerequisites:
- AWS CLI configured with appropriate credentials
- Docker with buildx support
- IAM role with AgentCore permissions
"""

import boto3
import sys
import os
from datetime import datetime

# Configuration
AGENT_NAME = "${agentName}"
REPOSITORY_NAME = "${sanitizedName}"
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
AWS_ACCOUNT_ID = boto3.client('sts').get_caller_identity()['Account']


def create_ecr_repository():
    """Create ECR repository if it doesn't exist."""
    ecr_client = boto3.client('ecr', region_name=AWS_REGION)
    
    try:
        print(f"Creating ECR repository: {REPOSITORY_NAME}")
        response = ecr_client.create_repository(
            repositoryName=REPOSITORY_NAME,
            imageScanningConfiguration={'scanOnPush': True},
            encryptionConfiguration={'encryptionType': 'AES256'}
        )
        print(f"✓ Repository created: {response['repository']['repositoryUri']}")
        return response['repository']['repositoryUri']
    except ecr_client.exceptions.RepositoryAlreadyExistsException:
        print(f"✓ Repository already exists: {REPOSITORY_NAME}")
        response = ecr_client.describe_repositories(repositoryNames=[REPOSITORY_NAME])
        return response['repositories'][0]['repositoryUri']


def build_and_push_image(repository_uri):
    """Build ARM64 image and push to ECR."""
    import subprocess
    
    print("\\nBuilding ARM64 Docker image...")
    print("⚠️  This may take several minutes on first build")
    
    # Login to ECR
    print("\\nLogging into ECR...")
    login_cmd = f"aws ecr get-login-password --region {AWS_REGION} | docker login --username AWS --password-stdin {repository_uri.split('/')[0]}"
    subprocess.run(login_cmd, shell=True, check=True)
    
    # Build for ARM64 (required by AgentCore)
    print("\\nBuilding ARM64 image...")
    build_cmd = f"docker buildx build --platform linux/arm64 -t {repository_uri}:latest --push ."
    subprocess.run(build_cmd, shell=True, check=True)
    
    print(f"\\n✓ Image built and pushed: {repository_uri}:latest")
    return f"{repository_uri}:latest"


def create_agent_runtime(container_uri):
    """Create AgentCore Runtime."""
    client = boto3.client('bedrock-agentcore-control', region_name=AWS_REGION)
    
    # Get or create IAM role
    role_arn = os.getenv('AGENTCORE_ROLE_ARN')
    if not role_arn:
        print("\\n⚠️  AGENTCORE_ROLE_ARN not set. Please provide IAM role ARN:")
        print("   export AGENTCORE_ROLE_ARN=arn:aws:iam::ACCOUNT:role/AgentCoreRole")
        sys.exit(1)
    
    print(f"\\nCreating AgentCore Runtime: {AGENT_NAME}")
    
    try:
        response = client.create_agent_runtime(
            agentRuntimeName=AGENT_NAME,
            agentRuntimeArtifact={
                'containerConfiguration': {
                    'containerUri': container_uri
                }
            },
            networkConfiguration={"networkMode": "PUBLIC"},
            roleArn=role_arn
        )
        
        runtime_arn = response['agentRuntimeArn']
        status = response['status']
        
        print(f"\\n✓ Agent Runtime created successfully!")
        print(f"  ARN: {runtime_arn}")
        print(f"  Status: {status}")
        print(f"  Region: {AWS_REGION}")
        
        # Save runtime info
        with open('.agentcore_deployment.txt', 'w') as f:
            f.write(f"Agent Name: {AGENT_NAME}\\n")
            f.write(f"Runtime ARN: {runtime_arn}\\n")
            f.write(f"Container URI: {container_uri}\\n")
            f.write(f"Region: {AWS_REGION}\\n")
            f.write(f"Deployed: {datetime.now().isoformat()}\\n")
        
        print(f"\\n✓ Deployment info saved to .agentcore_deployment.txt")
        return runtime_arn
        
    except Exception as e:
        print(f"\\n✗ Failed to create AgentCore Runtime: {e}")
        sys.exit(1)


def main():
    print("=" * 60)
    print(f"AgentCore Deployment: {AGENT_NAME}")
    print("=" * 60)
    print(f"Region: {AWS_REGION}")
    print(f"Account: {AWS_ACCOUNT_ID}")
    print()
    
    try:
        # Step 1: Create ECR repository
        repository_uri = create_ecr_repository()
        
        # Step 2: Build and push image
        container_uri = build_and_push_image(repository_uri)
        
        # Step 3: Create AgentCore Runtime
        runtime_arn = create_agent_runtime(container_uri)
        
        print("\\n" + "=" * 60)
        print("Deployment Complete! 🎉")
        print("=" * 60)
        print(f"\\nNext steps:")
        print(f"1. Test your agent using invoke_agent.py")
        print(f"2. Monitor in CloudWatch: https://console.aws.amazon.com/cloudwatch")
        print(f"3. View traces in X-Ray")
        
    except KeyboardInterrupt:
        print("\\n\\nDeployment cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\\n✗ Deployment failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
`;
}

/**
 * Generate invocation script for testing
 */
function generateInvokeAgent(agentName: string): string {
  return `"""
Invoke Agent on AWS Bedrock AgentCore

This script demonstrates how to invoke your deployed agent.

Usage:
    python invoke_agent.py "Your prompt here"
    
Or run interactively:
    python invoke_agent.py
"""

import boto3
import json
import sys
import os
import uuid
from datetime import datetime

# Configuration
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")


def generate_session_id():
    """Generate a valid session ID (must be 33+ characters)."""
    return str(uuid.uuid4()) + str(uuid.uuid4()).replace('-', '')[:10]


def load_deployment_info():
    """Load deployment info from file."""
    try:
        with open('.agentcore_deployment.txt', 'r') as f:
            info = {}
            for line in f:
                if ':' in line:
                    key, value = line.strip().split(':', 1)
                    info[key.strip()] = value.strip()
            return info
    except FileNotFoundError:
        print("✗ Deployment info not found. Please run deploy_to_agentcore.py first.")
        sys.exit(1)


def invoke_agent(runtime_arn, prompt, session_id=None):
    """Invoke the agent with a prompt."""
    client = boto3.client('bedrock-agentcore', region_name=AWS_REGION)
    
    # Generate session ID if not provided
    if not session_id:
        session_id = generate_session_id()
    
    # Prepare payload
    payload = json.dumps({
        "input": {
            "prompt": prompt
        }
    }).encode()
    
    print(f"\\nInvoking agent...")
    print(f"Session ID: {session_id}")
    print(f"Prompt: {prompt}\\n")
    
    try:
        # Invoke agent
        response = client.invoke_agent_runtime(
            agentRuntimeArn=runtime_arn,
            runtimeSessionId=session_id,
            payload=payload,
            qualifier="DEFAULT"
        )
        
        # Parse response
        response_body = response['response'].read()
        response_data = json.loads(response_body)
        
        print("=" * 60)
        print("Agent Response:")
        print("=" * 60)
        
        if 'output' in response_data:
            output = response_data['output']
            
            # Display message
            if 'message' in output:
                print(f"\\n{output['message']}\\n")
            
            # Display metadata
            if 'timestamp' in output:
                print(f"Timestamp: {output['timestamp']}")
            if 'model' in output:
                print(f"Model: {output['model']}")
        else:
            print(json.dumps(response_data, indent=2))
        
        print("\\n" + "=" * 60)
        return response_data
        
    except Exception as e:
        print(f"✗ Invocation failed: {e}")
        sys.exit(1)


def interactive_mode(runtime_arn):
    """Run in interactive mode."""
    print("=" * 60)
    print("Interactive Mode - Type 'exit' to quit")
    print("=" * 60)
    
    session_id = generate_session_id()
    print(f"Session ID: {session_id}\\n")
    
    while True:
        try:
            prompt = input("You: ").strip()
            
            if not prompt:
                continue
            
            if prompt.lower() in ['exit', 'quit', 'q']:
                print("Goodbye!")
                break
            
            invoke_agent(runtime_arn, prompt, session_id)
            print()
            
        except KeyboardInterrupt:
            print("\\n\\nGoodbye!")
            break
        except Exception as e:
            print(f"\\nError: {e}\\n")


def main():
    # Load deployment info
    deployment_info = load_deployment_info()
    runtime_arn = deployment_info.get('Runtime ARN')
    
    if not runtime_arn:
        print("✗ Runtime ARN not found in deployment info")
        sys.exit(1)
    
    print("=" * 60)
    print(f"AgentCore Invocation: {deployment_info.get('Agent Name', 'Unknown')}")
    print("=" * 60)
    print(f"Runtime ARN: {runtime_arn}")
    print(f"Region: {AWS_REGION}")
    print()
    
    # Check if prompt provided as argument
    if len(sys.argv) > 1:
        prompt = ' '.join(sys.argv[1:])
        invoke_agent(runtime_arn, prompt)
    else:
        interactive_mode(runtime_arn)


if __name__ == "__main__":
    main()
`;
}

/**
 * Generate README for AgentCore deployment
 */
function generateAgentCoreReadme(agentName: string): string {
  return `# ${agentName} - AgentCore Deployment

This agent is configured for deployment to **AWS Bedrock AgentCore**.

## What is AgentCore?

AWS Bedrock AgentCore is a fully managed service for deploying and running AI agents at scale. It provides:

- **Managed Infrastructure**: No servers to manage
- **Auto-scaling**: Scales automatically with demand
- **Built-in Monitoring**: CloudWatch integration out of the box
- **Security**: IAM-based access control
- **ARM64 Optimized**: Cost-effective and performant

## Prerequisites

### Required Tools
- **AWS CLI**: Configured with appropriate credentials
- **Docker**: With buildx support for multi-platform builds
- **Python 3.11+**: For deployment scripts
- **uv**: Fast Python package installer (optional but recommended)

### AWS Permissions
Your IAM user/role needs:
- \`ecr:*\` - For creating and managing ECR repositories
- \`bedrock-agentcore:*\` - For creating and invoking agent runtimes
- \`iam:PassRole\` - For passing the runtime role to AgentCore

### IAM Role for AgentCore
Create an IAM role with:
- Trust policy allowing \`bedrock-agentcore.amazonaws.com\`
- Permissions for Bedrock model access
- CloudWatch Logs access

Example trust policy:
\`\`\`json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Service": "bedrock-agentcore.amazonaws.com"
    },
    "Action": "sts:AssumeRole"
  }]
}
\`\`\`

## Quick Start

### 1. Set Environment Variables

\`\`\`bash
# Required
export AWS_REGION=us-east-1
export AGENTCORE_ROLE_ARN=arn:aws:iam::YOUR_ACCOUNT:role/AgentCoreRole

# Optional - Only if you want LangSmith monitoring
# export LANGSMITH_API_KEY=your_api_key_here

# Optional - For custom log levels
# export LOG_LEVEL=DEBUG
\`\`\`

### 2. Install uv (Recommended)

\`\`\`bash
curl -LsSf https://astral.sh/uv/install.sh | sh
\`\`\`

### 3. Initialize Project

\`\`\`bash
uv init --python 3.11
uv add -r requirements.txt
\`\`\`

### 4. Deploy to AgentCore

\`\`\`bash
uv run python deploy_to_agentcore.py
\`\`\`

This will:
1. Create an ECR repository
2. Build an ARM64 Docker image
3. Push to ECR
4. Create an AgentCore Runtime
5. Save deployment information

### 5. Invoke Your Agent

\`\`\`bash
# Single prompt
uv run python invoke_agent.py "What is artificial intelligence?"

# Interactive mode
uv run python invoke_agent.py
\`\`\`

## Files Generated

- \`agentcore_server.py\` - FastAPI server wrapping your agent
- \`Dockerfile\` - ARM64 container configuration
- \`pyproject.toml\` - Dependency management
- \`deploy_to_agentcore.py\` - Deployment script
- \`invoke_agent.py\` - Invocation script
- \`.agentcore_deployment.txt\` - Deployment information (generated after deploy)

## Architecture

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                     AWS Bedrock AgentCore                    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ARM64 Container (from ECR)                          │  │
│  │                                                       │  │
│  │  ┌──────────────────────────────────────────────┐   │  │
│  │  │  FastAPI Server (port 8080)                  │   │  │
│  │  │                                               │   │  │
│  │  │  Endpoints:                                   │   │  │
│  │  │  - POST /invocations → Strands Agent         │   │  │
│  │  │  - GET  /ping → Health Check                 │   │  │
│  │  └──────────────────────────────────────────────┘   │  │
│  │                                                       │  │
│  │  ┌──────────────────────────────────────────────┐   │  │
│  │  │  ${agentName}                                │   │  │
│  │  │  - strandsagents.Agent                       │   │  │
│  │  │  - Tools: [...]                              │   │  │
│  │  │  - Model: [your selected model]              │   │  │
│  │  └──────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
│  Monitoring:                                                  │
│  - CloudWatch Logs                                           │
│  - X-Ray Traces                                              │
│  - CloudWatch Metrics                                        │
└─────────────────────────────────────────────────────────────┘
\`\`\`

## Local Testing

Before deploying to AgentCore, test locally:

\`\`\`bash
# Build ARM64 image locally
docker buildx build --platform linux/arm64 -t ${agentName.toLowerCase()}:arm64 --load .

# Run container
docker run --platform linux/arm64 -p 8080:8080 \\
  -e AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \\
  -e AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \\
  -e AWS_SESSION_TOKEN="$AWS_SESSION_TOKEN" \\
  -e AWS_REGION="$AWS_REGION" \\
  ${agentName.toLowerCase()}:arm64

# Test endpoints
curl http://localhost:8080/ping
curl -X POST http://localhost:8080/invocations \\
  -H "Content-Type: application/json" \\
  -d '{"input": {"prompt": "Hello!"}}'
\`\`\`

## Observability

### Built-in AWS Observability

This agent automatically integrates with AWS native observability services:

#### CloudWatch Logs
All agent logs are automatically sent to CloudWatch:
\`\`\`bash
# View logs in real-time
aws logs tail /aws/bedrock-agentcore/runtimes/${agentName} --follow

# Search logs
aws logs filter-log-events \\
  --log-group-name /aws/bedrock-agentcore/runtimes/${agentName} \\
  --filter-pattern "ERROR"
\`\`\`

#### AWS X-Ray Tracing
OpenTelemetry spans are exported to AWS X-Ray for distributed tracing:
- View traces in X-Ray Console
- Analyze latency and bottlenecks
- Track requests across services

#### CloudWatch Metrics
AgentCore publishes standard metrics:
- Request count
- Latency (p50, p99)
- Error rate
- Throttling events

### Optional: LangSmith Monitoring

If you want additional monitoring with LangSmith:

1. **Install langsmith package**:
   \`\`\`bash
   pip install langsmith
   \`\`\`

2. **Set API key securely**:
   \`\`\`bash
   # Store in AWS Secrets Manager
   aws secretsmanager create-secret \\
     --name /agentcore/${agentName}/langsmith-key \\
     --secret-string "your-api-key"
   
   # Or use environment variable (less secure)
   export LANGSMITH_API_KEY=your-api-key
   \`\`\`

3. **Update IAM role** to allow access to Secrets Manager if using that approach

### Enable Advanced Observability

1. **AWS ADOT (OpenTelemetry Distro)**:
   Already included: \`aws-opentelemetry-distro>=0.3.0\`

2. **Enable CloudWatch Transaction Search**:
   - Open CloudWatch Console
   - Navigate to Application Signals > Transaction search
   - Enable Transaction Search

3. **View Traces**:
   - CloudWatch Console > X-Ray Service Map
   - Select your agent service
   - View traces, metrics, and logs

## Troubleshooting

### Build Fails
- Ensure Docker buildx is installed: \`docker buildx version\`
- Check Docker daemon is running
- Verify you're on a machine that supports ARM64 emulation

### Deployment Fails
- Verify AWS credentials: \`aws sts get-caller-identity\`
- Check IAM role ARN is correct
- Ensure ECR permissions are set

### Invocation Fails
- Check CloudWatch logs for errors
- Verify agent runtime is in ACTIVE state
- Ensure session ID is 33+ characters

### Container Issues
- View container logs in CloudWatch
- Test locally first before deploying
- Check health endpoint: \`/ping\`

## Cost Optimization

- **Use appropriate instance sizes**: AgentCore auto-scales based on load
- **Monitor CloudWatch metrics**: Track invocation counts and duration
- **Consider reserved capacity**: For predictable workloads
- **Use ARM64**: Generally 20-30% cheaper than x86_64

## Best Practices

1. **Always test locally first** using Docker
2. **Use session IDs consistently** for conversation tracking
3. **Monitor CloudWatch regularly** for errors and performance
4. **Keep dependencies updated** for security patches
5. **Use environment variables** for configuration
6. **Enable observability** from day one

## Security Best Practices

### API Keys and Secrets

1. **Never hardcode API keys** in your code
2. **Use AWS Secrets Manager** for sensitive credentials:
   \`\`\`bash
   aws secretsmanager create-secret \\
     --name /agentcore/${agentName}/api-keys \\
     --secret-string '{"langsmith":"key123","other":"key456"}'
   \`\`\`

3. **Use IAM roles** instead of access keys when possible
4. **Rotate secrets** regularly
5. **Enable CloudTrail** to audit secret access

### Environment Variables

Secure environment variables in AgentCore:
- Store secrets in AWS Secrets Manager
- Reference secrets in runtime configuration
- Use IAM policies to restrict access

## Additional Resources

- [AWS Bedrock AgentCore Documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/agentcore.html)
- [Strands Agents Documentation](https://docs.strandsagents.com)
- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [uv Documentation](https://docs.astral.sh/uv/)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)
- [AWS X-Ray Tracing](https://docs.aws.amazon.com/xray/)

## Support

For issues or questions:
- Check CloudWatch Logs first
- Review this README
- Consult AWS Bedrock documentation
- Check Strands Agents documentation
`;
}

/**
 * Export action to generate all AgentCore deployment files
 */
export const generateAgentCoreFiles = action({
  args: {
    agentId: v.string(),
    name: v.string(),
    className: v.string(),
    tools: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const { name, className, tools } = args;
    
    return {
      agentcoreServer: generateAgentCoreServer(name, className),
      dockerfile: generateAgentCoreDockerfile(),
      pyprojectToml: generatePyProjectToml(name, tools),
      deployScript: generateDeployToAgentCore(name),
      invokeScript: generateInvokeAgent(name),
      readme: generateAgentCoreReadme(name),
    };
  },
});
