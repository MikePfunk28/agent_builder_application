import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function WorkflowTemplateSelector({ onTemplateSelect }: { onTemplateSelect: (workflow: any) => void }) {
  const templates = useQuery(api.workflowTemplates.getWorkflowTemplates);
  const createWorkflow = useMutation(api.workflowTemplates.createWorkflowFromTemplate);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const handleCreateWorkflow = async (templateId: string) => {
    const result = await createWorkflow({
      templateId,
      name: `${templates?.find(t => t.id === templateId)?.name} - ${new Date().toLocaleDateString()}`,
    });
    onTemplateSelect(result.workflow);
  };

  const templateIcons: Record<string, string> = {
    "chain-of-thought": "🧠",
    "prompt-chaining": "⛓️",
    "parallel-prompts": "⚡",
    "rag": "📚",
    "react": "🔄",
    "self-consistency": "✅",
    "tree-of-thoughts": "🌳",
    "reflexion": "🪞",
    "map-reduce": "🗺️",
    "human-in-the-loop": "👤"
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Workflow Templates</h2>
      <p className="text-gray-600 mb-6">Choose a pre-built workflow pattern to get started</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates?.map((template) => (
          <div
            key={template.id}
            className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
              selectedTemplate === template.id ? "border-blue-500 bg-blue-50" : "border-gray-200"
            }`}
            onClick={() => setSelectedTemplate(template.id)}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{templateIcons[template.id]}</span>
              <h3 className="font-semibold text-lg">{template.name}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">{template.description}</p>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{template.nodes.length} nodes</span>
              <span>{template.edges.length} connections</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCreateWorkflow(template.id);
              }}
              className="mt-3 w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 transition-colors"
            >
              Use Template
            </button>
          </div>
        ))}
      </div>

      {selectedTemplate && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Template Preview</h3>
          <div className="text-sm text-gray-700">
            {templates?.find(t => t.id === selectedTemplate)?.nodes.map((node, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-1">
                <span className="text-gray-400">→</span>
                <span>{node.label}</span>
                <span className="text-xs text-gray-500">({node.type})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
