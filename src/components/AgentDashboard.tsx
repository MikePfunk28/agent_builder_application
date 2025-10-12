import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { motion } from "framer-motion";
import { Bot, Plus, Trash2, Eye, Download, Globe } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export function AgentDashboard() {
  const agents = useQuery(api.agents.list) || [];
  const publicAgents = useQuery(api.agents.getPublicAgents) || [];
  const removeAgent = useMutation(api.agents.remove);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this agent?")) {
      try {
        await removeAgent({ id: id as any });
        toast.success("Agent deleted successfully");
      } catch (error) {
        toast.error("Failed to delete agent");
      }
    }
  };

  const handleDownload = (agent: any) => {
    const blob = new Blob([agent.generatedCode], { type: "text/python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${agent.name.toLowerCase().replace(/\s+/g, "_")}_agent.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-green-400">Agent Dashboard</h1>
          <p className="text-green-600 mt-2">Manage your AI agents</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-400">{agents.length}</div>
          <div className="text-sm text-green-600">Total Agents</div>
        </div>
      </div>

      {/* My Agents */}
      <section>
        <h2 className="text-xl font-semibold text-green-400 mb-4">My Agents</h2>
        {agents.length === 0 ? (
          <div className="text-center py-12 bg-gray-900/30 rounded-xl border border-green-900/30">
            <Bot className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-green-400 mb-2">No agents yet</h3>
            <p className="text-green-600 mb-6">Create your first AI agent to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent, index) => (
              <motion.div
                key={agent._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gray-900/50 border border-green-900/30 rounded-xl p-6 hover:border-green-700/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-900/30 rounded-lg flex items-center justify-center">
                      <Bot className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-green-400">{agent.name}</h3>
                      <p className="text-sm text-green-600">{agent.model}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedAgent(agent)}
                      className="p-2 text-green-600 hover:text-green-400 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDownload(agent)}
                      className="p-2 text-blue-600 hover:text-blue-400 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(agent._id)}
                      className="p-2 text-red-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {agent.description && (
                  <p className="text-sm text-green-600 mb-4 line-clamp-2">
                    {agent.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs text-green-600">
                  <span>{agent.tools.length} tools</span>
                  <span>{agent.deploymentType}</span>
                  {agent.isPublic && <Globe className="w-3 h-3" />}
                </div>

                <div className="mt-4 pt-4 border-t border-green-900/30">
                  <div className="text-xs text-green-600">
                    Created {new Date(agent._creationTime).toLocaleDateString()}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Public Agents */}
      {publicAgents.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-green-400 mb-4">Community Agents</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {publicAgents.slice(0, 8).map((agent, index) => (
              <motion.div
                key={agent._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-gray-900/30 border border-green-900/20 rounded-lg p-4 hover:border-green-700/30 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="w-4 h-4 text-green-400" />
                  <h4 className="font-medium text-green-400 text-sm">{agent.name}</h4>
                </div>
                <p className="text-xs text-green-600 mb-2 line-clamp-2">
                  {agent.description}
                </p>
                <div className="flex items-center justify-between text-xs text-green-600">
                  <span>{agent.tools.length} tools</span>
                  <Globe className="w-3 h-3" />
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Agent Details Modal */}
      {selectedAgent && (
        <AgentDetailsModal 
          agent={selectedAgent} 
          onClose={() => setSelectedAgent(null)} 
        />
      )}
    </div>
  );
}

function AgentDetailsModal({ agent, onClose }: { agent: any; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gray-900 border border-green-900/30 rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-green-400">{agent.name}</h2>
          <button
            onClick={onClose}
            className="text-green-600 hover:text-green-400 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-green-400 mb-2">Description</h3>
            <p className="text-green-600">{agent.description || "No description provided"}</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-green-400 mb-2">Configuration</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-green-600">Model:</span>
                <span className="text-green-400 ml-2">{agent.model}</span>
              </div>
              <div>
                <span className="text-green-600">Deployment:</span>
                <span className="text-green-400 ml-2">{agent.deploymentType}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-green-400 mb-2">System Prompt</h3>
            <pre className="bg-black border border-green-900/30 rounded-lg p-4 text-sm text-green-400 overflow-x-auto">
              {agent.systemPrompt}
            </pre>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-green-400 mb-2">Tools ({agent.tools.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {agent.tools.map((tool: any, index: number) => (
                <div key={index} className="bg-black border border-green-900/30 rounded-lg p-3">
                  <div className="font-medium text-green-400">{tool.name}</div>
                  <div className="text-sm text-green-600">{tool.type}</div>
                  {tool.requiresPip && (
                    <div className="text-xs text-yellow-400 mt-1">
                      Requires: {tool.pipPackages?.join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
