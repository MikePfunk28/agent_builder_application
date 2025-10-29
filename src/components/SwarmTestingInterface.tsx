import React, { useState, useCallback, useEffect } from 'react';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface SwarmDefinition {
  id: string;
  name: string;
  orchestratorAgentId: string;
  agentIds: string[];
  isolationLevel: "full";
  communicationProtocol: "broadcast" | "a2a" | "hierarchical";
  deploymentMode: "lambda" | "local";
  localModelProvider?: "ollama" | "llamacpp" | "lmstudio";
  localModelEndpoint?: string;
  createdAt: number;
  updatedAt: number;
}

interface AgentAddress {
  swarmId: string;
  agentId: string;
  agentName: string;
  role: "orchestrator" | "worker";
  status: "active" | "inactive" | "error";
  lastActivity: number;
}

interface SwarmTestResult {
  agentId: string;
  agentName: string;
  success: boolean;
  response?: string;
  executionTime: number;
  error?: string;
  isolationVerified?: boolean;
  communicationLog?: string[];
}

export function SwarmTestingInterface() {
  const [activeSwarm, setActiveSwarm] = useState<SwarmDefinition | null>(null);
  const [currentAgent, setCurrentAgent] = useState<AgentAddress | null>(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'command' | 'query' | 'notification'>('query');
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [testResults, setTestResults] = useState<SwarmTestResult[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showModelSetup, setShowModelSetup] = useState(false);

  // Convex hooks
  const agents = useQuery(api.agents.list, {});
  const swarms = useQuery(api.swarmTestingOrchestrator.listUserSwarms, {});
  const swarmStatus = useQuery(
    activeSwarm ? api.swarmTestingOrchestrator.getSwarmStatus : undefined,
    activeSwarm ? { swarmId: activeSwarm.id } : undefined
  );

  const createSwarm = useAction(api.swarmTestingOrchestrator.createSwarm);
  const sendMessageToSwarm = useAction(api.swarmTestingOrchestrator.sendMessageToSwarm);
  const sendMessageToAgent = useAction(api.swarmTestingOrchestrator.sendMessageToAgent);
  const switchToAgent = useAction(api.swarmTestingOrchestrator.switchToAgent);
  const testSwarmCoordination = useAction(api.swarmTestingOrchestrator.testSwarmCoordination);
  const detectAndSetupLocalModels = useAction(api.swarmTestingOrchestrator.detectAndSetupLocalModels);

  // Create new swarm
  const handleCreateSwarm = useCallback(async () => {
    const swarmName = prompt('Enter swarm name:');
    if (!swarmName) return;

    const orchestratorId = prompt('Enter orchestrator agent ID:');
    if (!orchestratorId) return;

    const agentIdsStr = prompt('Enter worker agent IDs (comma-separated):');
    if (!agentIdsStr) return;

    const agentIds = agentIdsStr.split(',').map(id => id.trim());

    try {
      const result = await createSwarm({
        name: swarmName,
        orchestratorAgentId: orchestratorId as any,
        agentIds: agentIds as any,
        communicationProtocol: 'broadcast',
        deploymentMode: 'lambda',
      });

      if (result.success) {
        alert(`Swarm created: ${result.swarmId}`);
      } else {
        alert(`Failed to create swarm: ${result.message}`);
      }
    } catch (error) {
      alert(`Error creating swarm: ${error}`);
    }
  }, [createSwarm]);

  // Send message to swarm or individual agent
  const handleSendMessage = useCallback(async () => {
    if (!activeSwarm || !message.trim()) return;

    setIsExecuting(true);
    try {
      let result;

      if (isBroadcast) {
        result = await sendMessageToSwarm({
          swarmId: activeSwarm.id,
          message,
          messageType,
        });

        // Process broadcast results
        const results: SwarmTestResult[] = [];
        for (const [agentId, response] of Object.entries(result.responses)) {
          const agent = agents?.find(a => a._id === agentId);
          results.push({
            agentId,
            agentName: agent?.name || 'Unknown',
            success: response.success,
            response: response.content || response.response,
            executionTime: response.executionTime || 0,
            error: response.error,
            isolationVerified: result.isolationStatus[agentId],
          });
        }
        setTestResults(results);

      } else if (currentAgent) {
        result = await sendMessageToAgent({
          swarmId: activeSwarm.id,
          agentId: currentAgent.agentId as any,
          message,
          messageType,
        });

        setTestResults([{
          agentId: result.agentId,
          agentName: currentAgent.agentName,
          success: result.success,
          response: result.response?.content || result.response?.response,
          executionTime: result.executionTime,
          error: result.response?.error,
          isolationVerified: result.isolationVerified,
        }]);
      }

      setMessage('');

    } catch (error) {
      alert(`Error sending message: ${error}`);
    } finally {
      setIsExecuting(false);
    }
  }, [activeSwarm, currentAgent, message, messageType, isBroadcast, sendMessageToSwarm, sendMessageToAgent, agents]);

  // Switch to different agent
  const handleSwitchAgent = useCallback(async (targetAgentId: string) => {
    if (!activeSwarm) return;

    try {
      const result = await switchToAgent({
        swarmId: activeSwarm.id,
        targetAgentId: targetAgentId as any,
        reason: 'User requested agent switch for testing',
      });

      if (result.success) {
        setCurrentAgent(result.agentInfo);
        alert(result.message);
      } else {
        alert(`Failed to switch agent: ${result.message}`);
      }
    } catch (error) {
      alert(`Error switching agent: ${error}`);
    }
  }, [activeSwarm, switchToAgent]);

  // Test swarm coordination
  const handleTestCoordination = useCallback(async () => {
    if (!activeSwarm) return;

    setIsExecuting(true);
    try {
      const result = await testSwarmCoordination({
        swarmId: activeSwarm.id,
        testScenario: 'parallel_processing',
      });

      if (result.success) {
        setTestResults(result.testResults.results);
        alert(`Coordination test completed. Isolation: ${result.isolationScore.toFixed(1)}%, Coordination: ${result.coordinationScore.toFixed(1)}%`);
      } else {
        alert('Coordination test failed');
      }
    } catch (error) {
      alert(`Error testing coordination: ${error}`);
    } finally {
      setIsExecuting(false);
    }
  }, [activeSwarm, testSwarmCoordination]);

  // Setup local models
  const handleSetupLocalModels = useCallback(async () => {
    if (!activeSwarm) return;

    try {
      const result = await detectAndSetupLocalModels({
        swarmId: activeSwarm.id,
      });

      if (result.success) {
        alert(`Model setup completed. ${result.setupRecommendations.join(', ')}`);
      } else {
        alert(`Model setup failed: ${result.setupRecommendations.join(', ')}`);
      }
    } catch (error) {
      alert(`Error setting up models: ${error}`);
    }
  }, [activeSwarm, detectAndSetupLocalModels]);

  return (
    <div className="h-screen bg-gray-900 text-green-400 p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-green-300 mb-2">Swarm Testing Interface</h1>
          <p className="text-green-600">Test multi-agent swarms with 100% isolation and local model support</p>
        </div>

        {/* Swarm Selection */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <select
              value={activeSwarm?.id || ''}
              onChange={(e) => {
                const swarm = swarms?.find(s => s.id === e.target.value);
                setActiveSwarm(swarm || null);
                setCurrentAgent(null);
              }}
              className="bg-gray-800 border border-green-900 rounded px-3 py-2 text-green-400"
            >
              <option value="">Select Swarm</option>
              {swarms?.map(swarm => (
                <option key={swarm.id} value={swarm.id}>
                  {swarm.name} ({swarm.agentIds.length} agents)
                </option>
              ))}
            </select>

            <button
              onClick={handleCreateSwarm}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white"
            >
              Create Swarm
            </button>

            <button
              onClick={() => setShowModelSetup(!showModelSetup)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
            >
              Model Setup
            </button>
          </div>

          {/* Swarm Status */}
          {swarmStatus && (
            <div className="bg-gray-800 border border-green-900 rounded p-4 mb-4">
              <h3 className="text-lg font-semibold mb-2">Swarm Status: {swarmStatus.swarm?.name}</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-green-600">Isolation:</span>
                  <span className={`ml-2 ${swarmStatus.healthStatus.isolationScore > 80 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {swarmStatus.healthStatus.isolationScore}%
                  </span>
                </div>
                <div>
                  <span className="text-green-600">Coordination:</span>
                  <span className={`ml-2 ${swarmStatus.healthStatus.coordinationScore > 70 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {swarmStatus.healthStatus.coordinationScore}%
                  </span>
                </div>
                <div>
                  <span className="text-green-600">Health:</span>
                  <span className={`ml-2 ${
                    swarmStatus.healthStatus.overall === 'healthy' ? 'text-green-400' :
                    swarmStatus.healthStatus.overall === 'warning' ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {swarmStatus.healthStatus.overall}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Model Setup Panel */}
        {showModelSetup && (
          <div className="bg-gray-800 border border-green-900 rounded p-4 mb-6">
            <h3 className="text-lg font-semibold mb-4">Local Model Setup</h3>
            <div className="flex gap-4">
              <button
                onClick={handleSetupLocalModels}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white"
              >
                Detect & Setup Models
              </button>
              <div className="text-sm text-green-600">
                Automatically detects Ollama, LlamaCpp, LMStudio, and GGUF models
              </div>
            </div>
          </div>
        )}

        {/* Agent Selection */}
        {activeSwarm && swarmStatus && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Agent Selection</h3>
            <div className="grid grid-cols-4 gap-2">
              {swarmStatus.agents.map(agent => (
                <button
                  key={agent.agentId}
                  onClick={() => handleSwitchAgent(agent.agentId)}
                  className={`p-3 border rounded text-left ${
                    currentAgent?.agentId === agent.agentId
                      ? 'border-green-400 bg-green-900/30'
                      : 'border-green-900 hover:border-green-700'
                  }`}
                >
                  <div className="font-medium">{agent.agentName}</div>
                  <div className="text-xs text-green-600">{agent.role}</div>
                  <div className={`text-xs ${
                    agent.status === 'active' ? 'text-green-400' :
                    agent.status === 'inactive' ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {agent.status}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Input */}
        {activeSwarm && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Send Message</h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                <select
                  value={messageType}
                  onChange={(e) => setMessageType(e.target.value as any)}
                  className="bg-gray-800 border border-green-900 rounded px-3 py-2 text-green-400"
                >
                  <option value="query">Query</option>
                  <option value="command">Command</option>
                  <option value="notification">Notification</option>
                </select>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isBroadcast}
                    onChange={(e) => setIsBroadcast(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Broadcast to entire swarm</span>
                </label>

                <button
                  onClick={handleTestCoordination}
                  disabled={isExecuting}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 rounded text-white"
                >
                  Test Coordination
                </button>
              </div>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={isBroadcast
                  ? "Enter message to send to entire swarm..."
                  : currentAgent
                    ? `Enter message for ${currentAgent.agentName}...`
                    : "Select an agent first..."
                }
                className="w-full h-32 bg-gray-800 border border-green-900 rounded p-3 text-green-400 resize-none"
                disabled={!currentAgent && !isBroadcast}
              />

              <button
                onClick={handleSendMessage}
                disabled={isExecuting || !message.trim() || (!currentAgent && !isBroadcast)}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white"
              >
                {isExecuting ? 'Sending...' : isBroadcast ? 'Send to Swarm' : 'Send to Agent'}
              </button>
            </div>
          </div>
        )}

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Test Results</h3>
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <div key={index} className="bg-gray-800 border border-green-900 rounded p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${
                        result.success ? 'bg-green-400' : 'bg-red-400'
                      }`} />
                      <span className="font-medium">{result.agentName}</span>
                      <span className="text-xs text-green-600">({result.agentId.slice(-8)})</span>
                    </div>
                    <div className="text-xs text-green-600">
                      {result.executionTime}ms
                      {result.isolationVerified && (
                        <span className="ml-2 text-green-400">✓ Isolated</span>
                      )}
                    </div>
                  </div>

                  {result.response && (
                    <div className="text-sm text-green-300 mb-2 p-2 bg-gray-900 rounded">
                      {result.response}
                    </div>
                  )}

                  {result.error && (
                    <div className="text-sm text-red-400 p-2 bg-red-900/20 rounded">
                      Error: {result.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-gray-800 border border-green-900 rounded p-4">
          <h3 className="text-lg font-semibold mb-2">How to Use Swarm Testing</h3>
          <div className="text-sm text-green-600 space-y-2">
            <p>1. <strong>Create a Swarm:</strong> Define orchestrator and worker agents with 100% isolation</p>
            <p>2. <strong>Setup Models:</strong> Detect local models (Ollama, LlamaCpp, LMStudio) or use Lambda deployment</p>
            <p>3. <strong>Select Agent:</strong> Switch between individual agents or broadcast to entire swarm</p>
            <p>4. <strong>Test Coordination:</strong> Run automated tests to verify isolation and communication</p>
            <p>5. <strong>Send Messages:</strong> Query, command, or notify agents individually or as a group</p>
          </div>
        </div>
      </div>
    </div>
  );
}