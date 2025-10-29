import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import type { Id } from "../../convex/_generated/dataModel";
import { Send, Loader2, User, Bot, Trash2, Download, Wrench, BarChart3, CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface ConversationChatProps {
  agentId: Id<"agents">;
  agentName: string;
  modelId: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export function ConversationChat({ agentId, agentName, modelId }: ConversationChatProps) {
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<Id<"conversations"> | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentAgentIdRef = useRef<Id<"agents">>(agentId);

  const createConversation = useMutation(api.conversations.create);
  const sendMessage = useMutation(api.conversations.sendMessage);
  const clearConversation = useMutation(api.conversations.clear);
  const analyzeConversation = useAction(api.conversationAnalysis.analyzeConversation);
  const generateImprovementPlan = useAction(api.conversationAnalysis.generateImprovementPlan);
  const autoImproveAgent = useAction(api.agentImprovement.autoImproveAgent);

  // Get the most recent conversation for this agent
  const recentConversations = useQuery(
    api.conversations.listConversations,
    { agentId, limit: 1 }
  );

  const conversation = useQuery(
    api.conversations.get,
    conversationId ? { conversationId } : "skip"
  );

  const existingAnalysis = useQuery(
    api.conversationAnalysis.getAnalysis,
    conversationId ? { conversationId } : "skip"
  );

  const messages: Message[] = conversation?.messages || [];

  // CRITICAL: Reset conversation when agent changes
  useEffect(() => {
    if (currentAgentIdRef.current !== agentId) {
      console.log(`🔄 Agent switched from ${currentAgentIdRef.current} to ${agentId}`);

      // Reset conversation state
      setConversationId(null);
      setShowAnalysis(false);
      setInput("");

      // Load most recent conversation for new agent (if exists)
      if (recentConversations && recentConversations.length > 0) {
        const latestConv = recentConversations[0];
        if (latestConv.messages && latestConv.messages.length > 0) {
          console.log(`📝 Loading existing conversation: ${latestConv._id}`);
          setConversationId(latestConv._id);
        }
      }

      currentAgentIdRef.current = agentId;
    }
  }, [agentId, recentConversations]);

  // Verify conversation belongs to current agent
  useEffect(() => {
    if (conversation && conversation.agentId !== agentId) {
      console.error(`⚠️ MISMATCH: Conversation belongs to agent ${conversation.agentId}, but viewing agent ${agentId}`);
      toast.error("Conversation mismatch detected. Resetting...");
      setConversationId(null);
    }
  }, [conversation, agentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    setInput("");
    setIsProcessing(true);

    try {
      // Create conversation if doesn't exist
      if (!conversationId) {
        const newConvId = await createConversation({
          agentId,
          title: userMessage.substring(0, 50),
        });
        setConversationId(newConvId);
        
        // Send first message
        await sendMessage({
          conversationId: newConvId,
          message: userMessage,
        });
      } else {
        // Send message to existing conversation
        await sendMessage({
          conversationId,
          message: userMessage,
        });
      }
    } catch (error: any) {
      toast.error(`Failed to send message: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = async () => {
    if (!conversationId) return;
    
    try {
      await clearConversation({ conversationId });
      setConversationId(null);
      toast.success("Conversation cleared");
    } catch (error: any) {
      toast.error(`Failed to clear: ${error.message}`);
    }
  };

  const handleExport = () => {
    const text = messages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAnalyze = async () => {
    if (!conversationId || messages.length < 2) {
      toast.error("Need at least one exchange to analyze");
      return;
    }

    setIsAnalyzing(true);
    try {
      await analyzeConversation({ conversationId });
      setShowAnalysis(true);
      toast.success("Conversation analyzed successfully!");
    } catch (error: any) {
      toast.error(`Analysis failed: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSendToBuilder = async () => {
    if (!conversationId) {
      toast.error("No conversation to analyze");
      return;
    }

    // CRITICAL: Verify conversation belongs to current agent
    if (conversation && conversation.agentId !== agentId) {
      toast.error(`Cannot improve agent ${agentName}. This conversation belongs to a different agent.`);
      console.error(`⚠️ BLOCKED: Conversation ${conversationId} belongs to agent ${conversation.agentId}, not ${agentId}`);
      return;
    }

    setIsAnalyzing(true);
    try {
      console.log(`🔧 Improving agent ${agentId} using conversation ${conversationId}`);

      // Auto-improve agent (analyzes + applies changes)
      const result = await autoImproveAgent({
        agentId,
        conversationId,
      });

      toast.success("Agent improved successfully!", {
        description: `Applied ${result.changes.length} improvements to ${agentName}`,
        duration: 5000,
      });

      console.log("✅ Improvement Result:", result);

      // Show what changed
      if (result.changes.length > 0) {
        toast.info("Changes applied:", {
          description: result.changes.slice(0, 3).join(", "),
          duration: 8000,
        });
      }
    } catch (error: any) {
      toast.error(`Failed to improve agent: ${error.message}`);
      console.error("Improvement error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-gray-900/50 border border-green-900/30 rounded-xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-green-900/30">
        <div>
          <h3 className="text-lg font-semibold text-green-400">Chat with {agentName}</h3>
          <p className="text-xs text-green-600">Model: {modelId}</p>
          <p className="text-xs text-green-500 mt-1">Strandsagents Conversation Manager &mdash; testing sandbox for your built agent.</p>
        </div>
        <div className="flex gap-2">
          {messages.length > 0 && (
            <>
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors text-sm"
                title="Analyze conversation for improvements"
              >
                {isAnalyzing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <BarChart3 className="w-4 h-4" />
                )}
                Analyze
              </button>
              <button
                onClick={handleSendToBuilder}
                disabled={isAnalyzing}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
                title="Send to Agent Builder for automatic improvement"
              >
                {isAnalyzing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wrench className="w-4 h-4" />
                )}
                Improve Agent
              </button>
              <button
                onClick={handleExport}
                className="p-2 text-green-600 hover:text-green-400 transition-colors"
                title="Export conversation"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={handleClear}
                className="p-2 text-red-600 hover:text-red-400 transition-colors"
                title="Clear conversation"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-green-300"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p className="text-xs opacity-60 mt-1">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </p>
              </div>

              {message.role === "user" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <Loader2 className="w-4 h-4 text-green-400 animate-spin" />
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Analysis Panel */}
      {showAnalysis && existingAnalysis && (
        <div className="border-t border-green-900/30 p-4 bg-gray-900/70 max-h-[300px] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-green-400 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Conversation Analysis
            </h4>
            <button
              onClick={() => setShowAnalysis(false)}
              className="text-green-600 hover:text-green-400 text-sm"
            >
              Hide
            </button>
          </div>

          <div className="space-y-3 text-sm">
            {/* Metrics */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-black/50 border border-green-900/30 rounded p-2">
                <div className="text-green-600 text-xs">Messages</div>
                <div className="text-green-400 font-semibold">
                  {existingAnalysis.analysis.conversationMetrics.totalMessages}
                </div>
              </div>
              <div className="bg-black/50 border border-green-900/30 rounded p-2">
                <div className="text-green-600 text-xs">Issues</div>
                <div className="text-red-400 font-semibold">
                  {existingAnalysis.analysis.identifiedIssues.length}
                </div>
              </div>
              <div className="bg-black/50 border border-green-900/30 rounded p-2">
                <div className="text-green-600 text-xs">Successes</div>
                <div className="text-green-400 font-semibold">
                  {existingAnalysis.analysis.successfulInteractions.length}
                </div>
              </div>
            </div>

            {/* Issues */}
            {existingAnalysis.analysis.identifiedIssues.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-red-400 mb-2 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  Issues Detected
                </h5>
                <div className="space-y-1">
                  {existingAnalysis.analysis.identifiedIssues.slice(0, 3).map((issue: any, idx: number) => (
                    <div key={idx} className="text-xs bg-red-900/20 border border-red-700/30 rounded p-2">
                      <div className="font-medium text-red-300">{issue.type.replace('_', ' ')}</div>
                      <div className="text-red-400 opacity-80">{issue.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {existingAnalysis.analysis.suggestedImprovements.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-blue-400 mb-2 flex items-center gap-1">
                  <Wrench className="w-3 h-3" />
                  Suggested Improvements
                </h5>
                <div className="space-y-1">
                  {existingAnalysis.analysis.suggestedImprovements.slice(0, 3).map((suggestion: any, idx: number) => (
                    <div key={idx} className="text-xs bg-blue-900/20 border border-blue-700/30 rounded p-2">
                      <div className="font-medium text-blue-300">{suggestion.description}</div>
                      <div className="text-blue-400 opacity-80 mt-1">{suggestion.implementation}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-green-900/30">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Type your message..."
            disabled={isProcessing}
            className="flex-1 px-4 py-2 bg-black border border-green-900/30 rounded-lg text-green-400 placeholder-green-600 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-colors disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-xs text-green-600 mt-2">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
