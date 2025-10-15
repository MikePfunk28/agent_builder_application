# agent_builder_platform.py
import docker
import subprocess
import json
import os
from strands import Agent
from strands.models import BedrockModel, OllamaModel
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from unified_auth import UnifiedAuthHandler

class AgentBuilderPlatform:
    def __init__(self):
        self.docker_client = docker.from_env()
        self.auth_handler = UnifiedAuthHandler()
        self.test_environments = {}
        
    def create_agent_config(self, user_config):
        """Create agent from user configuration"""
        agent_config = {
            "name": user_config["agent_name"],
            "system_prompt": user_config["system_prompt"],
            "tools": user_config.get("tools", []),
            "model_type": user_config["model_type"],  # "bedrock" or "ollama"
            "model_id": user_config["model_id"],
            "user_id": user_config["user_id"]
        }
        
        return agent_config
    
    def test_agent(self, agent_config, test_prompt):
        """Test agent in appropriate environment"""
        if agent_config["model_type"] == "ollama":
            return self.test_with_ollama_docker(agent_config, test_prompt)
        elif agent_config["model_type"] == "bedrock":
            return self.test_with_agentcore(agent_config, test_prompt)
        else:
            return {"error": "Unsupported model type"}
    
    def test_with_ollama_docker(self, agent_config, test_prompt):
        """Test agent using Ollama in Docker"""
        try:
            # Create agent code for Ollama
            agent_code = self.generate_ollama_agent_code(agent_config)
            
            # Create temporary directory for testing
            test_dir = f"/tmp/agent_test_{agent_config['user_id']}"
            os.makedirs(test_dir, exist_ok=True)
            
            # Write agent code
            with open(f"{test_dir}/test_agent.py", "w") as f:
                f.write(agent_code)
            
            # Create Dockerfile for Ollama testing
            dockerfile_content = self.generate_ollama_dockerfile(agent_config)
            with open(f"{test_dir}/Dockerfile", "w") as f:
                f.write(dockerfile_content)
            
            # Build and run Docker container
            image_name = f"agent-test-{agent_config['user_id']}"
            
            # Build image
            self.docker_client.images.build(
                path=test_dir,
                tag=image_name,
                rm=True
            )
            
            # Run container with test prompt
            container = self.docker_client.containers.run(
                image_name,
                command=f'python test_agent.py "{test_prompt}"',
                detach=True,
                remove=True,
                environment={
                    "OLLAMA_MODEL": agent_config["model_id"]
                }
            )
            
            # Wait for completion and get result
            result = container.wait()
            logs = container.logs().decode('utf-8')
            
            return {
                "success": True,
                "response": logs,
                "test_environment": "ollama_docker",
                "model": agent_config["model_id"]
            }
            
        except Exception as e:
            return {"error": f"Ollama testing failed: {str(e)}"}
    
    def test_with_agentcore(self, agent_config, test_prompt):
        """Test agent using AgentCore sandbox"""
        try:
            # Create agent code for AgentCore
            agent_code = self.generate_agentcore_agent_code(agent_config)
            
            # Create temporary directory
            test_dir = f"/tmp/agentcore_test_{agent_config['user_id']}"
            os.makedirs(test_dir, exist_ok=True)
            
            # Write agent files
            with open(f"{test_dir}/test_agent.py", "w") as f:
                f.write(agent_code)
            
            with open(f"{test_dir}/requirements.txt", "w") as f:
                f.write(self.generate_requirements())
            
            # Deploy to AgentCore for testing
            os.chdir(test_dir)
            
            # Configure AgentCore
            subprocess.run([
                "agentcore", "configure", 
                "--entrypoint", "test_agent.py",
                "--name", f"test-{agent_config['user_id']}-{agent_config['name']}"
            ], check=True)
            
            # Launch to AgentCore
            subprocess.run(["agentcore", "launch"], check=True)
            
            # Test the agent
            result = subprocess.run([
                "agentcore", "invoke", 
                "--prompt", test_prompt
            ], capture_output=True, text=True, check=True)
            
            return {
                "success": True,
                "response": result.stdout,
                "test_environment": "agentcore_sandbox",
                "model": agent_config["model_id"]
            }
            
        except subprocess.CalledProcessError as e:
            return {"error": f"AgentCore testing failed: {str(e)}"}
    
    def generate_ollama_agent_code(self, agent_config):
        """Generate agent code for Ollama testing"""
        return f'''
import sys
from strands import Agent, tool
from strands.models import OllamaModel

# Custom tools based on user config
{self.generate_tools_code(agent_config.get("tools", []))}

# Create Ollama model
model = OllamaModel(
    model_id="{agent_config["model_id"]}",
    base_url="http://localhost:11434"
)

# Create agent
agent = Agent(
    model=model,
    system_prompt="""{agent_config["system_prompt"]}""",
    tools={self.get_tools_list(agent_config.get("tools", []))}
)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        user_input = sys.argv[1]
        try:
            response = agent(user_input)
            print(response.message['content'][0]['text'])
        except Exception as e:
            print(f"Error: {{str(e)}}")
    else:
        print("No input provided")
'''
    
    def generate_agentcore_agent_code(self, agent_config):
        """Generate agent code for AgentCore testing"""
        return f'''
from strands import Agent, tool
from strands.models import BedrockModel
from bedrock_agentcore.runtime import BedrockAgentCoreApp

# Custom tools based on user config
{self.generate_tools_code(agent_config.get("tools", []))}

# Create Bedrock model
model = BedrockModel(model_id="{agent_config["model_id"]}")

# Create agent
agent = Agent(
    model=model,
    system_prompt="""{agent_config["system_prompt"]}""",
    tools={self.get_tools_list(agent_config.get("tools", []))}
)

# AgentCore Runtime wrapper
app = BedrockAgentCoreApp()

@app.entrypoint
def agent_handler(payload):
    try:
        user_input = payload.get("prompt", "")
        response = agent(user_input)
        return {{
            "message": response.message['content'][0]['text'],
            "agent_name": "{agent_config["name"]}",
            "model": "{agent_config["model_id"]}"
        }}
    except Exception as e:
        return {{"error": f"Agent error: {{str(e)}}"}}

if __name__ == "__main__":
    app.run()
'''
    
    def generate_ollama_dockerfile(self, agent_config):
        """Generate Dockerfile for Ollama testing"""
        return f'''
FROM python:3.11-slim

# Install Ollama
RUN apt-get update && apt-get install -y curl
RUN curl -fsSL https://ollama.ai/install.sh | sh

# Install Python dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Install Strands and dependencies
RUN pip install strands-agents strands-agents-tools

# Copy agent code
COPY test_agent.py .

# Start Ollama service and pull model
RUN ollama serve & sleep 5 && ollama pull {agent_config["model_id"]}

# Default command
CMD ["python", "test_agent.py"]
'''
    
    def deploy_to_production(self, agent_config, deployment_target):
        """Deploy tested agent to production"""
        if deployment_target["type"] == "aws_account":
            return self.deploy_to_user_aws_account(agent_config, deployment_target)
        elif deployment_target["type"] == "managed":
            return self.deploy_to_managed_agentcore(agent_config, deployment_target)
        else:
            return {"error": "Invalid deployment target"}
    
    def deploy_to_user_aws_account(self, agent_config, deployment_target):
        """Deploy to user's AWS account"""
        try:
            # Generate production agent code
            if agent_config["model_type"] == "bedrock":
                agent_code = self.generate_production_agentcore_code(agent_config)
            else:
                # For Ollama, deploy as containerized solution
                agent_code = self.generate_production_ollama_code(agent_config)
            
            # Create deployment package
            deployment_package = self.create_deployment_package(agent_config, agent_code)
            
            # Use user's AWS credentials to deploy
            user_session = self.create_user_aws_session(deployment_target["credentials"])
            
            # Deploy using AgentCore in their account
            agentcore_client = user_session.client('bedrock-agentcore-control')
            
            deployment = agentcore_client.create_agent_runtime(
                agentRuntimeName=f"{agent_config['name']}-production",
                agentRuntimeArtifact={
                    'containerConfiguration': {
                        'containerUri': deployment_package["container_uri"]
                    }
                },
                roleArn=deployment_package["execution_role_arn"],
                networkConfiguration={"networkMode": "PUBLIC"}
            )
            
            return {
                "success": True,
                "deployment_type": "user_aws_account",
                "agent_runtime_arn": deployment["agentRuntimeArn"],
                "endpoint": deployment.get("endpoint"),
                "message": f"Agent '{agent_config['name']}' deployed to your AWS account!"
            }
            
        except Exception as e:
            return {"error": f"Production deployment failed: {str(e)}"}
