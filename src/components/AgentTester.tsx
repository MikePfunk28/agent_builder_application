import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import type { Id } from "../../convex/_generated/dataModel";
import { DockerSetupGuide } from "./DockerSetupGuide";
import { OllamaSetupGuide } from "./OllamaSetupGuide";
import { ConversationChat } from "./ConversationChat";
import { 
  Play, 
  Square, 
  Terminal, 
  CheckCircle, 
  XCircle, 
  Clock, 
  HardDrive, 
  Loader2,
  RefreshCw,
  History,
  Download,
  Copy,
  BarChart3,
  Eye,
  Zap,
  Brain,
  Globe,
  Star,
  Activity,
  Cpu,
  MemoryStick,
  Network,
  Container,
  Code,
  Settings,
  AlertCircle,
  Layers,
  HelpCircle
} from "lucide-react";

interface AgentTesterProps {
  agentId: Id<"agents">;
  agentCode: string;
  requirements: string;
  dockerfile: string;
  agentName: string;
  modelId: string;
}

interface TestResult {
  success: boolean;
  output?: string;
  error?: string;
  logs: string[];
  metrics?: {
    executionTime: number;
    memoryUsed: number;
    buildTime: number;
  };
  stage: 'build' | 'runtime' | 'completed' | 'service' | 'setup';
  diagram?: {
    mermaid: string;
    description: string;
    components: any;
  };
  modelUsed?: string;
  testEnvironment?: string;
}

export function AgentTester({ agentId, agentCode, requirements, dockerfile, agentName, modelId }: AgentTesterProps) {
  const [testQuery, setTestQuery] = useState("Hello! Can you tell me about your capabilities and process this test message?");
  const [currentTestId, setCurrentTestId] = useState<Id<"testExecutions"> | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showDiagram, setShowDiagram] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [showOllamaGuide, setShowOllamaGuide] = useState(false);

  const submitTest = useMutation(api.testExecution.submitTest);
  const cancelTest = useMutation(api.testExecution.cancelTest);

  // Poll test status while running
  const testStatus = useQuery(
    api.testExecution.getTestById,
    currentTestId ? { testId: currentTestId } : "skip"
  );

  // Get test history
  const testHistoryData = useQuery(api.testExecution.getUserTests, { limit: 10 });

  const isRunning = testStatus?.status === "RUNNING" || testStatus?.status === "QUEUED" || testStatus?.status === "BUILDING";
  const currentLogs = testStatus?.logs || [];

  const handleTest = async () => {
    if (!testQuery.trim()) {
      toast.error("Please enter a test query");
      return;
    }

    setTestResult(null);

    try {
      // Submit test to queue
      const result = await submitTest({
        agentId,
        testQuery,
        timeout: 180000, // 3 minutes
        priority: 2, // Normal priority
      });

      setCurrentTestId(result.testId);
      toast.success(`Test queued! Position: ${result.queuePosition}`);

    } catch (error: any) {
      toast.error(`Failed to submit test: ${error.message}`);
      setTestResult({
        success: false,
        error: `Test submission error: ${error.message}`,
        logs: [],
        stage: 'service'
      });
    }
  };

  // Update test result when test completes
  useEffect(() => {
    if (testStatus) {
      if (testStatus.status === "COMPLETED") {
        setTestResult({
          success: testStatus.success || false,
          output: testStatus.response,
          error: testStatus.error,
          logs: testStatus.logs,
          stage: 'completed',
          metrics: testStatus.executionTime ? {
            executionTime: testStatus.executionTime,
            memoryUsed: testStatus.memoryUsed || 0,
            buildTime: testStatus.buildTime || 0,
          } : undefined,
          modelUsed: modelId,
          testEnvironment: 'ECS Fargate'
        });
        if (testStatus.success) {
          toast.success("🎉 Agent test completed successfully!");
        } else {
          toast.error(`❌ Test failed: ${testStatus.error}`);
        }
      } else if (testStatus.status === "FAILED") {
        setTestResult({
          success: false,
          error: testStatus.error,
          logs: testStatus.logs,
          stage: testStatus.errorStage as any || 'runtime',
          modelUsed: modelId,
          testEnvironment: 'ECS Fargate'
        });
        toast.error(`❌ Test failed: ${testStatus.error}`);
      }
    }
  }, [testStatus, modelId]);

  const handleStop = async () => {
    if (!currentTestId) return;

    try {
      await cancelTest({ testId: currentTestId });
      toast.info("Test cancellation requested");
    } catch (error: any) {
      toast.error(`Failed to cancel test: ${error.message}`);
    }
  };

  const copyLogs = () => {
    const logsText = currentLogs.join('\n');
    navigator.clipboard.writeText(logsText);
    toast.success("Logs copied to clipboard");
  };

  const downloadLogs = () => {
    const logsText = [
      `Agent Test Logs - ${agentName}`,
      `Model: ${modelId}`,
      `Test Query: ${testQuery}`,
      `Timestamp: ${new Date().toISOString()}`,
      '',
      ...currentLogs,
      '',
      testResult ? `Final Result: ${testResult.success ? 'SUCCESS' : 'FAILED'}` : '',
      testResult?.output ? `Response: ${testResult.output}` : '',
      testResult?.error ? `Error: ${testResult.error}` : '',
    ].join('\n');
    
    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${agentName.toLowerCase().replace(/\s+/g, '_')}_test_${Date.now()}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const loadHistory = () => {
    setShowHistory(true);
  };

  const quickTestQueries = [
    "Hello! Can you tell me about your capabilities?",
    "What tools do you have available?",
    "Can you perform a simple calculation: 15 * 23?",
    "Describe your memory and reasoning capabilities",
    "What is your current status and configuration?"
  ];

  return (
    <div className="space-y-6">
      {/* Conversation Chat */}
      <ConversationChat 
        agentId={agentId}
        agentName={agentName}
        modelId={modelId}
      />
      
      {/* Divider */}
      <div className="border-t border-green-900/30 my-6" />
      
      {/* Single Test Section */}
      <div className="bg-gray-900/30 border border-green-900/20 rounded-lg p-4">
        <h4 className="text-sm font-medium text-green-400 mb-2">Single Test Mode</h4>
        <p className="text-xs text-green-600 mb-4">Run a one-time test without conversation history</p>
      </div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-green-400">Test Your Agent</h3>
          <p className="text-green-600 text-sm">
            Execute your agent in a real Docker environment with {modelId.includes(':') ? 'real Ollama connection' : 'real AWS Bedrock API'}
          </p>
        </div>
        <div className="flex gap-2">
          {modelId.includes(':') ? (
            <button
              onClick={() => setShowOllamaGuide(true)}
              className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              Ollama Setup
            </button>
          ) : (
            <button
              onClick={() => setShowSetupGuide(true)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              AWS Setup
            </button>
          )}
          {testResult?.diagram && (
            <button
              onClick={() => setShowDiagram(true)}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              View Diagram
            </button>
          )}
          <button
            onClick={loadHistory}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-green-400 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <History className="w-4 h-4" />
            History
          </button>
        </div>
      </div>

      {/* Quick Test Queries */}
      <div>
        <label className="block text-sm font-medium text-green-400 mb-2">
          Quick Test Queries
        </label>
        <div className="flex flex-wrap gap-2 mb-3">
          {quickTestQueries.map((query, index) => (
            <button
              key={index}
              onClick={() => setTestQuery(query)}
              disabled={isRunning}
              className="px-3 py-1 text-xs bg-gray-800 text-green-400 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {query.substring(0, 30)}...
            </button>
          ))}
        </div>
      </div>

      {/* Test Input */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-green-400 mb-2">
            Test Query
          </label>
          <textarea
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
            placeholder="Enter a message to test your agent with..."
            rows={4}
            className="w-full px-4 py-3 bg-black border border-green-900/30 rounded-lg text-green-400 placeholder-green-600 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-colors resize-none"
            disabled={isRunning}
          />
          <p className="text-xs text-green-600 mt-1">
            💡 Try asking about capabilities, requesting calculations, or testing specific tools
          </p>
        </div>

        <div className="flex gap-3">
          {!isRunning ? (
            <button
              onClick={handleTest}
              disabled={!testQuery.trim()}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Play className="w-4 h-4" />
              Execute Real Docker Test
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Square className="w-4 h-4" />
              Stop Test
            </button>
          )}
          
          <button
            onClick={() => setTestQuery("")}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-3 bg-gray-800 text-green-400 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Test Environment Info */}
      <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
        <h4 className="font-medium text-blue-400 mb-2">🧪 Test Environment</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-blue-300">Model:</span>
            <span className="text-blue-400 ml-2">{modelId}</span>
          </div>
          <div>
            <span className="text-blue-300">Runtime:</span>
            <span className="text-blue-400 ml-2">
              {modelId.includes(':') ? 'Real Ollama API' : 'Real AWS Bedrock API'}
            </span>
          </div>
          <div>
            <span className="text-blue-300">Container:</span>
            <span className="text-blue-400 ml-2">Docker (python:3.11-slim)</span>
          </div>
          <div>
            <span className="text-blue-300">Timeout:</span>
            <span className="text-blue-400 ml-2">2 minutes</span>
          </div>
        </div>
      </div>

      {/* Test Status */}
      {(isRunning || testResult) && (
        <div className="bg-gray-900/50 border border-green-900/30 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {isRunning ? (
                <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
              ) : testResult?.success ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
              <h4 className="font-medium text-green-400">
                {isRunning ? "Executing Real Test..." : testResult?.success ? "Test Completed Successfully" : "Test Failed"}
              </h4>
              {testResult?.testEnvironment && (
                <span className="text-xs bg-blue-900/30 text-blue-400 px-2 py-1 rounded">
                  {testResult.testEnvironment}
                </span>
              )}
            </div>
            
            {currentLogs.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={copyLogs}
                  className="p-2 text-green-600 hover:text-green-400 transition-colors"
                  title="Copy logs"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={downloadLogs}
                  className="p-2 text-green-600 hover:text-green-400 transition-colors"
                  title="Download logs"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Real-time Logs */}
          <div className="bg-black border border-green-900/30 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Terminal className="w-4 h-4 text-green-400" />
              <span className="text-sm font-medium text-green-400">Live Console Output</span>
              {isRunning && (
                <span className="text-xs bg-yellow-900/30 text-yellow-400 px-2 py-1 rounded animate-pulse">
                  LIVE
                </span>
              )}
            </div>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              <AnimatePresence>
                {currentLogs.map((log, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-sm text-green-300 font-mono"
                  >
                    <span className="text-green-600 mr-2">
                      [{new Date().toLocaleTimeString()}]
                    </span>
                    {log}
                  </motion.div>
                ))}
              </AnimatePresence>
              {isRunning && (
                <motion.div
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="text-sm text-green-400 font-mono flex items-center gap-2"
                >
                  <span className="text-green-600">
                    [{new Date().toLocaleTimeString()}]
                  </span>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Executing...
                </motion.div>
              )}
            </div>
          </div>

          {/* Test Results */}
          {testResult && (
            <div className="space-y-4">
              {testResult.success && testResult.output && (
                <div>
                  <h5 className="text-sm font-medium text-green-400 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Agent Response:
                  </h5>
                  <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-4">
                    <p className="text-green-300 whitespace-pre-wrap">{testResult.output}</p>
                  </div>
                </div>
              )}

              {!testResult.success && testResult.error && (
                <div>
                  <h5 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    Error Details:
                  </h5>
                  <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4">
                    <p className="text-red-300 font-mono text-sm whitespace-pre-wrap">{testResult.error}</p>
                  </div>
                </div>
              )}

              {/* Performance Metrics */}
              {testResult.metrics && (
                <div>
                  <h5 className="text-sm font-medium text-green-400 mb-3">Performance Metrics</h5>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-black border border-green-900/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-green-400" />
                        <span className="text-xs text-green-600">Execution Time</span>
                      </div>
                      <div className="text-lg font-semibold text-green-400">
                        {(testResult.metrics.executionTime / 1000).toFixed(2)}s
                      </div>
                    </div>
                    
                    <div className="bg-black border border-green-900/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <HardDrive className="w-4 h-4 text-green-400" />
                        <span className="text-xs text-green-600">Memory Used</span>
                      </div>
                      <div className="text-lg font-semibold text-green-400">
                        {testResult.metrics.memoryUsed}MB
                      </div>
                    </div>
                    
                    <div className="bg-black border border-green-900/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Terminal className="w-4 h-4 text-green-400" />
                        <span className="text-xs text-green-600">Build Time</span>
                      </div>
                      <div className="text-lg font-semibold text-green-400">
                        {(testResult.metrics.buildTime / 1000).toFixed(2)}s
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Test Summary */}
              <div className="bg-gray-900/30 border border-green-900/20 rounded-lg p-4">
                <h5 className="text-sm font-medium text-green-400 mb-2">Test Summary</h5>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-green-600">Model Used:</span>
                    <span className="text-green-400 ml-2">{testResult.modelUsed || modelId}</span>
                  </div>
                  <div>
                    <span className="text-green-600">Environment:</span>
                    <span className="text-green-400 ml-2">{testResult.testEnvironment || 'docker'}</span>
                  </div>
                  <div>
                    <span className="text-green-600">Status:</span>
                    <span className={`ml-2 font-medium ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                      {testResult.success ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                  <div>
                    <span className="text-green-600">Stage:</span>
                    <span className="text-green-400 ml-2">{testResult.stage}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Setup Guide Modals */}
      {showSetupGuide && (
        <DockerSetupGuide 
          modelId={modelId}
          onClose={() => setShowSetupGuide(false)}
        />
      )}

      {showOllamaGuide && (
        <OllamaSetupGuide
          isOpen={showOllamaGuide}
          onClose={() => setShowOllamaGuide(false)}
          modelId={modelId}
        />
      )}

      {/* Implementation Diagram Modal */}
      {showDiagram && testResult?.diagram && (
        <DiagramModal 
          diagram={testResult.diagram}
          onClose={() => setShowDiagram(false)}
        />
      )}

      {/* Test History Modal */}
      {showHistory && (
        <TestHistoryModal
          history={testHistoryData?.tests || []}
          onClose={() => setShowHistory(false)}
          onSelectTest={(test) => {
            setTestQuery(test.testQuery);
            setCurrentTestId(test._id);
            setShowHistory(false);
          }}
        />
      )}
    </div>
  );
}

function DiagramModal({ 
  diagram, 
  onClose 
}: { 
  diagram: any;
  onClose: () => void;
}) {
  const copyDiagram = () => {
    navigator.clipboard.writeText(diagram.mermaid);
    toast.success("Diagram code copied to clipboard");
  };

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
        className="bg-gray-900 border border-green-900/30 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-green-400">Implementation Diagram</h3>
          <div className="flex gap-2">
            <button
              onClick={copyDiagram}
              className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-green-400 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy Mermaid
            </button>
            <button
              onClick={onClose}
              className="text-green-600 hover:text-green-400 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-green-600">{diagram.description}</p>
          
          {/* Diagram Preview */}
          <div className="bg-white rounded-lg p-6">
            <div className="text-center text-gray-600 py-8">
              <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="mb-2">Mermaid Diagram Preview</p>
              <p className="text-sm">Copy the code below and paste it into a Mermaid viewer</p>
            </div>
          </div>
          
          {/* Mermaid Code */}
          <div className="bg-black border border-green-900/30 rounded-lg p-4">
            <pre className="text-green-400 text-sm overflow-x-auto whitespace-pre-wrap">
              {diagram.mermaid}
            </pre>
          </div>

          {/* Component Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-black border border-green-900/30 rounded-lg p-4">
              <h4 className="font-medium text-green-400 mb-2">Model Configuration</h4>
              <div className="space-y-1 text-sm">
                <div><span className="text-green-600">Model:</span> <span className="text-green-400">{diagram.components.model}</span></div>
                <div><span className="text-green-600">Provider:</span> <span className="text-green-400">{diagram.components.provider}</span></div>
              </div>
            </div>
            
            <div className="bg-black border border-green-900/30 rounded-lg p-4">
              <h4 className="font-medium text-green-400 mb-2">Features</h4>
              <div className="space-y-1 text-sm">
                {Object.entries(diagram.components.features).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-green-600">{key}:</span> 
                    <span className={`ml-2 ${value ? 'text-green-400' : 'text-gray-500'}`}>
                      {value ? '✅' : '❌'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tools List */}
          <div className="bg-black border border-green-900/30 rounded-lg p-4">
            <h4 className="font-medium text-green-400 mb-2">Tools ({diagram.components.tools.length})</h4>
            <div className="flex flex-wrap gap-2">
              {diagram.components.tools.map((tool: string, index: number) => (
                <span key={index} className="px-2 py-1 bg-green-900/30 text-green-400 rounded text-sm">
                  {tool}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function TestHistoryModal({ 
  history, 
  onClose, 
  onSelectTest 
}: { 
  history: any[]; 
  onClose: () => void;
  onSelectTest: (test: any) => void;
}) {
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
        className="bg-gray-900 border border-green-900/30 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-green-400">Test History</h3>
          <button
            onClick={onClose}
            className="text-green-600 hover:text-green-400 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          {history.map((test) => (
            <div
              key={test._id}
              className="bg-black border border-green-900/30 rounded-lg p-4 hover:border-green-700/50 cursor-pointer transition-colors"
              onClick={() => onSelectTest(test)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {test.status === "COMPLETED" && test.success ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : test.status === "FAILED" || test.status === "COMPLETED" && !test.success ? (
                    <XCircle className="w-4 h-4 text-red-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-yellow-400" />
                  )}
                  <span className="text-sm text-green-600">
                    {new Date(test.submittedAt).toLocaleString()}
                  </span>
                </div>
                {test.executionTime && (
                  <span className="text-xs text-green-600">
                    {(test.executionTime / 1000).toFixed(2)}s
                  </span>
                )}
              </div>

              <p className="text-green-400 text-sm mb-2 line-clamp-2">
                <strong>Query:</strong> {test.testQuery}
              </p>

              {test.response && (
                <p className="text-green-300 text-xs line-clamp-2">
                  <strong>Response:</strong> {test.response}
                </p>
              )}
              {test.error && (
                <p className="text-red-300 text-xs line-clamp-2">
                  <strong>Error:</strong> {test.error}
                </p>
              )}
            </div>
          ))}
        </div>

        {history.length === 0 && (
          <div className="text-center py-8 text-green-600">
            No test history available
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
