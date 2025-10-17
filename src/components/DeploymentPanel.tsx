import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

import { 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Play,
  Zap,
  Activity,
  Network
} from 'lucide-react';
import { toast } from 'sonner';
import { DiagramViewer } from './DiagramViewer';

interface DeploymentPanelProps {
  agentId: Id<"agents">;
  agent: any;
}

interface DeploymentCardProps {
  deployment: any;
  onViewDiagram: (id: Id<"deployments">) => void;
}

function DeploymentCard({ deployment, onViewDiagram }: DeploymentCardProps) {
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showTestPanel, setShowTestPanel] = useState(false);
  
  const invokeAgentCore = useMutation(api.agentcoreDeployment.invokeAgentCoreSandbox as any);
  
  const isAgentCore = deployment.tier === 'freemium' && deployment.agentCoreRuntimeId;
  
  const handleTestAgent = () => {
    if (!testInput.trim() || !deployment.agentCoreRuntimeId) return;
    
    setIsTesting(true);
    setTestResult(null);
    
    void (async () => {
      try {
        const result = await invokeAgentCore({
          sandboxId: deployment.agentCoreRuntimeId,
          input: testInput,
        });
        
        setTestResult(result);
        
        if (result.success) {
          toast.success('Agent invoked successfully');
        } else {
          toast.error(result.error || 'Agent invocation failed');
        }
      } catch (error: any) {
        toast.error(error.message || 'Failed to invoke agent');
        setTestResult({ success: false, error: error.message });
      } finally {
        setIsTesting(false);
      }
    })();
  };
  
  return (
    <div className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900">
            {deployment.config?.agentName || deployment.agentName || 'Unnamed Agent'}
          </div>
          <div className="text-xs text-gray-500">
            {deployment.config?.region || deployment.region || 'us-east-1'} • {new Date(deployment.createdAt || deployment.startedAt).toLocaleDateString()}
          </div>
          
          {/* AgentCore-specific info */}
          {isAgentCore && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center text-xs text-gray-600">
                <Zap className="w-3 h-3 mr-1 text-purple-500" />
                <span className="font-medium">AgentCore Sandbox</span>
              </div>
              <div className="text-xs text-gray-500 font-mono">
                ID: {deployment.agentCoreRuntimeId?.substring(0, 20)}...
              </div>
              {deployment.healthStatus && (
                <div className="flex items-center text-xs">
                  <Activity className={`w-3 h-3 mr-1 ${
                    deployment.healthStatus === 'healthy' ? 'text-green-500' :
                    deployment.healthStatus === 'error' ? 'text-red-500' :
                    'text-yellow-500'
                  }`} />
                  <span className="capitalize">{deployment.healthStatus}</span>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Test Agent button for AgentCore deployments */}
          {isAgentCore && deployment.status === 'ACTIVE' && (
            <button
              onClick={() => setShowTestPanel(!showTestPanel)}
              className="p-2 text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
              title="Test Agent"
            >
              <Play className="w-4 h-4" />
            </button>
          )}
          
          <button
            onClick={() => onViewDiagram(deployment._id)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            title="View Architecture Diagram"
          >
            <Network className="w-4 h-4" />
          </button>
          
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
            deployment.status === 'COMPLETED' || deployment.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
            deployment.status === 'FAILED' ? 'bg-red-100 text-red-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {deployment.status}
          </div>
        </div>
      </div>
      
      {/* Test Panel */}
      {showTestPanel && isAgentCore && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">
              Test Input
            </label>
            <textarea
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="Enter test input for the agent..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            
            <button
              onClick={handleTestAgent}
              disabled={isTesting || !testInput.trim()}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Test Agent
                </>
              )}
            </button>
            
            {/* Test Result */}
            {testResult && (
              <div className={`mt-3 p-3 rounded-md text-sm ${
                testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <div className="font-medium mb-2 flex items-center">
                  {testResult.success ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-1 text-green-600" />
                      <span className="text-green-800">Success</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 mr-1 text-red-600" />
                      <span className="text-red-800">Error</span>
                    </>
                  )}
                  {testResult.executionTime && (
                    <span className="ml-auto text-xs text-gray-600">
                      {testResult.executionTime}ms
                    </span>
                  )}
                </div>
                
                <div className={`text-xs font-mono whitespace-pre-wrap ${
                  testResult.success ? 'text-green-700' : 'text-red-700'
                }`}>
                  {testResult.success 
                    ? JSON.stringify(testResult.result, null, 2)
                    : testResult.error
                  }
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function DeploymentPanel({ agentId, agent }: DeploymentPanelProps) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [showDiagramModal, setShowDiagramModal] = useState(false);
  const [diagramDeploymentId, setDiagramDeploymentId] = useState<Id<"deployments"> | null>(null);
  
  const [deploymentConfig, setDeploymentConfig] = useState({
    region: 'us-east-1',
    agentName: agent?.name?.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase() || 'my-agent',
    description: agent?.description || '',
    enableMonitoring: true,
    enableAutoScaling: true,
    environment: 'prod' as 'dev' | 'staging' | 'prod',
    instanceType: 't3.medium',
    minCapacity: 1,
    maxCapacity: 10,
    targetCpuUtilization: 70,
    enableXRay: true,
    logRetentionDays: 30,
    enableBackups: true,
    enableSSL: true,
  });

  const deployToAWS = useMutation(api.awsDeployment.deployToAWS as any);
  const userDeployments = useQuery(api.awsDeployment.listUserDeployments, { limit: 10 });

  // Auto-refresh active deployments
  useEffect(() => {
    if (userDeployments?.some((d: any) => d.isActive)) {
      const interval = setInterval(() => {
        // Trigger re-fetch by updating a dummy state
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [userDeployments]);

  const handleDeploy = () => {
    if (!agentId) return;

    setIsDeploying(true);
    void (async () => {
      try {
        await deployToAWS({
          agentId,
          deploymentConfig,
        });

        toast.success('Deployment started successfully!');
      } catch (error: any) {
        console.error('Deployment failed:', error);
        toast.error(error.message || 'Deployment failed');
      } finally {
        setIsDeploying(false);
      }
    })();
  };

  const regions = [
    { value: 'us-east-1', label: 'US East (N. Virginia)' },
    { value: 'us-west-2', label: 'US West (Oregon)' },
    { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
    { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Deploy to AWS</h3>
        <div className="flex items-center text-sm text-gray-500">
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          Requires AWS Cognito authentication
        </div>
      </div>

      <div className="space-y-4">
        {/* Agent Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Agent Name
          </label>
          <input
            type="text"
            value={deploymentConfig.agentName}
            onChange={(e) => setDeploymentConfig(prev => ({ ...prev, agentName: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="my-agent"
          />
          <p className="text-xs text-gray-500 mt-1">
            Must be lowercase, alphanumeric with hyphens only
          </p>
        </div>

        {/* Region */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            AWS Region
          </label>
          <select
            value={deploymentConfig.region}
            onChange={(e) => setDeploymentConfig(prev => ({ ...prev, region: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {regions.map(region => (
              <option key={region.value} value={region.value}>
                {region.label}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description (Optional)
          </label>
          <textarea
            value={deploymentConfig.description}
            onChange={(e) => setDeploymentConfig(prev => ({ ...prev, description: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Describe what this agent does..."
          />
        </div>

        {/* Options */}
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={deploymentConfig.enableMonitoring}
              onChange={(e) => setDeploymentConfig(prev => ({ ...prev, enableMonitoring: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Enable monitoring and logging</span>
          </label>
          
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={deploymentConfig.enableAutoScaling}
              onChange={(e) => setDeploymentConfig(prev => ({ ...prev, enableAutoScaling: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Enable auto-scaling</span>
          </label>
        </div>

        {/* Deploy Button */}
        <button
          onClick={handleDeploy}
          disabled={isDeploying || !deploymentConfig.agentName}
          className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center"
        >
          {isDeploying ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Deploying to AWS...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Deploy to AWS AgentCore
            </>
          )}
        </button>

        {/* Cost Estimate */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-400 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-blue-800">Estimated Cost</h4>
              <p className="text-sm text-blue-700 mt-1">
                ~$0.10/hour when active + model usage costs
              </p>
              <p className="text-xs text-blue-600 mt-1">
                You only pay when your agent is processing requests
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Deployments */}
      {userDeployments && userDeployments.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Recent Deployments</h4>
          <div className="space-y-2">
            {userDeployments.map((deployment: any) => (
              <DeploymentCard
                key={deployment._id}
                deployment={deployment}
                onViewDiagram={(id) => {
                  setDiagramDeploymentId(id);
                  setShowDiagramModal(true);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Diagram Modal */}
      {showDiagramModal && diagramDeploymentId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-auto">
            <DiagramViewer
              deploymentId={diagramDeploymentId}
              onClose={() => {
                setShowDiagramModal(false);
                setDiagramDeploymentId(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default DeploymentPanel;