# aws_auth_handler.py
import boto3
from botocore.exceptions import ClientError

class AWSAuthHandler:
    def __init__(self):
        self.sso_client = boto3.client('sso-oidc')
        self.identity_client = boto3.client('identitystore')
    
    def initiate_aws_sso_login(self, session_id):
        """Start AWS SSO login flow"""
        try:
            # Register client for SSO
            client_response = self.sso_client.register_client(
                clientName='AgentCore-Deployer',
                clientType='public'
            )
            
            client_id = client_response['clientId']
            client_secret = client_response['clientSecret']
            
            # Start device authorization
            device_response = self.sso_client.start_device_authorization(
                clientId=client_id,
                clientSecret=client_secret,
                startUrl='https://your-sso-portal.awsapps.com/start'  # Your SSO URL
            )
            
            return {
                "auth_type": "aws_sso",
                "device_code": device_response['deviceCode'],
                "user_code": device_response['userCode'],
                "verification_uri": device_response['verificationUri'],
                "expires_in": device_response['expiresIn'],
                "message": f"Go to {device_response['verificationUri']} and enter code: {device_response['userCode']}"
            }
            
        except ClientError as e:
            return {"error": f"AWS SSO setup failed: {str(e)}"}
    
    def poll_for_aws_token(self, client_id, client_secret, device_code):
        """Poll for AWS SSO token completion"""
        try:
            token_response = self.sso_client.create_token(
                clientId=client_id,
                clientSecret=client_secret,
                grantType='urn:ietf:params:oauth:grant-type:device_code',
                deviceCode=device_code
            )
            
            return {
                "access_token": token_response['accessToken'],
                "token_type": token_response['tokenType'],
                "expires_in": token_response['expiresIn']
            }
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'AuthorizationPendingException':
                return {"status": "pending"}
            else:
                return {"error": str(e)}
