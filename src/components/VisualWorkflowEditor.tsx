import { useState, useCallback } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection
} from "reactflow";
import "reactflow/dist/style.css";

interface VisualWorkflowEditorProps {
  workflow: any;
  onSave: (workflow: any) => void;
}

export function VisualWorkflowEditor({ workflow, onSave }: VisualWorkflowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    workflow.nodes.map((node: any, idx: number) => ({
      id: node.id,
      type: getNodeType(node.type),
      position: { x: 250 * (idx % 3), y: 150 * Math.floor(idx / 3) },
      data: { label: node.label, nodeType: node.type }
    }))
  );

  const [edges, setEdges, onEdgesChange] = useEdgesState(
    workflow.edges.map((edge: any) => ({
      id: `${edge.from}-${edge.to}`,
      source: edge.from,
      target: edge.to,
      label: edge.condition,
      animated: true
    }))
  );

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleSave = () => {
    const updatedWorkflow = {
      ...workflow,
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.data.nodeType,
        label: n.data.label
      })),
      edges: edges.map(e => ({
        from: e.source,
        to: e.target,
        condition: e.label
      }))
    };
    onSave(updatedWorkflow);
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="bg-white border-b p-4 flex justify-between items-center">
        <h2 className="text-xl font-bold">{workflow.name}</h2>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Save Workflow
          </button>
          <button className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
            Execute
          </button>
        </div>
      </div>

      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Controls />
          <Background />
        </ReactFlow>
      </div>

      <div className="bg-gray-50 border-t p-4">
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span>LLM Node</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span>Tool Node</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-500 rounded"></div>
            <span>Decision Node</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 rounded"></div>
            <span>Human Node</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function getNodeType(type: string): string {
  const typeMap: Record<string, string> = {
    input: "input",
    output: "output",
    llm: "default",
    reasoning: "default",
    tool: "default",
    decision: "default",
    human: "default"
  };
  return typeMap[type] || "default";
}
