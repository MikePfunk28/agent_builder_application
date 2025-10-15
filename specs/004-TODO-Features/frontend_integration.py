// agent-platform-ui.js
class AgentPlatformUI {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.currentAgent = null;
    }
    
    async createAgent(agentConfig) {
        const response = await this.callPlatform({
            action: 'create_agent',
            agent_config: agentConfig,
            session_id: this.sessionId
        });
        
        this.currentAgent = response.agent_config;
        this.showTestOptions();
        return response;
    }
    
    async testAgent(testPrompt) {
        if (!this.currentAgent) {
            throw new Error('No agent to test');
        }
        
        this.showTestingIndicator();
        
        const response = await this.callPlatform({
            action: 'test_agent',
            agent_config: this.currentAgent,
            test_prompt: testPrompt,
            session_id: this.sessionId
        });
        
        this.showTestResults(response);
        
        if (response.ready_for_deployment) {
            this.showDeploymentButton();
        }
        
        return response;
    }
    
    async deployAgent(deploymentType) {
        const response = await this.callPlatform({
            action: 'deploy_agent',
            agent_config: this.currentAgent,
            deployment_type: deploymentType,
            session_id: this.sessionId
        });
        
        this.handleAuthenticationFlow(response.authentication);
        return response;
    }
    
    showTestOptions() {
        const testSection = document.getElementById('test-section');
        testSection.innerHTML = `
            <div class="test-controls">
                <h3>Test Your Agent</h3>
                <p>Model: ${this.currentAgent.model_type} - ${this.currentAgent.model_id}</p>
                <p>Environment: ${this.currentAgent.model_type === 'ollama' ? 'Docker + Ollama' : 'AgentCore Sandbox'}</p>
                <textarea id="test-prompt" placeholder="Enter test message..."></textarea>
                <button onclick="this.testAgent(document.getElementById('test-prompt').value)">
                    Test Agent
                </button>
            </div>
        `;
    }
    
    showTestResults(result) {
        const resultsDiv = document.getElementById('test-results');
        resultsDiv.innerHTML = `
            <div class="test-results">
                <h4>Test Results</h4>
                <p><strong>Environment:</strong> ${result.test_result.test_environment}</p>
                <p><strong>Model:</strong> ${result.test_result.model}</p>
                <div class="response">
                    <strong>Agent Response:</strong>
                    <pre>${result.test_result.response}</pre>
                </div>
            </div>
        `;
    }
    
    showDeploymentButton() {
        const deploySection = document.getElementById('deploy-section');
        deploySection.innerHTML = `
            <div class="deployment-options">
                <h3>Deploy Your Agent</h3>
                <button onclick="this.deployAgent('aws_account')" class="deploy-btn aws">
                    Deploy to My AWS Account
                </button>
                <button onclick="this.deployAgent('managed')" class="deploy-btn managed">
                    Deploy to Managed Environment
                </button>
            </div>
        `;
    }
}
