cat > authenticated_agent.py << 'EOF'
import json
import jwt
from strands import Agent
from strands.models import BedrockModel
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from bedrock_agentcore.identity import IdentityClient

# Initialize AgentCore components
app = BedrockAgentCoreApp()
identity_client = IdentityClient()

# Create the agent
model = BedrockModel(model_id="anthropic.claude-3-5-sonnet-20241022-v2:0")
agent = Agent(
    model=model,
    system_prompt="""You are a helpful assistant that can authenticate users and access their information securely. 
    When a user needs authentication, guide them through the OAuth flow."""
)

@app.entrypoint
def agent_handler(payload):
    """Main agent handler with authentication support"""
    try:
        user_input = payload.get("prompt", "")
        session_id = payload.get("session_id", "default")
        
        # Check if this is an authentication request
        if "authenticate" in user_input.lower() or "login" in user_input.lower():
            return handle_authentication(session_id)
        
        # Check if user is already authenticated
        user_context = get_user_context(session_id)
        if user_context:
            # User is authenticated, include context in response
            enhanced_prompt = f"User context: {user_context}\n\nUser request: {user_input}"
            response = agent(enhanced_prompt)
            return {
                "message": response.message['content'][0]['text'],
                "authenticated": True,
                "user_info": user_context
            }
        else:
            # User not authenticated
            response = agent(user_input)
            return {
                "message": response.message['content'][0]['text'],
                "authenticated": False,
                "note": "For personalized responses, please authenticate first."
            }
            
    except Exception as e:
        return {
            "error": f"Agent error: {str(e)}",
            "message": "I encountered an error. Please try again."
        }

def handle_authentication(session_id):
    """Handle OAuth authentication flow"""
    try:
        # Load Cognito configuration
        with open('cognito_config.json', 'r') as f:
            config = json.load(f)
        
        # Create authorization URL
        auth_url = f"{config['domain']}/oauth2/authorize"
        params = {
            "client_id": config['client_id'],
            "response_type": "code",
            "scope": "openid email profile",
            "redirect_uri": "http://localhost:8080/callback",
            "state": session_id
        }
        
        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        full_auth_url = f"{auth_url}?{query_string}"
        
        return {
            "message": "Please visit the following URL to authenticate:",
            "auth_url": full_auth_url,
            "instructions": "After authentication, you'll be redirected back and can continue our conversation."
        }
        
    except Exception as e:
        return {
            "error": f"Authentication setup error: {str(e)}",
            "message": "Authentication is currently unavailable."
        }

def get_user_context(session_id):
    """Get authenticated user context"""
    try:
        # In a real implementation, you'd retrieve stored tokens
        # For demo purposes, return mock context if available
        return None  # Will be enhanced with real token handling
        
    except Exception as e:
        print(f"Error getting user context: {e}")
        return None

if __name__ == "__main__":
    app.run()
EOF
