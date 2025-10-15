// frontend-auth.js
class AgentDeploymentUI {
    constructor() {
        this.sessionId = this.generateSessionId();
    }
    
    async requestDeployment() {
        const response = await fetch('/agent/invoke', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                action: 'deploy',
                session_id: this.sessionId
            })
        });
        
        const result = await response.json();
        this.showDeploymentOptions(result.deployment_options);
    }
    
    showDeploymentOptions(options) {
        // Show AWS Account vs Managed Environment choice
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div class="deployment-modal">
                <h3>Choose Deployment Option</h3>
                <button onclick="this.chooseAWS()">Deploy to My AWS Account</button>
                <button onclick="this.chooseManagedEnvironment()">Use Managed Environment</button>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    async chooseAWS() {
        // Initiate AWS SSO flow
        const response = await this.invokeAgent({
            action: 'deploy',
            deployment_type: 'aws_account',
            session_id: this.sessionId
        });
        
        if (response.verification_uri) {
            // Show AWS SSO instructions
            window.open(response.verification_uri, '_blank');
            this.pollForAWSAuth(response);
        }
    }
    
    async chooseManagedEnvironment() {
        // Initiate Cognito flow
        const response = await this.invokeAgent({
            action: 'deploy', 
            deployment_type: 'managed',
            session_id: this.sessionId
        });
        
        if (response.auth_url) {
            // Redirect to Cognito
            window.location.href = response.auth_url;
        }
    }
}
