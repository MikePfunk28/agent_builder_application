import React, { useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { 
  X, 
  Play, 
  CheckCircle, 
  XCircle, 
  Save,
  Copy,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

interface MCPToolTesterProps {
  server: {
    _id: Id<"mcpServers">;
    name: string;
    availableTools?: Array<{
      name: string;
      description?: string;
      inputSchema?: any;
    }>;
  };
  onClose: () => void;
}

interface TestResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTime?: number;
}

export function MCPToolTester({ server, onClose }: MCPToolTesterProps) {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [parameters, setParameters] = useState<string>('{}');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [savedTemplates, setSavedTemplates] = useState<Map<string, string>>(new Map());

  const invokeTool = useAction(api.mcpClient.invokeMCPTool);

  const tools = server.availableTools || [];
  const selectedToolData = tools.find(t => t.name === selectedTool);

  const toggleToolExpanded = (toolName: string) => {
    const newExpanded = new Set(expandedTools);
    if (newExpanded.has(toolName)) {
      newExpanded.delete(toolName);
    } else {
      newExpanded.add(toolName);
    }
    setExpandedTools(newExpanded);
  };

  const handleToolSelect = (toolName: string) => {
    setSelectedTool(toolName);
    setTestResult(null);
    
    // Load saved template if exists
    if (savedTemplates.has(toolName)) {
      setParameters(savedTemplates.get(toolName)!);
    } else {
      // Generate default parameters from schema
      const tool = tools.find(t => t.name === toolName);
      if (tool?.inputSchema) {
        setParameters(generateDefaultParameters(tool.inputSchema));
      } else {
        setParameters('{}');
      }
    }
  };

  const generateDefaultParameters = (schema: any): string => {
    if (!schema || !schema.properties) {
      return '{}';
    }

    const defaults: Record<string, any> = {};
    
    Object.entries(schema.properties).forEach(([key, prop]: [string, any]) => {
      if (prop.type === 'string') {
        defaults[key] = prop.default || '';
      } else if (prop.type === 'number' || prop.type === 'integer') {
        defaults[key] = prop.default || 0;
      } else if (prop.type === 'boolean') {
        defaults[key] = prop.default || false;
      } else if (prop.type === 'array') {
        defaults[key] = prop.default || [];
      } else if (prop.type === 'object') {
        defaults[key] = prop.default || {};
      }
    });

    return JSON.stringify(defaults, null, 2);
  };

  const handleTestTool = () => {
    if (!selectedTool) {
      toast.error('Please select a tool to test');
      return;
    }

    // Validate JSON
    let parsedParams;
    try {
      parsedParams = JSON.parse(parameters);
    } catch {
      toast.error('Invalid JSON parameters');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const startTime = Date.now();

    void (async () => {
      try {
        const result = await invokeTool({
          serverName: server.name,
          toolName: selectedTool,
          parameters: parsedParams,
        });

        const executionTime = Date.now() - startTime;

        setTestResult({
          success: true,
          result,
          executionTime,
        });

        toast.success('Tool executed successfully');
      } catch (error: any) {
        const executionTime = Date.now() - startTime;

        setTestResult({
          success: false,
          error: error.message || 'Tool execution failed',
          executionTime,
        });

        toast.error(error.message || 'Tool execution failed');
      } finally {
        setIsTesting(false);
      }
    })();
  };

  const handleSaveTemplate = () => {
    if (!selectedTool) return;

    // Validate JSON before saving
    try {
      JSON.parse(parameters);
      const newTemplates = new Map(savedTemplates);
      newTemplates.set(selectedTool, parameters);
      setSavedTemplates(newTemplates);
      toast.success('Template saved successfully');
    } catch {
      toast.error('Invalid JSON - cannot save template');
    }
  };

  const handleCopyResult = () => {
    if (!testResult) return;

    const textToCopy = testResult.success
      ? JSON.stringify(testResult.result, null, 2)
      : testResult.error || '';

    void navigator.clipboard.writeText(textToCopy);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-green-400">Test MCP Tools</h3>
          <p className="text-sm text-green-600 mt-1">{server.name}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-green-600 hover:text-green-400 hover:bg-green-900/20 rounded-md transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {tools.length === 0 ? (
        <div className="text-center py-12 bg-gray-900/30 border border-green-900/30 rounded-lg">
          <p className="text-green-600">No tools available from this server</p>
          <p className="text-sm text-green-600/70 mt-2">
            Try testing the connection to discover available tools
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tool List */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-green-400 mb-3">
              Available Tools ({tools.length})
            </h4>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {tools.map((tool) => {
                const isExpanded = expandedTools.has(tool.name);
                const isSelected = selectedTool === tool.name;
                const hasSavedTemplate = savedTemplates.has(tool.name);

                return (
                  <div
                    key={tool.name}
                    className={`border rounded-lg transition-all ${
                      isSelected
                        ? 'border-green-500 bg-green-900/20'
                        : 'border-green-900/30 bg-gray-900/30 hover:border-green-700/50'
                    }`}
                  >
                    <div
                      className="p-3 cursor-pointer"
                      onClick={() => handleToolSelect(tool.name)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-green-400 truncate">
                              {tool.name}
                            </span>
                            {hasSavedTemplate && (
                              <span className="text-xs px-1.5 py-0.5 bg-blue-900/30 text-blue-400 rounded border border-blue-700/30">
                                Saved
                              </span>
                            )}
                          </div>
                          {tool.description && (
                            <p className="text-xs text-green-600 mt-1 line-clamp-2">
                              {tool.description}
                            </p>
                          )}
                        </div>
                        {tool.inputSchema && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleToolExpanded(tool.name);
                            }}
                            className="p-1 text-green-600 hover:text-green-400 transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Schema Details */}
                    {isExpanded && tool.inputSchema && (
                      <div className="px-3 pb-3 border-t border-green-900/30">
                        <div className="mt-2">
                          <div className="text-xs font-medium text-green-400 mb-2">
                            Input Schema:
                          </div>
                          <pre className="text-xs text-green-600 bg-black/30 p-2 rounded overflow-x-auto">
                            {JSON.stringify(tool.inputSchema, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Test Interface */}
          <div className="space-y-4">
            {selectedTool ? (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-green-400">
                      Test: {selectedTool}
                    </h4>
                    <button
                      onClick={handleSaveTemplate}
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <Save className="w-3 h-3" />
                      Save Template
                    </button>
                  </div>

                  {selectedToolData?.description && (
                    <p className="text-xs text-green-600 mb-3">
                      {selectedToolData.description}
                    </p>
                  )}

                  <label className="block text-sm font-medium text-green-400 mb-2">
                    Parameters (JSON)
                  </label>
                  <textarea
                    value={parameters}
                    onChange={(e) => setParameters(e.target.value)}
                    rows={12}
                    className="w-full px-3 py-2 bg-black border border-green-900/30 rounded-lg text-green-400 placeholder-green-600 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-colors font-mono text-xs resize-none"
                    placeholder='{"key": "value"}'
                  />
                </div>

                <button
                  onClick={handleTestTool}
                  disabled={isTesting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {isTesting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Testing...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Test Tool
                    </>
                  )}
                </button>

                {/* Test Result */}
                {testResult && (
                  <div
                    className={`p-4 rounded-lg border ${
                      testResult.success
                        ? 'bg-green-900/20 border-green-600/30'
                        : 'bg-red-900/20 border-red-600/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {testResult.success ? (
                          <>
                            <CheckCircle className="w-5 h-5 text-green-400" />
                            <span className="font-medium text-green-400">Success</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-5 h-5 text-red-400" />
                            <span className="font-medium text-red-400">Error</span>
                          </>
                        )}
                        {testResult.executionTime && (
                          <span className="text-xs text-green-600">
                            ({testResult.executionTime}ms)
                          </span>
                        )}
                      </div>
                      <button
                        onClick={handleCopyResult}
                        className="p-1 text-green-600 hover:text-green-400 transition-colors"
                        title="Copy to clipboard"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="bg-black/30 rounded p-3 max-h-[300px] overflow-y-auto">
                      <pre className={`text-xs font-mono whitespace-pre-wrap break-words ${
                        testResult.success ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {testResult.success
                          ? JSON.stringify(testResult.result, null, 2)
                          : testResult.error
                        }
                      </pre>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[400px] text-center">
                <div>
                  <Play className="w-12 h-12 text-green-600 mx-auto mb-3" />
                  <p className="text-green-600">Select a tool to test</p>
                  <p className="text-sm text-green-600/70 mt-1">
                    Choose a tool from the list to configure and test it
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
