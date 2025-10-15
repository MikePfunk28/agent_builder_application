# unified_auth.py
from aws_auth_handler import AWSAuthHandler
from cognito_auth_handler import CognitoAuthHandler
import json

class UnifiedAuthHandler:
    def __init__(self):
        self.aws_handler = AWSAuthHandler()
        self.cognito_handler = CognitoAuthHandler()
        self.user_sessions = {}  # In production, use Redis/DynamoDB
    
    def handle_deployment_request(self, session_id, user_preference=None):
        """Handle user wanting to deploy after testing"""
        
        if user_preference == "aws_account":
            # User has AWS account
            return self.aws_handler.initiate_aws_sso_login(session_id)
            
        elif user_preference == "managed":
            # User wants managed deployment (Cognito)
            return self.cognito_handler.initiate_cognito_login(session_id)
            
        else:
            # Ask user to choose
            return {
                "message": "Choose your deployment option:",
                "options": [
                    {
                        "type": "aws_account",
                        "title": "Deploy to My AWS Account",
                        "description": "I have an AWS account and want to deploy there",
                        "action": "aws_sso_login"
                    },
                    {
                        "type": "managed",
                        "title": "Use Managed Deployment", 
                        "description": "Deploy to a managed AWS environment",
                        "action": "cognito_login"
                    }
                ]
            }
    
    def complete_authentication(self, session_id, auth_code, auth_type):
        """Complete the authentication flow"""
        
        if auth_type == "aws_sso":
            # Handle AWS SSO completion
            return self.complete_aws_sso(session_id, auth_code)
            
        elif auth_type == "cognito":
            # Handle Cognito completion
            return self.complete_cognito(session_id, auth_code)
    
    def deploy_to_user_account(self, session_id, agent_config):
        """Deploy agent to authenticated user's account"""
        
        user_auth = self.user_sessions.get(session_id)
        if not user_auth:
            return {"error": "User not authenticated"}
        
        if user_auth["type"] == "aws_sso":
            return self.deploy_to_aws_account(user_auth, agent_config)
        elif user_auth["type"] == "cognito":
            return self.deploy_to_managed_environment(user_auth, agent_config)
