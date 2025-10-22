/**
 * Interleaved Reasoning Chat Interface
 * Chat with Claude Haiku 4.5 using interleaved thinking
 */

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Send, Brain, Sparkles, MessageSquare, Trash2 } from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";

export function InterleavedChat() {
  const [conversationId, setConversationId] = useState<Id<"interleavedConversations"> | null>(null);
  const [conversationToken, setConversationToken] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<Id<"agents"> | null>(null);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const createConversation = useMutation(api.interleavedReasoning.createConversation);
  const sendMessage = useAction(api.interleavedReasoning.sendMessage);
  const conversations = useQuery(api.interleavedReasoning.getUserConversations, { limit: 10 });
  const agents = useQuery(api.agents.list) || [];
  
  const conversation = useQuery(
    api.interleavedReasoning.getConversation,
    conversationId ? { 
      conversationId, 
      conversationToken: conversationToken || undefined 
    } : "skip"
  );

  const selectedAgent = useQuery(
    api.agents.get,
    selectedAgentId ? { id: selectedAgentId } : "skip"
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages]);

  const handleCreateConversation = async (agentId?: Id<"agents">) => {
    try {
      let title = "New Conversation";
      let systemPrompt = "You are a helpful AI assistant with advanced reasoning capabilities. Use interleaved thinking to break down complex problems and provide thoughtful, well-reasoned responses.";
      
      if (agentId) {
        const agent = agents.find(a => a._id === agentId);
        if (agent) {
          title = `Chat with ${agent.name}`;
          systemPrompt = agent.systemPrompt || systemPrompt;
          setSelectedAgentId(agentId);
        }
      }

      const result = await createConversation({
        title,
        systemPrompt,
      });
      setConversationId(result.conversationId);
      setConversationToken(result.conversationToken || null);
      toast.success(agentId ? `Started chat with ${agents.find(a => a._id === agentId)?.name}` : "New conversation started");
    } catch (error: any) {
      toast.error("Failed to create conversation", {
        description: error.message,
      });
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !conversationId) return;

    setIsSending(true);
    const userMessage = message;
    setMessage("");

    try {
      await sendMessage({
        conversationId,
        conversationToken: conversationToken || undefined,
        message: userMessage,
      });
    } catch (error: any) {
      toast.error("Failed to send message", {
        description: error.message,
      });
      setMessage(userMessage); // Restore message on error
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Sidebar - Agents & Conversations */}
      <div className="w-80 bg-gray-900/50 border border-green-900/30 rounded-xl p-4 overflow-y-auto">
        <button
          onClick={() => void handleCreateConversation()}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg mb-4 flex items-center justify-center gap-2"
        >
          <MessageSquare className="w-4 h-4" />
          New Chat
        </button>

        {/* Your Agents */}
        {agents.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-green-400 mb-2">Chat with Your Agents</h3>
            <div className="space-y-2">
              {agents.map((agent) => (
                <button
                  key={agent._id}
                  onClick={() => void handleCreateConversation(agent._id)}
                  className="w-full text-left p-3 rounded-lg border border-green-900/30 hover:border-green-700/50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Bot className="w-4 h-4 text-green-400" />
                    <div className="text-sm font-medium text-green-400 truncate">
                      {agent.name}
                    </div>
                  </div>
                  <div className="text-xs text-green-600 truncate">
                    {agent.model}
                  </div>
                  <div className="text-xs text-green-600 mt-1 truncate">
                    {agent.tools.length} tools
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent Conversations */}
        <div>
          <h3 className="text-sm font-semibold text-green-400 mb-2">Recent Conversations</h3>
          <div className="space-y-2">
            {conversations?.map((conv) => (
              <button
                key={conv._id}
                onClick={() => {
                  setConversationId(conv._id);
                  setConversationToken(conv.conversationToken || null);
                }}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  conversationId === conv._id
                    ? "bg-green-900/30 border border-green-700/50"
                    : "hover:bg-gray-800/50"
                }`}
              >
                <div className="text-sm font-medium text-green-400 truncate">
                  {conv.title}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  {conv.messages.length} messages
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-900/50 border border-green-900/30 rounded-xl">
        {!conversationId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Brain className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-green-400 mb-2">
                Interleaved Reasoning Chat
              </h2>
              <p className="text-green-600 mb-6">
                Chat with Claude Haiku 4.5 using advanced interleaved thinking
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => void handleCreateConversation()}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center gap-2 mx-auto"
                >
                  <Sparkles className="w-5 h-5" />
                  Start New Conversation
                </button>
                
                {agents.length > 0 && (
                  <div className="text-center">
                    <p className="text-green-600 text-sm mb-3">Or chat with one of your agents:</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {agents.slice(0, 3).map((agent) => (
                        <button
                          key={agent._id}
                          onClick={() => void handleCreateConversation(agent._id)}
                          className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 text-sm"
                        >
                          <Bot className="w-4 h-4" />
                          {agent.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {conversation?.messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      msg.role === "user"
                        ? "bg-green-900/30 border border-green-700/50"
                        : "bg-gray-800/50 border border-gray-700/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {msg.role === "assistant" && (
                        <Brain className="w-4 h-4 text-green-400" />
                      )}
                      <span className="text-xs font-semibold text-green-400">
                        {msg.role === "user" ? "You" : "Assistant"}
                      </span>
                    </div>

                    <div className="text-green-100 whitespace-pre-wrap">
                      {msg.content}
                    </div>

                    {/* Show reasoning if available */}
                    {msg.reasoning && (
                      <details className="mt-3 pt-3 border-t border-green-900/30">
                        <summary className="text-xs text-green-600 cursor-pointer hover:text-green-400 flex items-center gap-2">
                          <Sparkles className="w-3 h-3" />
                          View Reasoning Process
                        </summary>
                        <div className="mt-2 text-sm text-green-600 bg-black/30 rounded p-3 whitespace-pre-wrap">
                          {msg.reasoning}
                        </div>
                      </details>
                    )}

                    {/* Show tool calls if available */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-green-900/30">
                        <div className="text-xs text-green-600 mb-2">Tool Calls:</div>
                        {msg.toolCalls.map((tool: any, i: number) => (
                          <div key={i} className="text-xs bg-black/30 rounded p-2 mb-1">
                            <span className="text-green-400 font-semibold">{tool.name}</span>
                            <pre className="text-green-600 mt-1 text-xs overflow-x-auto">
                              {JSON.stringify(tool.input, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="text-xs text-green-600 mt-2">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}

              {isSending && (
                <div className="flex justify-start">
                  <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400"></div>
                      <span className="text-green-400 text-sm">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Chat Header */}
            {conversation && (
              <div className="border-b border-green-900/30 p-4">
                <div className="flex items-center gap-3">
                  {selectedAgent ? (
                    <>
                      <Bot className="w-6 h-6 text-green-400" />
                      <div>
                        <h2 className="text-lg font-semibold text-green-400">{selectedAgent.name}</h2>
                        <p className="text-sm text-green-600">{selectedAgent.model}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Brain className="w-6 h-6 text-green-400" />
                      <div>
                        <h2 className="text-lg font-semibold text-green-400">{conversation.title}</h2>
                        <p className="text-sm text-green-600">Claude Haiku 4.5 with Interleaved Thinking</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="border-t border-green-900/30 p-4">
              <div className="flex gap-2">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={selectedAgent ? `Chat with ${selectedAgent.name}...` : "Type your message... (Shift+Enter for new line)"}
                  className="flex-1 bg-gray-800 border border-green-900/30 rounded-lg px-4 py-3 text-green-400 placeholder-green-600 focus:outline-none focus:border-green-500 resize-none"
                  rows={3}
                  disabled={isSending}
                />
                <button
                  onClick={() => void handleSendMessage()}
                  disabled={!message.trim() || isSending}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold px-6 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-2 text-xs text-green-600">
                <Sparkles className="w-3 h-3 inline mr-1" />
                {selectedAgent ? `Chatting with ${selectedAgent.name}` : "Powered by Claude Haiku 4.5 with Interleaved Thinking"}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
