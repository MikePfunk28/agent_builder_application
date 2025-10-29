/**
 * AI-Powered Agent Builder with Woz-Style Questions
 * Sequential conversational flow with interleaved reasoning
 */

import { useState, useEffect, useRef } from "react";
import { useAction, useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Sparkles, Send, Brain, Lightbulb, CheckCircle2, ArrowRight } from "lucide-react";
import type { Id } from "../../convex/_generated/dataModel";

export function AIAgentBuilder({ onAgentsCreated }: { onAgentsCreated?: (agents: any[]) => void }) {
  const [currentSessionId, setCurrentSessionId] = useState<Id<"agentBuildSessions"> | null>(null);
  const [initialDescription, setInitialDescription] = useState("");
  const [currentResponse, setCurrentResponse] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const createSession = useMutation(api.automatedAgentBuilder.createBuildSession);
  const processResponse = useAction(api.automatedAgentBuilder.processResponse);
  const generateAgent = useAction(api.automatedAgentBuilder.generateAgentFromSession);
  const session = useQuery(
    api.automatedAgentBuilder.getBuildSession,
    currentSessionId ? { sessionId: currentSessionId } : "skip"
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.conversationHistory]);

  const handleStart = async () => {
    if (!initialDescription.trim()) {
      toast.error("Please describe what you want your agent to do");
      return;
    }

    setIsProcessing(true);
    try {
      const { sessionId } = await createSession({
        initialDescription: initialDescription.trim(),
      });

      setCurrentSessionId(sessionId);
      setHasStarted(true);

      // Process initial description to get first question
      const response = await processResponse({
        sessionId,
        userResponse: initialDescription.trim(),
      });

      if (response.readyToGenerate) {
        toast.success("I have everything I need to build your agent!");
      }
    } catch (error: any) {
      toast.error("Failed to start building session");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendResponse = async () => {
    if (!currentResponse.trim() || !currentSessionId) return;

    setIsProcessing(true);
    const userMessage = currentResponse.trim();
    setCurrentResponse("");

    try {
      const response = await processResponse({
        sessionId: currentSessionId,
        userResponse: userMessage,
      });

      if (response.readyToGenerate) {
        toast.success("Perfect! I have everything I need to build your agent!");
      }
    } catch (error: any) {
      toast.error("Failed to process response");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerate = async () => {
    if (!currentSessionId) return;

    setIsProcessing(true);
    try {
      const result = await generateAgent({
        sessionId: currentSessionId,
      });

      toast.success("Agent generated successfully!");

      // Navigate to manual builder or notify parent
      if (onAgentsCreated) {
        onAgentsCreated([{ id: result.agentId }]);
      }
    } catch (error: any) {
      toast.error("Failed to generate agent");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (hasStarted) {
        handleSendResponse();
      } else {
        handleStart();
      }
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-600/30 rounded-lg p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-purple-600/20 rounded-lg">
            <Sparkles className="w-6 h-6 text-purple-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-purple-400 mb-2">
              AI Agent Builder
            </h2>
            <p className="text-purple-300/70 text-sm">
              Let's build your perfect agent together! I'll ask you a few smart questions to understand exactly what you need.
            </p>
          </div>
        </div>
      </div>

      {/* Chat Interface */}
      {!hasStarted ? (
        /* Initial Input */
        <div className="flex-1 flex flex-col justify-center max-w-3xl mx-auto w-full">
          <div className="bg-gray-900/50 border border-green-900/30 rounded-lg p-6">
            <label className="block text-sm font-medium text-green-400 mb-2">
              What do you want your agent to do?
            </label>
            <textarea
              value={initialDescription}
              onChange={(e) => setInitialDescription(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Example: I need a customer support agent that can handle inquiries about our SaaS product..."
              rows={6}
              className="w-full px-4 py-3 bg-black border border-green-900/30 rounded-lg text-green-400 placeholder-green-600 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-colors resize-none"
            />

            <button
              onClick={handleStart}
              disabled={isProcessing || !initialDescription.trim()}
              className="mt-4 flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Starting...
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  Let's Build!
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Conversation View */
        <div className="flex-1 flex flex-col min-h-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {session?.conversationHistory.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    msg.role === "user"
                      ? "bg-green-900/30 border border-green-600/30"
                      : "bg-blue-900/30 border border-blue-600/30"
                  }`}
                >
                  {/* Show thinking/reasoning for AI messages */}
                  {msg.role === "assistant" && msg.reasoning && (
                    <div className="mb-3 p-3 bg-black/50 rounded border border-purple-600/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-medium text-purple-400">Thinking...</span>
                      </div>
                      <p className="text-xs text-purple-300/70 italic">{msg.reasoning}</p>
                    </div>
                  )}

                  {/* Message content */}
                  <div
                    className={`text-sm whitespace-pre-wrap ${
                      msg.role === "user" ? "text-green-300" : "text-blue-300"
                    }`}
                  >
                    {msg.content}
                  </div>

                  <div className="text-xs text-gray-500 mt-2">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          {session?.status === "ready_to_generate" ? (
            /* Ready to Generate */
            <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-green-400 mb-2">
                    Ready to Generate!
                  </h3>
                  <p className="text-green-300/70 text-sm mb-4">
                    I have all the information I need to build your perfect agent.
                  </p>
                  <button
                    onClick={handleGenerate}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Lightbulb className="w-4 h-4" />
                        Generate Agent
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Continue Conversation */
            <div className="bg-gray-900/50 border border-green-900/30 rounded-lg p-4">
              <div className="flex gap-2">
                <textarea
                  value={currentResponse}
                  onChange={(e) => setCurrentResponse(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Type your answer... (Enter to send, Shift+Enter for new line)"
                  rows={2}
                  className="flex-1 px-4 py-3 bg-black border border-green-900/30 rounded-lg text-green-400 placeholder-green-600 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-colors resize-none"
                />
                <button
                  onClick={handleSendResponse}
                  disabled={isProcessing || !currentResponse.trim()}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isProcessing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
