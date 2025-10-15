# deployment_agent.py
from strands import Agent
from strands.models import BedrockModel
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from unified_auth import UnifiedAuthHandler
import json

app = BedrockAgentCoreApp()
auth_handler = UnifiedAuthHandler()

model = BedrockModel(model_id="anthropic.claude-3-5-sonnet-20241022-v2:0")
agent = Agent(
    model=model,
    system_prompt="""You are an AI agent deployment assistant. You help users:
    1. Test agents in the sandbox
    2. Choose deployment options (their AWS account or managed environment)
    3. Handle authentication and deployment
    """
)

@app.entrypoint
def deployment_agent_handler(payload):
    user_input = payload.get("prompt", "")
    session_id = payload.get("session_id", "default")
    action = payload.get("action")
    
    # Handle specific deployment actions
    if action == "deploy":
        return handle_deployment_request(session_id, payload.get("deployment_type"))
    
    elif action == "auth_callback":
        return handle_auth_callback(session_id, payload)
    
    elif action == "execute_deployment":
        return execute_deployment(session_id, payload.get("agent_config"))
    
    # Regular agent conversation
    response = agent(user_input)
    
    # Check if user wants to deploy
    if any(keyword in user_input.lower() for keyword in ["deploy", "production", "my account"]):
        deployment_options = auth_handler.handle_deployment_request(session_id)
        return {
            "message": response.message['content'][0]['text'],
            "deployment_options": deployment_options
        }
    
    return {"message": response.message['content'][0]['text']}

def handle_deployment_request(session_id, deployment_type):
    """Handle user choosing deployment option"""
    return auth_handler.handle_deployment_request(session_id, deployment_type)

def handle_auth_callback(session_id, payload):
    """Handle authentication callback"""
    auth_code = payload.get("code")
    auth_type = payload.get("type")
    
    result = auth_handler.complete_authentication(session_id, auth_code, auth_type)
    
    if "error" not in result:
        return {
            "message": "Authentication successful! Ready to deploy your agent.",
            "authenticated": True,
            "next_step": "provide_agent_config"
        }
    else:
        return result

def execute_deployment(session_id, agent_config):
    """Execute the actual deployment"""
    return auth_handler.deploy_to_user_account(session_id, agent_config)
