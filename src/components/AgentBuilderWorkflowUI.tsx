/**
 * Agent Builder Workflow UI
 * 
 * Provides interface for multi-stage agent building with real-time progress
 */

import React, { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface WorkflowStage {
  name: string;
  title: string;
  description: string;
  status: "pending" | "running" | "complete" | "error";
  output?: string;
  error?: string;
}

const WORKFLOW_STAGES: Omit<WorkflowStage, "status">[] = [
  {
    name: "requirements",
    title: "Requirements Analysis",
    description: "Understanding what you want to build",
  },
  {
    name: "architecture",
    title: "Architecture Design",
    description: "Designing the optimal agent structure",
  },
  {
    name: "ast_analysis",
    title: "Codebase Analysis",
    description: "Analyzing existing code patterns and dependencies",
  },
  {
    name: "tool_design",
    title: "Tool Design",
    description: "Creating necessary tools and integrations",
  },
  {
    name: "implementation",
    title: "Implementation Planning",
    description: "Planning the code structure",
  },
  {
    name: "test_generation",
    title: "Test Generation",
    description: "Building tests from the plan to constrain code",
  },
  {
    name: "code_generation",
    title: "Code Generation",
    description: "Generating production-ready code",
  },
  {
    name: "validation",
    title: "Testing & Validation",
    description: "Validating the implementation",
  },
  {
    name: "verification",
    title: "Verification",
    description: "Verifying build against tests and requirements",
  },
];

interface AgentBuilderWorkflowUIProps {
  conversationId?: Id<"interleavedConversations">;
  onComplete?: (result: any) => void;
}

export function AgentBuilderWorkflowUI({
  conversationId,
  onComplete,
}: AgentBuilderWorkflowUIProps) {
  const [userRequest, setUserRequest] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [stages, setStages] = useState<WorkflowStage[]>(
    WORKFLOW_STAGES.map((s) => ({ ...s, status: "pending" as const }))
  );
  const [currentStage, setCurrentStage] = useState(0);

  const executeWorkflow = useMutation(api.agentBuilderWorkflow.executeCompleteWorkflow);

  const handleStartWorkflow = async () => {
    if (!userRequest.trim()) {
      alert("Please describe the agent you want to build");
      return;
    }

    setIsRunning(true);
    setCurrentStage(0);

    try {
      // Execute workflow with progress updates
      const result = await executeWorkflow({
        userRequest,
        conversationId,
      });

      // Update stages with results
      const updatedStages = stages.map((stage, index) => ({
        ...stage,
        status: "complete" as const,
        output: result.workflow[index]?.output || "",
      }));

      setStages(updatedStages);
      setCurrentStage(stages.length);

      if (onComplete) {
        onComplete(result);
      }
    } catch (error) {
      console.error("Workflow error:", error);
      
      // Mark current stage as error
      const updatedStages = [...stages];
      updatedStages[currentStage] = {
        ...updatedStages[currentStage],
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      };
      setStages(updatedStages);
    } finally {
      setIsRunning(false);
    }
  };

  const getStageIcon = (status: WorkflowStage["status"]) => {
    switch (status) {
      case "pending":
        return "⏳";
      case "running":
        return "🔄";
      case "complete":
        return "✅";
      case "error":
        return "❌";
    }
  };

  return (
    <div className="agent-builder-workflow">
      <div className="workflow-header">
        <h2>🤖 Agent Builder Workflow</h2>
        <p>
          Build intelligent, production-ready agents through a structured
          multi-stage process
        </p>
      </div>

      <div className="workflow-input">
        <label htmlFor="agent-request">
          Describe the agent you want to build:
        </label>
        <textarea
          id="agent-request"
          value={userRequest}
          onChange={(e) => setUserRequest(e.target.value)}
          placeholder="Example: Build an agent that helps users analyze financial data, generate reports, and provide investment recommendations. It should integrate with financial APIs and use RAG for company research."
          rows={6}
          disabled={isRunning}
        />
        <button
          onClick={handleStartWorkflow}
          disabled={isRunning || !userRequest.trim()}
          className="start-workflow-btn"
        >
          {isRunning ? "Building Agent..." : "Start Building"}
        </button>
      </div>

      <div className="workflow-stages">
        {stages.map((stage, index) => (
          <div
            key={stage.name}
            className={`workflow-stage ${stage.status} ${
              index === currentStage ? "current" : ""
            }`}
          >
            <div className="stage-header">
              <span className="stage-icon">{getStageIcon(stage.status)}</span>
              <div className="stage-info">
                <h3>{stage.title}</h3>
                <p>{stage.description}</p>
              </div>
            </div>

            {stage.status === "running" && (
              <div className="stage-progress">
                <div className="progress-bar">
                  <div className="progress-fill"></div>
                </div>
                <p>Processing...</p>
              </div>
            )}

            {stage.status === "complete" && stage.output && (
              <div className="stage-output">
                <details>
                  <summary>View Output</summary>
                  <pre>{stage.output}</pre>
                </details>
              </div>
            )}

            {stage.status === "error" && stage.error && (
              <div className="stage-error">
                <p>❌ Error: {stage.error}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {currentStage === stages.length && !isRunning && (
        <div className="workflow-complete">
          <h3>🎉 Agent Built Successfully!</h3>
          <p>
            Your agent is ready for testing and deployment. Review the generated
            code and configuration files.
          </p>
          <div className="workflow-actions">
            <button className="btn-primary">Test Agent</button>
            <button className="btn-secondary">Download Files</button>
            <button className="btn-secondary">Deploy to AWS</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .agent-builder-workflow {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }

        .workflow-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .workflow-header h2 {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }

        .workflow-header p {
          color: #666;
        }

        .workflow-input {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 2rem;
        }

        .workflow-input label {
          display: block;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .workflow-input textarea {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-family: inherit;
          font-size: 0.95rem;
          resize: vertical;
        }

        .start-workflow-btn {
          margin-top: 1rem;
          padding: 0.75rem 2rem;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .start-workflow-btn:hover:not(:disabled) {
          background: #0056b3;
        }

        .start-workflow-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .workflow-stages {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .workflow-stage {
          background: white;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          padding: 1.5rem;
          transition: all 0.3s;
        }

        .workflow-stage.current {
          border-color: #007bff;
          box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
        }

        .workflow-stage.complete {
          border-color: #28a745;
        }

        .workflow-stage.error {
          border-color: #dc3545;
        }

        .stage-header {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .stage-icon {
          font-size: 2rem;
        }

        .stage-info h3 {
          margin: 0 0 0.25rem 0;
          font-size: 1.25rem;
        }

        .stage-info p {
          margin: 0;
          color: #666;
          font-size: 0.9rem;
        }

        .stage-progress {
          margin-top: 1rem;
        }

        .progress-bar {
          height: 4px;
          background: #e0e0e0;
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 0.5rem;
        }

        .progress-fill {
          height: 100%;
          background: #007bff;
          animation: progress 2s ease-in-out infinite;
        }

        @keyframes progress {
          0% {
            width: 0%;
          }
          50% {
            width: 70%;
          }
          100% {
            width: 100%;
          }
        }

        .stage-output {
          margin-top: 1rem;
        }

        .stage-output details {
          cursor: pointer;
        }

        .stage-output summary {
          font-weight: 600;
          color: #007bff;
          padding: 0.5rem;
          background: #f8f9fa;
          border-radius: 4px;
        }

        .stage-output pre {
          margin-top: 0.5rem;
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 4px;
          overflow-x: auto;
          font-size: 0.85rem;
          line-height: 1.5;
        }

        .stage-error {
          margin-top: 1rem;
          padding: 1rem;
          background: #fff5f5;
          border-left: 4px solid #dc3545;
          border-radius: 4px;
        }

        .stage-error p {
          margin: 0;
          color: #dc3545;
        }

        .workflow-complete {
          background: #d4edda;
          border: 2px solid #28a745;
          border-radius: 8px;
          padding: 2rem;
          text-align: center;
          margin-top: 2rem;
        }

        .workflow-complete h3 {
          margin: 0 0 0.5rem 0;
          color: #155724;
        }

        .workflow-complete p {
          margin: 0 0 1.5rem 0;
          color: #155724;
        }

        .workflow-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        .btn-primary,
        .btn-secondary {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 4px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #28a745;
          color: white;
        }

        .btn-primary:hover {
          background: #218838;
        }

        .btn-secondary {
          background: white;
          color: #007bff;
          border: 2px solid #007bff;
        }

        .btn-secondary:hover {
          background: #007bff;
          color: white;
        }
      `}</style>
    </div>
  );
}
