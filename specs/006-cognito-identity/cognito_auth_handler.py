# cognito_auth_handler.py
import boto3
import json
from botocore.exceptions import ClientError

class CognitoAuthHandler:
    def __init__(self):
        self.cognito_client = boto3.client('cognito-idp')
        
    def initiate_cognito_login(self, session_id):
        """Start Cognito login for users without AWS accounts"""
        try:
            with open('cognito_config.json', 'r') as f:
                config = json.load(f)
            
            auth_url = f"{config['domain']}/oauth2/authorize"
            params = {
                "client_id": config['client_id'],
                "response_type": "code",
                "scope": "openid email profile aws.cognito.signin.user.admin",
                "redirect_uri": "https://your-app.com/auth/callback",
                "state": session_id
            }
            
            query_string = "&".join([f"{k}={v}" for k, v in params.items()])
            full_auth_url = f"{auth_url}?{query_string}"
            
            return {
                "auth_type": "cognito",
                "auth_url": full_auth_url,
                "message": "Sign in with your email to deploy to a managed AWS environment"
            }
            
        except Exception as e:
            return {"error": f"Cognito setup failed: {str(e)}"}
