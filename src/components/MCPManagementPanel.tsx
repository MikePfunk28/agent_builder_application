import React, { useState } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { 
  Server, 
  Plus, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Trash2,
  Edit,
  Play
} from 'lucide-react';
import { toast } from 'sonner';
import { MCPServerForm } from './MCPServerForm';
import { MCPToolTester } from './MCPToolTester';

interface MCPServer {
  _id: Id<"mcpServers">;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  disabled: boolean;
  timeout?: number;
  status: string;
  lastConnected?: number;
  lastError?: string;
  availableTools?: Array<{
    name: string;
    description?: string;
    inputSchema?: any;
  }>;
  createdAt: number;
  updatedAt: number;
}

export function MCPManagementPanel() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [selectedServer, setSelectedServer] = useState<MCPServer | null>(null);
  const [testingServerId, setTestingServerId] = useState<Id<"mcpServers"> | null>(null);

  // Query servers - will handle auth in the query itself
  const servers = useQuery(api.mcpConfig.listMCPServers) || [];
  const testConnection = useAction(api.mcpConfig.testMCPConnection);
  const deleteServer = useMutation(api.mcpConfig.deleteMCPServer);

  const handleTestConnection = (serverId: Id<"mcpServers">) => {
    setTestingServerId(serverId);
    void (async () => {
      try {
        const result = await testConnection({ serverId });
        
        if (result.success) {
          toast.success(`Connected to ${servers.find(s => s._id === serverId)?.name}`);
        } else {
          toast.error(result.error || 'Connection failed');
        }
      } catch (error: any) {
        toast.error(error.message || 'Failed to test connection');
      } finally {
        setTestingServerId(null);
      }
    })();
  };

  const handleDelete = (serverId: Id<"mcpServers">, serverName: string) => {
    if (!confirm(`Are you sure you want to delete "${serverName}"?`)) {
      return;
    }

    void (async () => {
      try {
        await deleteServer({ serverId });
        toast.success('MCP server deleted successfully');
        
        // Clear selection if deleted server was selected
        if (selectedServer?._id === serverId) {
          setSelectedServer(null);
        }
      } catch (error: any) {
        toast.error(error.message || 'Failed to delete MCP server');
      }
    })();
  };

  const handleEdit = (server: MCPServer) => {
    setEditingServer(server);
    setShowAddForm(true);
  };

  const handleFormClose = () => {
    setShowAddForm(false);
    setEditingServer(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'disconnected':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'error':
        return 'Error';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-green-400">MCP Servers</h2>
          <p className="text-green-600 mt-1">
            Manage Model Context Protocol servers and tools
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Server
        </button>
      </div>

      {/* Server List */}
      {servers.length === 0 ? (
        <div className="bg-gray-900/30 border border-green-900/30 rounded-xl p-12 text-center">
          <Server className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-green-400 mb-2">No MCP Servers</h3>
          <p className="text-green-600 mb-6">
            Add your first MCP server to start using external tools and capabilities
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Server
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {servers.map((server) => (
            <div
              key={server._id}
              className={`bg-gray-900/50 border rounded-xl p-6 transition-all ${
                selectedServer?._id === server._id
                  ? 'border-green-500 shadow-lg shadow-green-500/20'
                  : 'border-green-900/30 hover:border-green-700/50'
              }`}
            >
              {/* Server Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-10 h-10 bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Server className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-green-400 truncate">
                      {server.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusIcon(server.status)}
                      <span className={`text-sm ${
                        server.status === 'connected' ? 'text-green-500' :
                        server.status === 'error' ? 'text-red-500' :
                        server.status === 'disconnected' ? 'text-yellow-500' :
                        'text-gray-500'
                      }`}>
                        {getStatusText(server.status)}
                      </span>
                      {server.disabled && (
                        <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-400 rounded">
                          Disabled
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleTestConnection(server._id)}
                    disabled={testingServerId === server._id || server.disabled}
                    className="p-2 text-blue-600 hover:text-blue-400 hover:bg-blue-900/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Test Connection"
                  >
                    <RefreshCw className={`w-4 h-4 ${
                      testingServerId === server._id ? 'animate-spin' : ''
                    }`} />
                  </button>
                  <button
                    onClick={() => handleEdit(server)}
                    className="p-2 text-green-600 hover:text-green-400 hover:bg-green-900/20 rounded-md transition-colors"
                    title="Edit Server"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(server._id, server.name)}
                    className="p-2 text-red-600 hover:text-red-400 hover:bg-red-900/20 rounded-md transition-colors"
                    title="Delete Server"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Server Details */}
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-green-600 font-medium min-w-[80px]">Command:</span>
                  <code className="text-green-400 font-mono text-xs bg-black/30 px-2 py-1 rounded flex-1 break-all">
                    {server.command}
                  </code>
                </div>
                
                {server.args.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 font-medium min-w-[80px]">Args:</span>
                    <code className="text-green-400 font-mono text-xs bg-black/30 px-2 py-1 rounded flex-1 break-all">
                      {server.args.join(' ')}
                    </code>
                  </div>
                )}

                {server.timeout && (
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 font-medium min-w-[80px]">Timeout:</span>
                    <span className="text-green-400">{server.timeout}ms</span>
                  </div>
                )}

                {server.lastError && (
                  <div className="mt-3 p-3 bg-red-900/20 border border-red-600/30 rounded-md">
                    <div className="flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-red-400 mb-1">Last Error</div>
                        <div className="text-xs text-red-300 break-words">{server.lastError}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Available Tools */}
              {server.availableTools && server.availableTools.length > 0 && (
                <div className="mt-4 pt-4 border-t border-green-900/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-green-400">
                      Available Tools ({server.availableTools.length})
                    </span>
                    <button
                      onClick={() => setSelectedServer(server)}
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      <Play className="w-3 h-3" />
                      Test Tools
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {server.availableTools.slice(0, 5).map((tool, index) => (
                      <span
                        key={index}
                        className="text-xs px-2 py-1 bg-green-900/30 text-green-400 rounded border border-green-700/30"
                      >
                        {tool.name}
                      </span>
                    ))}
                    {server.availableTools.length > 5 && (
                      <span className="text-xs px-2 py-1 text-green-600">
                        +{server.availableTools.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Last Connected */}
              {server.lastConnected && (
                <div className="mt-4 text-xs text-green-600">
                  Last connected: {new Date(server.lastConnected).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Server Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-green-900/30 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <MCPServerForm
              server={editingServer}
              onClose={handleFormClose}
            />
          </div>
        </div>
      )}

      {/* Tool Tester Modal */}
      {selectedServer && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-green-900/30 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <MCPToolTester
              server={selectedServer}
              onClose={() => setSelectedServer(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
