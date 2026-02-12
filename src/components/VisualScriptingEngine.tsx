import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';

// NOTE: Do NOT import server functions in browser components
// All server interactions must go through Convex actions/queries

interface Node {
  id: string;
  type: 'input' | 'output' | 'llm' | 'tool' | 'decision' | 'aggregate' | 'human' | 'embedding' | 'retrieval' | 'rerank' | 'aws-service' | 'database' | 'storage' | 'compute' | 'networking' | 'security' | 'monitoring' | 'ai-ml';
  category: 'workflow' | 'ai' | 'tool' | 'aws' | 'data' | 'infrastructure';
  label: string;
  position: { x: number; y: number };
  config: any;
}

interface Edge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

interface Workflow {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  description?: string;
}

interface VisualScriptingEngineProps {
  workflow?: Workflow;
  onWorkflowChange?: (workflow: Workflow) => void;
  onExecute?: (result: any) => void;
  readOnly?: boolean;
}

export function VisualScriptingEngine({
  workflow: initialWorkflow,
  onWorkflowChange,
  onExecute,
  readOnly = false
}: VisualScriptingEngineProps) {
  const [workflow, setWorkflow] = useState<Workflow>(initialWorkflow || {
    id: `workflow-${Date.now()}`,
    name: 'New Workflow',
    nodes: [],
    edges: []
  });

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  // NOTE: executeWorkflow is a server function - cannot be called from browser
  // We need to create a Convex action for workflow execution
  const templates = useQuery(api.workflowTemplates.getWorkflowTemplates);

  // Update workflow when prop changes
  useEffect(() => {
    if (initialWorkflow) {
      setWorkflow(initialWorkflow);
    }
  }, [initialWorkflow]);

  // Notify parent of workflow changes
  useEffect(() => {
    if (onWorkflowChange) {
      onWorkflowChange(workflow);
    }
  }, [workflow, onWorkflowChange]);

  const addNode = useCallback((type: Node['type'], position: { x: number; y: number }) => {
    if (readOnly) return;

    const newNode: Node = {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      category: getNodeCategory(type),
      label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
      position,
      config: getDefaultConfig(type)
    };

    setWorkflow(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode]
    }));
  }, [readOnly]);

  const updateNode = useCallback((nodeId: string, updates: Partial<Node>) => {
    if (readOnly) return;

    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.map(node =>
        node.id === nodeId ? { ...node, ...updates } : node
      )
    }));
  }, [readOnly]);

  const deleteNode = useCallback((nodeId: string) => {
    if (readOnly) return;

    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.filter(node => node.id !== nodeId),
      edges: prev.edges.filter(edge => edge.from !== nodeId && edge.to !== nodeId)
    }));
    setSelectedNode(null);
  }, [readOnly]);

  const addEdge = useCallback((fromId: string, toId: string) => {
    if (readOnly) return;

    const newEdge: Edge = {
      id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from: fromId,
      to: toId
    };

    setWorkflow(prev => ({
      ...prev,
      edges: [...prev.edges, newEdge]
    }));
  }, [readOnly]);

  const deleteEdge = useCallback((edgeId: string) => {
    if (readOnly) return;

    setWorkflow(prev => ({
      ...prev,
      edges: prev.edges.filter(edge => edge.id !== edgeId)
    }));
  }, [readOnly]);

  const handleCanvasClick = useCallback((event: React.MouseEvent) => {
    if (readOnly) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const position = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };

    // If connecting, complete the connection
    if (isConnecting) {
      const targetElement = event.target as HTMLElement;
      const targetNodeId = targetElement.closest('[data-node-id]')?.getAttribute('data-node-id');

      if (targetNodeId && targetNodeId !== isConnecting) {
        addEdge(isConnecting, targetNodeId);
      }
      setIsConnecting(null);
      return;
    }

    // If no node is clicked, deselect
    setSelectedNode(null);
  }, [isConnecting, addEdge, readOnly]);

  const handleNodeClick = useCallback((node: Node, event: React.MouseEvent) => {
    event.stopPropagation();

    if (readOnly) {
      setSelectedNode(node);
      return;
    }

    if (isConnecting) {
      if (isConnecting !== node.id) {
        addEdge(isConnecting, node.id);
      }
      setIsConnecting(null);
    } else {
      setSelectedNode(node);
    }
  }, [isConnecting, addEdge, readOnly]);

  const handleExecute = useCallback(async () => {
    if (!workflow.nodes.some(n => n.type === 'output')) {
      alert('Workflow must have an output node');
      return;
    }

    setIsExecuting(true);
    try {
      // const result = await executeWorkflow({
      //   workflowId: workflow.id as any,
      //   input: { message: 'Execute workflow' }
      // });
      const result = { success: true, message: 'Workflow execution not yet implemented' };

      if (onExecute) {
        onExecute(result);
      }
    } catch (error) {
      console.error('Workflow execution failed:', error);
      alert('Workflow execution failed');
    } finally {
      setIsExecuting(false);
    }
  }, [workflow, onExecute]);

  const handleExecuteClick = useCallback(() => {
    void handleExecute();
  }, [handleExecute]);

  const getNodeColor = (type: Node['type']): string => {
    const colors = {
      // Workflow nodes
      input: 'bg-green-500',
      output: 'bg-red-500',
      decision: 'bg-yellow-500',
      aggregate: 'bg-orange-500',
      human: 'bg-pink-500',

      // AI/ML nodes
      llm: 'bg-blue-500',
      embedding: 'bg-indigo-500',
      retrieval: 'bg-teal-500',
      rerank: 'bg-cyan-500',
      'ai-ml': 'bg-violet-500',

      // Tool nodes
      tool: 'bg-purple-500',

      // AWS Service nodes - DISTINCT GOLD/AMBER THEME (completely different from others)
      'aws-service': 'bg-amber-500',
      database: 'bg-yellow-600',
      storage: 'bg-amber-600',
      compute: 'bg-yellow-700',
      networking: 'bg-amber-700',
      security: 'bg-yellow-800',
      monitoring: 'bg-amber-800'
    };
    return colors[type] || 'bg-gray-500';
  };

  const getNodeCategory = (type: Node['type']): Node['category'] => {
    const categories = {
      // Workflow category
      input: 'workflow' as const,
      output: 'workflow' as const,
      decision: 'workflow' as const,
      aggregate: 'workflow' as const,
      human: 'workflow' as const,

      // AI category
      llm: 'ai' as const,
      embedding: 'ai' as const,
      retrieval: 'ai' as const,
      rerank: 'ai' as const,
      'ai-ml': 'ai' as const,

      // Tool category
      tool: 'tool' as const,

      // AWS category
      'aws-service': 'aws' as const,
      database: 'aws' as const,
      storage: 'aws' as const,
      compute: 'aws' as const,
      networking: 'aws' as const,
      security: 'aws' as const,
      monitoring: 'aws' as const
    };
    return categories[type] || 'workflow';
  };

  const getDefaultConfig = (type: Node['type']): any => {
    switch (type) {
      case 'llm':
        return { model: 'claude-3.5-sonnet', temperature: 0.7 };
      case 'tool':
        return { toolName: '', parameters: {} };
      case 'decision':
        return { condition: '', trueBranch: '', falseBranch: '' };
      case 'aggregate':
        return { method: 'concatenate' };
      case 'aws-service':
        return { serviceName: '', region: 'us-east-1', parameters: {} };
      case 'database':
        return { engine: 'postgresql', instance: '', parameters: {} };
      case 'storage':
        return { bucketName: '', region: 'us-east-1', parameters: {} };
      case 'compute':
        return { instanceType: 't3.micro', ami: '', parameters: {} };
      case 'networking':
        return { vpcId: '', subnetId: '', parameters: {} };
      case 'security':
        return { resourceType: 'security-group', parameters: {} };
      case 'monitoring':
        return { service: 'cloudwatch', parameters: {} };
      case 'ai-ml':
        return { service: 'bedrock', model: 'claude-3.5-sonnet', parameters: {} };
      default:
        return {};
    }
  };

  return (
    <div className="h-screen bg-gray-900 text-green-400 flex">
      {/* Toolbar */}
      <div className="w-64 bg-gray-800 border-r border-green-900 p-4 overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">Workflow Engine</h3>

        {/* Templates Section */}
        <div className="mb-6">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm mb-2"
          >
            {showTemplates ? '✕ Hide Templates' : '📋 Load Template'}
          </button>

          {showTemplates && templates && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {templates.map((template: any) => (
                <button
                  key={template.id}
                  onClick={() => {
                    // For now, just load the template locally without saving to database
                    setWorkflow({
                      id: `workflow-${Date.now()}`,
                      name: template.name,
                      nodes: template.nodes.map((n: any, idx: number) => ({
                        ...n,
                        position: { x: 150 + (idx % 3) * 200, y: 100 + Math.floor(idx / 3) * 150 },
                        category: getNodeCategory(n.type)
                      })),
                      edges: template.edges
                    });
                    setShowTemplates(false);
                  }}
                  className="w-full text-left px-2 py-2 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                >
                  <div className="font-semibold text-green-400">{template.name}</div>
                  <div className="text-gray-400 text-[10px] mt-1">{template.description}</div>
                  <div className="text-gray-500 text-[10px] mt-1">
                    {template.nodes.length} nodes • {template.edges.length} edges
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {!readOnly && (
          <div className="space-y-4 mb-6">
            {/* Workflow Nodes */}
            <div>
              <h4 className="text-sm font-medium text-green-600 mb-2">🟢 Workflow Nodes</h4>
              <div className="grid grid-cols-2 gap-2">
                {(['input', 'output', 'decision', 'aggregate', 'human'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => addNode(type, { x: 100, y: 100 })}
                    className={`p-2 text-xs rounded border ${getNodeColor(type)} hover:opacity-80`}
                  >
                    {type.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* AI/ML Nodes */}
            <div>
              <h4 className="text-sm font-medium text-blue-400 mb-2">🔵 AI/ML Nodes</h4>
              <div className="grid grid-cols-2 gap-2">
                {(['llm', 'embedding', 'retrieval', 'rerank', 'ai-ml'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => addNode(type, { x: 100, y: 100 })}
                    className={`p-2 text-xs rounded border ${getNodeColor(type)} hover:opacity-80`}
                  >
                    {type.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Tool Nodes */}
            <div>
              <h4 className="text-sm font-medium text-purple-400 mb-2">🟣 Tool Nodes</h4>
              <div className="grid grid-cols-2 gap-2">
                {(['tool'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => addNode(type, { x: 100, y: 100 })}
                    className={`p-2 text-xs rounded border ${getNodeColor(type)} hover:opacity-80`}
                  >
                    {type.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* AWS Service Nodes */}
            <div>
              <h4 className="text-sm font-medium text-amber-400 mb-2">🟨 AWS Services</h4>
              <div className="grid grid-cols-2 gap-2">
                {(['aws-service', 'database', 'storage', 'compute', 'networking', 'security', 'monitoring'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => addNode(type, { x: 100, y: 100 })}
                    className={`p-2 text-xs rounded border-2 ${getNodeColor(type)} hover:opacity-90 text-black font-bold border-amber-300 shadow-lg`}
                  >
                    {type.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Workflow Info */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-green-600 mb-2">Workflow</h4>
          <div className="text-xs space-y-1">
            <div>Name: {workflow.name}</div>
            <div>Nodes: {workflow.nodes.length}</div>
            <div>Edges: {workflow.edges.length}</div>
          </div>
        </div>

        {/* Execute Button */}
        <button
          onClick={handleExecuteClick}
          disabled={isExecuting || workflow.nodes.length === 0}
          className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white mb-4"
        >
          {isExecuting ? 'Executing...' : 'Execute Workflow'}
        </button>

        {/* Node Config */}
        {selectedNode && (
          <div className="border-t border-green-900 pt-4">
            <h4 className="text-sm font-medium text-green-600 mb-2">Node Config</h4>
            <div className="space-y-2">
              <input
                type="text"
                value={selectedNode.label}
                onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
                className="w-full px-2 py-1 bg-gray-700 border border-green-900 rounded text-green-400 text-xs"
                placeholder="Node label"
                disabled={readOnly}
              />

              {!readOnly && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsConnecting(selectedNode.id)}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                  >
                    Connect
                  </button>
                  <button
                    onClick={() => deleteNode(selectedNode.id)}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <div
          ref={canvasRef}
          className="w-full h-full bg-gray-950 relative overflow-hidden cursor-crosshair"
          onClick={handleCanvasClick}
        >
          {/* Grid Background */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `
                linear-gradient(to right, #22c55e 1px, transparent 1px),
                linear-gradient(to bottom, #22c55e 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px'
            }}
          />

          {/* Edges */}
          <svg className="absolute inset-0 pointer-events-none">
            {workflow.edges.map(edge => {
              const fromNode = workflow.nodes.find(n => n.id === edge.from);
              const toNode = workflow.nodes.find(n => n.id === edge.to);

              if (!fromNode || !toNode) return null;

              const fromX = fromNode.position.x + 60; // Node width / 2
              const fromY = fromNode.position.y + 30; // Node height / 2
              const toX = toNode.position.x + 60;
              const toY = toNode.position.y + 30;

              return (
                <line
                  key={edge.id}
                  x1={fromX}
                  y1={fromY}
                  x2={toX}
                  y2={toY}
                  stroke="#22c55e"
                  strokeWidth="2"
                  markerEnd="url(#arrowhead)"
                />
              );
            })}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill="#22c55e"
                />
              </marker>
            </defs>
          </svg>

          {/* Nodes */}
          {workflow.nodes.map(node => (
            <div
              key={node.id}
              data-node-id={node.id}
              className={`absolute w-32 h-16 ${getNodeColor(node.type)} border-2 rounded cursor-pointer select-none flex items-center justify-center text-white text-xs font-medium ${
                selectedNode?.id === node.id ? 'border-yellow-400 ring-2 ring-yellow-400' : 'border-white/20'
              } ${isConnecting === node.id ? 'ring-2 ring-blue-400' : ''}`}
              style={{
                left: node.position.x,
                top: node.position.y,
                transform: 'translate(-50%, -50%)'
              }}
              onClick={(e) => handleNodeClick(node, e)}
              onMouseDown={(e) => {
                if (readOnly) return;

                // Start dragging
                const startX = e.clientX - node.position.x;
                const startY = e.clientY - node.position.y;

                const handleMouseMove = (e: MouseEvent) => {
                  const newX = e.clientX - startX;
                  const newY = e.clientY - startY;
                  updateNode(node.id, { position: { x: newX, y: newY } });
                };

                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };

                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            >
              {node.label}
            </div>
          ))}

          {/* Connection Indicator */}
          {isConnecting && (
            <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-1 rounded text-sm">
              Click another node to connect
            </div>
          )}
        </div>
      </div>
    </div>
  );
}