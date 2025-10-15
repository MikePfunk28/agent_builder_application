# deployment_executor.py
import boto3
from botocore.exceptions import ClientError

class DeploymentExecutor:
    def deploy_to_aws_account(self, user_credentials, agent_config):
        """Deploy to user's AWS account using their credentials"""
        try:
            # Create session with user's credentials
            session = boto3.Session(
                aws_access_key_id=user_credentials['access_key'],
                aws_secret_access_key=user_credentials['secret_key'],
                aws_session_token=user_credentials.get('session_token'),
                region_name=user_credentials.get('region', 'us-east-1')
            )
            
            # Deploy using AgentCore in their account
            agentcore_client = session.client('bedrock-agentcore-control')
            
            deployment = agentcore_client.create_agent_runtime(
                agentRuntimeName=agent_config['name'],
                agentRuntimeArtifact={
                    'containerConfiguration': {
                        'containerUri': agent_config['container_uri']
                    }
                },
                roleArn=agent_config['execution_role_arn'],
                networkConfiguration={"networkMode": "PUBLIC"}
            )
            
            return {
                "success": True,
                "agent_runtime_arn": deployment['agentRuntimeArn'],
                "endpoint": deployment.get('endpoint'),
                "message": "Agent deployed successfully to your AWS account!"
            }
            
        except ClientError as e:
            return {"error": f"Deployment failed: {str(e)}"}
    
    def deploy_to_managed_environment(self, user_info, agent_config):
        """Deploy to managed environment for Cognito users"""
        try:
            # Deploy to your managed AgentCore account
            # but isolate by user/tenant
            
            tenant_id = user_info['user_id']
            agent_name = f"{tenant_id}-{agent_config['name']}"
            
            # Use your AgentCore credentials
            agentcore_client = boto3.client('bedrock-agentcore-control')
            
            deployment = agentcore_client.create_agent_runtime(
                agentRuntimeName=agent_name,
                agentRuntimeArtifact={
                    'containerConfiguration': {
                        'containerUri': agent_config['container_uri']
                    }
                },
                roleArn=self.get_managed_execution_role(),
                networkConfiguration={"networkMode": "PUBLIC"},
                tags=[
                    {'key': 'TenantId', 'value': tenant_id},
                    {'key': 'UserEmail', 'value': user_info['email']}
                ]
            )
            
            return {
                "success": True,
                "agent_runtime_arn": deployment['agentRuntimeArn'],
                "endpoint": f"https://your-api.com/agents/{tenant_id}/{agent_config['name']}",
                "message": "Agent deployed
