# platform_handler.py
from agent_builder_platform import AgentBuilderPlatform
from bedrock_agentcore.runtime import BedrockAgentCoreApp

app = BedrockAgentCoreApp()
platform = AgentBuilderPlatform()

@app.entrypoint
def platform_handler(payload):
    action = payload.get("action")
    
    if action == "create_agent":
        # User creates agent configuration
        agent_config = platform.create_agent_config(payload["agent_config"])
        return {
            "message": "Agent configuration created successfully!",
            "agent_config": agent_config,
            "next_steps": ["test_agent", "deploy_agent"]
        }
    
    elif action == "test_agent":
        # Test agent in appropriate environment
        agent_config = payload["agent_config"]
        test_prompt = payload["test_prompt"]
        
        result = platform.test_agent(agent_config, test_prompt)
        
        if result.get("success"):
            return {
                "message": "Agent test completed successfully!",
                "test_result": result,
                "ready_for_deployment": True
            }
        else:
            return {
                "message": "Agent test failed. Please check configuration.",
                "error": result.get("error"),
                "suggestions": "Check your model configuration and system prompt."
            }
    
    elif action == "deploy_agent":
        # Handle deployment request
        agent_config = payload["agent_config"]
        
        # Start authentication flow
        auth_result = platform.auth_handler.handle_deployment_request(
            payload["session_id"], 
            payload.get("deployment_type")
        )
        
        return {
            "message": "Ready to deploy your agent!",
            "authentication": auth_result
        }
    
    elif action == "execute_deployment":
        # Execute actual deployment after authentication
        agent_config = payload["agent_config"]
        deployment_target = payload["deployment_target"]
        
        result = platform.deploy_to_production(agent_config, deployment_target)
        return result
    
    else:
        return {"error": "Unknown action"}

if __name__ == "__main__":
    app.run()
