"""
Claude 4.5 Haiku Assistant - Internal AI Assistant
Serverless FastAPI application for agent building assistance
"""

import os
import logging
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import boto3
from botocore.config import Config
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(
    title="Agent Builder Assistant",
    description="Claude 4.5 Haiku powered assistant for agent development",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure based on your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# AWS Bedrock configuration
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
CLAUDE_HAIKU_MODEL = "anthropic.claude-haiku-4-5-20251001-v1:0"

bedrock_config = Config(
    region_name=AWS_REGION,
    retries={'max_attempts': 3, 'mode': 'adaptive'}
)

bedrock_runtime = boto3.client(
    'bedrock-runtime',
    config=bedrock_config
)


# Request/Response models
class Message(BaseModel):
    role: str
    content: str

class AssistantRequest(BaseModel):
    messages: List[Message]
    context: Optional[dict] = None
    temperature: Optional[float] = 0.3
    max_tokens: Optional[int] = 2048

class AssistantResponse(BaseModel):
    message: str
    suggestions: Optional[List[str]] = None
    code_snippet: Optional[str] = None

# System prompt for the assistant
SYSTEM_PROMPT = """You are an expert AI assistant helping developers build AI agents using the Strands Agents framework and AWS Bedrock AgentCore.

Your capabilities:
- Help write system prompts for agents
- Suggest tool configurations and integrations
- Provide code examples for agent implementation
- Guide users through AWS deployment
- Recommend best practices for cost optimization
- Troubleshoot errors and provide solutions
- Explain AgentCore features and capabilities

Guidelines:
- Be concise and actionable
- Provide code examples when relevant
- Consider cost implications in recommendations
- Focus on serverless and pay-per-use patterns
- Reference official documentation when needed

Current context: You're assisting with the Agent Builder Platform, which allows users to create, test, and deploy AI agents to AWS using AgentCore Runtime."""

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "model": CLAUDE_HAIKU_MODEL}

@app.post("/assistant/chat", response_model=AssistantResponse)
async def chat_with_assistant(request: AssistantRequest):
    """
    Chat with Claude 4.5 Haiku assistant
    Serverless - only costs when invoked
    """
    try:
        # Build messages for Claude
        messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]

        # Add context if provided
        if request.context:
            context_str = f"\n\nCurrent Context:\n{json.dumps(request.context, indent=2)}"
            if messages:
                messages[-1]["content"] += context_str

        # Prepare request body
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": request.max_tokens,
            "temperature": request.temperature,
            "system": SYSTEM_PROMPT,
            "messages": messages
        }

        # Invoke Bedrock model (serverless - pay per token)
        logger.info(f"Invoking {CLAUDE_HAIKU_MODEL}")
        response = bedrock_runtime.invoke_model(
            modelId=CLAUDE_HAIKU_MODEL,
            body=json.dumps(body)
        )

        # Parse response
        response_body = json.loads(response['body'].read())
        assistant_message = response_body['content'][0]['text']

        # Extract suggestions and code snippets if present
        suggestions = extract_suggestions(assistant_message)
        code_snippet = extract_code_snippet(assistant_message)

        return AssistantResponse(
            message=assistant_message,
            suggestions=suggestions,
            code_snippet=code_snippet
        )

    except Exception as e:
        logger.error(f"Error invoking assistant: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def extract_suggestions(text: str) -> Optional[List[str]]:
    """Extract bullet point suggestions from response"""
    suggestions = []
    lines = text.split('\n')
    for line in lines:
        line = line.strip()
        if line.startswith('- ') or line.startswith('* '):
            suggestions.append(line[2:])
    return suggestions if suggestions else None

def extract_code_snippet(text: str) -> Optional[str]:
    """Extract code blocks from response"""
    import re
    code_blocks = re.findall(r'```(?:\w+)?\n(.*?)```', text, re.DOTALL)
    return code_blocks[0] if code_blocks else None

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Agent Builder Assistant",
        "model": CLAUDE_HAIKU_MODEL,
        "status": "running",
        "cost_model": "pay-per-token",
        "pricing": {
            "input": "$1.00 per 1M tokens",
            "output": "$5.00 per 1M tokens"
        }
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
