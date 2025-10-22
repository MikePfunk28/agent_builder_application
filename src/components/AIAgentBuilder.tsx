/**
 * AI-Powered Agent Builder
 * Uses Claude Haiku to automatically design optimal agents
 */

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Sparkles, Zap, TrendingUp, DollarSign, Cpu, Target } from "lucide-react";

export function AIAgentBuilder({ onAgentsCreated }: { onAgentsCreated: (agents: any[]) => void }) {
  const [requirement, setRequirement] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const designAgent = useAction(api.metaAgent.designAgent);

  const handleAnalyze = async () => {
    if (!requirement.trim()) {
      toast.error("Please describe what you want your agent to do");
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await designAgent({
        userRequirement: requirement,
        maxBudgetPoints: 300,
      });

      if (response.success) {
        setResult(response);
        toast.success(`Designed ${response.agents.length} optimal agent(s)!`);
      } else {
        toast.error(response.error || "Failed to design agent");
      }
    } catch (error: any) {
      toast.error("Failed to analyze requirements");
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreateAgents = () => {
    if (result?.agents) {
      onAgentsCreated(result.agents);
      toast.success("Agents created! You can now customize them.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-600/30 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-purple-600/20 rounded-lg">
            <Sparkles className="w-6 h-6 text-purple-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-purple-400 mb-2">
              AI-Powered Agent Builder
            </h2>
            <p className="text-purple-300/70 text-sm">
              Describe what you want to accomplish, and our AI will design the optimal agent(s) for you.
              Uses Claude Haiku to analyze requirements and select the best models within your 300-point budget.
            </p>
          </div>
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-gray-900/50 border border-green-900/30 rounded-lg p-6">
        <label className="block text-sm font-medium text-green-400 mb-2">
          What do you want your agent to do?
        </label>
        <textarea
          value={requirement}
          onChange={(e) => setRequirement(e.target.value)}
          placeholder="Example: I need a FedRAMP compliance consultant that can access FedRAMP documentation, analyze security requirements, and provide implementation guidance..."
          rows={6}
          className="w-full px-4 py-3 bg-black border border-green-900/30 rounded-lg text-green-400 placeholder-green-600 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-colors resize-none"
        />

        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || !requirement.trim()}
          className="mt-4 flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isAnalyzing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Analyzing with Claude Haiku...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Design Optimal Agent(s)
            </>
          )}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Analysis Summary */}
          <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-400 mb-3">AI Analysis</h3>
            <p className="text-blue-300 text-sm mb-4">{result.reasoning}</p>

            {/* Budget Display */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-black/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-gray-400">Total Points</span>
                </div>
                <div className="text-2xl font-bold text-green-400">
                  {result.totalPoints}
                </div>
                <div className="text-xs text-gray-500">/ 300 max</div>
              </div>

              <div className="bg-black/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Cpu className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-gray-400">Agents</span>
                </div>
                <div className="text-2xl font-bold text-purple-400">
                  {result.agents.length}
                </div>
                <div className="text-xs text-gray-500">designed</div>
              </div>

              <div className="bg-black/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-gray-400">Efficiency</span>
                </div>
                <div className="text-2xl font-bold text-blue-400">
                  {Math.round((result.totalPoints / 300) * 100)}%
                </div>
                <div className="text-xs text-gray-500">budget used</div>
              </div>
            </div>
          </div>

          {/* Agent Cards */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-green-400">Designed Agents</h3>
            {result.agents.map((agent: any, index: number) => (
              <div
                key={index}
                className="bg-gray-900/50 border border-green-900/30 rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-green-400">{agent.name}</h4>
                    <p className="text-sm text-green-600 font-mono">{agent.model}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-purple-400">
                      {agent.score.totalScore} points
                    </div>
                    <div className="text-xs text-gray-500">
                      Cost: {agent.score.costScore} | Size: {agent.score.sizeScore} | Ability: {agent.score.abilityScore}
                    </div>
                  </div>
                </div>

                <div className="bg-black/50 rounded p-3 mb-3">
                  <div className="text-xs text-gray-400 mb-1">System Prompt:</div>
                  <div className="text-sm text-green-300">{agent.systemPrompt}</div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-yellow-400" />
                    <span className="text-gray-400">
                      ${agent.score.costPerMToken}/M tokens
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-blue-400" />
                    <span className="text-gray-400">
                      {agent.deploymentType === "aws" ? "Bedrock" : "Ollama"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-purple-400" />
                    <span className="text-gray-400">
                      {agent.tools.length} tools
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Create Button */}
          <button
            onClick={handleCreateAgents}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Create These Agents
          </button>
        </div>
      )}
    </div>
  );
}
