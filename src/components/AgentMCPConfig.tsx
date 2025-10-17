import { useState } from "react";
import { Info, Copy, Check } from "lucide-react";

interface AgentMCPConfigProps {
  exposableAsMCPTool?: boolean;
  mcpToolName?: string;
  mcpInputSchema?: any;
  agentName: string;
  onConfigChange: (config: {
    exposableAsMCPTool: boolean;
    mcpToolName?: string;
    mcpInputSchema?: any;
  }) => void;
}

export function AgentMCPConfig({
  exposableAsMCPTool = false,
  mcpToolName = "",
  mcpInputSchema,
  agentName,
  onConfigChange,
}: AgentMCPConfigProps) {
  const [isExposable, setIsExposable] = useState(exposableAsMCPTool);
  const [toolName, setToolName] = useState(mcpToolName || agentName.toLowerCase().replace(/\s+/g, "_"));
  const [inputSchema, setInputSchema] = useState(
    JSON.stringify(
      mcpInputSchema || {
        type: "object",
        properties: {
          input: {
            type: "string",
            description: "Input to the agent",
          },
        },
        required: ["input"],
      },
      null,
      2
    )
  );
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleExposableChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsExposable(checked);
    if (checked) {
      validateAndUpdate(checked, toolName, inputSchema);
    } else {
      onConfigChange({
        exposableAsMCPTool: false,
        mcpToolName: undefined,
        mcpInputSchema: undefined,
      });
    }
  };

  const handleToolNameChange = (value: string) => {
    setToolName(value);
    if (isExposable) {
      validateAndUpdate(isExposable, value, inputSchema);
    }
  };

  const handleSchemaChange = (value: string) => {
    setInputSchema(value);
    if (isExposable) {
      validateAndUpdate(isExposable, toolName, value);
    }
  };

  const validateAndUpdate = (exposable: boolean, name: string, schema: string) => {
    if (!exposable) {
      onConfigChange({
        exposableAsMCPTool: false,
        mcpToolName: undefined,
        mcpInputSchema: undefined,
      });
      return;
    }

    // Validate JSON schema
    try {
      const parsed = JSON.parse(schema);
      setSchemaError(null);
      onConfigChange({
        exposableAsMCPTool: exposable,
        mcpToolName: name,
        mcpInputSchema: parsed,
      });
    } catch {
      setSchemaError("Invalid JSON schema");
    }
  };

  const mcpEndpoint = `${window.location.origin}/mcp/tools/call`;
  
  const exampleConfig = `{
  "mcpServers": {
    "agent-${toolName}": {
      "command": "curl",
      "args": [
        "-X", "POST",
        "${mcpEndpoint}",
        "-H", "Content-Type: application/json",
        "-d", "{\\"name\\": \\"${toolName}\\", \\"arguments\\": $ARGS}"
      ]
    }
  }
}`;

  const copyToClipboard = () => {
    void navigator.clipboard.writeText(exampleConfig).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-gray-900/50 rounded-xl border border-green-900/30 p-6">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-green-400">MCP Tool Configuration</h3>
        <p className="text-sm text-green-600 mt-1">
          Expose this agent as an MCP tool that can be invoked by other agents or applications
        </p>
      </div>
      <div className="space-y-4">
        {/* Enable MCP Tool */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="exposable"
            checked={isExposable}
            onChange={handleExposableChange}
            className="w-4 h-4 text-green-600 bg-black border-green-900/30 rounded focus:ring-green-400"
          />
          <label htmlFor="exposable" className="text-green-400 cursor-pointer">
            Expose as MCP Tool
          </label>
        </div>

        {isExposable && (
          <>
            {/* Tool Name */}
            <div className="space-y-2">
              <label htmlFor="toolName" className="block text-sm font-medium text-green-400">
                MCP Tool Name
              </label>
              <input
                type="text"
                id="toolName"
                value={toolName}
                onChange={(e) => handleToolNameChange(e.target.value)}
                placeholder="my_agent_tool"
                className="w-full px-4 py-2 bg-black border border-green-900/30 rounded-lg text-green-400 placeholder-green-600 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none"
              />
              <p className="text-sm text-green-600">
                Use lowercase letters, numbers, and underscores only
              </p>
            </div>

            {/* Input Schema */}
            <div className="space-y-2">
              <label htmlFor="inputSchema" className="block text-sm font-medium text-green-400">
                Input Schema (JSON)
              </label>
              <textarea
                id="inputSchema"
                value={inputSchema}
                onChange={(e) => handleSchemaChange(e.target.value)}
                className="w-full min-h-[200px] p-3 font-mono text-sm bg-black border border-green-900/30 rounded-lg text-green-400 placeholder-green-600 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none"
                placeholder='{"type": "object", "properties": {...}}'
              />
              {schemaError && (
                <p className="text-sm text-red-400">{schemaError}</p>
              )}
              <p className="text-sm text-green-600">
                Define the JSON schema for tool input parameters
              </p>
            </div>

            {/* MCP Endpoint Info */}
            <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-2 flex-1">
                  <p className="font-semibold text-blue-400">MCP Endpoint URL:</p>
                  <code className="block p-2 bg-black rounded text-xs break-all text-green-400">
                    {mcpEndpoint}
                  </code>
                  <p className="text-sm text-blue-300">
                    Tool Name: <code className="bg-black px-2 py-1 rounded text-green-400">{toolName}</code>
                  </p>
                </div>
              </div>
            </div>

            {/* Example Configuration */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-green-400">
                  Example MCP Client Configuration
                </label>
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 bg-black rounded-md text-xs overflow-x-auto text-green-400">
                {exampleConfig}
              </pre>
              <p className="text-sm text-green-600">
                Add this configuration to your MCP client's settings to invoke this agent as a tool
              </p>
            </div>

            {/* Connection Instructions */}
            <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="font-semibold text-blue-400">How to use this agent as an MCP tool:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-blue-300">
                    <li>Copy the example configuration above</li>
                    <li>Add it to your MCP client's configuration file</li>
                    <li>Restart your MCP client to load the new tool</li>
                    <li>Invoke the tool with the name: <code className="bg-black px-2 py-1 rounded text-green-400">{toolName}</code></li>
                  </ol>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
