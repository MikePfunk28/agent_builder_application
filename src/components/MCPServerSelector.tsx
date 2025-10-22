/**
 * MCP Server Selector Component
 * Allows users to select which MCP servers their agent should have access to
 */

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Server, CheckCircle, Circle, Info, Wrench } from "lucide-react";

interface MCPServer {
  _id: Id<"mcpServers">;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  disabled: boolean;
  status: string;
  availableTools?: Array<{
    name: string;
    description?: string;
  }>;
}

interface MCPServerSelectorProps {
  selectedServers: Array<{
    name: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
    disabled?: boolean;
  }>;
  onSelectionChange: (servers: Array<{
    name: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
    disabled?: boolean;
  }>) => void;
}

export function MCPServerSelector({
  selectedServers,
  onSelectionChange,
}: MCPServerSelectorProps) {
  const servers = useQuery(api.mcpConfig.listMCPServers);
  const [showInfo, setShowInfo] = useState(false);

  const isServerSelected = (serverName: string) => {
    return selectedServers.some(s => s.name === serverName);
  };

  const toggleServer = (server: MCPServer) => {
    if (server.disabled) {
      return; // Don't allow selecting disabled servers
    }

    const isSelected = isServerSelected(server.name);

    if (isSelected) {
      // Remove server
      onSelectionChange(
        selectedServers.filter(s => s.name !== server.name)
      );
    } else {
      // Add server
      onSelectionChange([
        ...selectedServers,
        {
          name: server.name,
          command: server.command,
          args: server.args,
          env: server.env,
          disabled: false,
        },
      ]);
    }
  };

  const totalToolsCount = selectedServers.reduce((acc, selected) => {
    const server = servers?.find(s => s.name === selected.name);
    return acc + (server?.availableTools?.length || 0);
  }, 0);

  if (!servers) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-green-400 mb-2">
          MCP Servers
        </h3>
        <p className="text-sm text-green-600">
          Select which MCP servers your agent can access. These servers provide additional tools and capabilities.
        </p>
      </div>

      {/* Info Panel */}
      {showInfo && (
        <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-2 text-sm text-blue-300">
              <p className="font-semibold text-blue-400">What are MCP Servers?</p>
              <p>
                Model Context Protocol (MCP) servers provide your agent with access to external tools and data sources.
                For example, the AWS Diagram server lets your agent generate architecture diagrams.
              </p>
              <p>
                <strong>How it works:</strong> When you select MCP servers here, they'll be loaded when your agent runs,
                making their tools available for the agent to use.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Bar */}
      <div className="flex items-center justify-between p-4 bg-gray-900/50 border border-green-900/30 rounded-lg">
        <div className="flex items-center gap-3">
          <Server className="w-5 h-5 text-green-400" />
          <div>
            <p className="text-sm font-medium text-green-400">
              {selectedServers.length} server{selectedServers.length !== 1 ? 's' : ''} selected
            </p>
            {totalToolsCount > 0 && (
              <p className="text-xs text-green-600">
                {totalToolsCount} tool{totalToolsCount !== 1 ? 's' : ''} available
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
        >
          <Info className="w-3 h-3" />
          {showInfo ? 'Hide' : 'Show'} Info
        </button>
      </div>

      {/* Server List */}
      {servers.length === 0 ? (
        <div className="bg-gray-900/30 border border-green-900/30 rounded-xl p-12 text-center">
          <Server className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-green-400 mb-2">No MCP Servers</h4>
          <p className="text-green-600 mb-6">
            You haven't added any MCP servers yet. Add servers in the MCP Servers panel to use them with your agents.
          </p>
          <a
            href="/mcp"
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Server className="w-4 h-4" />
            Manage MCP Servers
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {servers.map((server) => {
            const isSelected = isServerSelected(server.name);
            const isDisabled = server.disabled;

            return (
              <button
                key={server._id}
                onClick={() => toggleServer(server)}
                disabled={isDisabled}
                className={`
                  text-left p-4 rounded-lg border-2 transition-all
                  ${isSelected
                    ? 'border-green-500 bg-green-900/20'
                    : 'border-green-900/30 bg-gray-900/50 hover:border-green-700/50'
                  }
                  ${isDisabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer'
                  }
                `}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`
                      w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                      ${isSelected ? 'bg-green-600' : 'bg-green-900/30'}
                    `}>
                      <Server className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-green-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-green-400 truncate">
                        {server.name}
                      </h4>
                      <p className="text-xs text-green-600 mt-1 font-mono truncate">
                        {server.command} {server.args.join(' ')}
                      </p>
                    </div>
                  </div>
                  <div className="ml-2">
                    {isSelected ? (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    ) : (
                      <Circle className="w-6 h-6 text-green-600" />
                    )}
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2 mb-3">
                  <div className={`
                    h-2 w-2 rounded-full
                    ${server.status === 'connected' ? 'bg-green-500' :
                      server.status === 'error' ? 'bg-red-500' :
                      'bg-yellow-500'}
                  `} />
                  <span className={`
                    text-xs
                    ${server.status === 'connected' ? 'text-green-500' :
                      server.status === 'error' ? 'text-red-500' :
                      'text-yellow-500'}
                  `}>
                    {server.status === 'connected' ? 'Connected' :
                     server.status === 'error' ? 'Error' :
                     'Disconnected'}
                  </span>
                  {isDisabled && (
                    <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-400 rounded">
                      Disabled
                    </span>
                  )}
                </div>

                {/* Available Tools */}
                {server.availableTools && server.availableTools.length > 0 && (
                  <div className="border-t border-green-900/30 pt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Wrench className="w-3 h-3 text-green-400" />
                      <span className="text-xs font-medium text-green-400">
                        {server.availableTools.length} tool{server.availableTools.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {server.availableTools.slice(0, 4).map((tool, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-0.5 bg-green-900/30 text-green-400 rounded border border-green-700/30"
                          title={tool.description}
                        >
                          {tool.name}
                        </span>
                      ))}
                      {server.availableTools.length > 4 && (
                        <span className="text-xs px-2 py-0.5 text-green-600">
                          +{server.availableTools.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Selected Servers Summary */}
      {selectedServers.length > 0 && (
        <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-green-400 mb-2">
                Selected MCP Servers
              </p>
              <div className="space-y-1">
                {selectedServers.map((server, idx) => {
                  const fullServer = servers?.find(s => s.name === server.name);
                  const toolCount = fullServer?.availableTools?.length || 0;

                  return (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <Server className="w-3 h-3 text-green-500" />
                      <span className="text-green-300">{server.name}</span>
                      {toolCount > 0 && (
                        <span className="text-xs text-green-600">
                          ({toolCount} tool{toolCount !== 1 ? 's' : ''})
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
