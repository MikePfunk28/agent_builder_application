import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import type { Id } from "../../convex/_generated/dataModel";

type AutomationData = {
  prompt: string;
  conversationId?: Id<"interleavedConversations">;
  transcript?: string;
  createdAt: number;
};

export type WorkflowResult = {
  success: boolean;
  workflow: Array<{
    stage: string;
    output: string;
    usage: { inputTokens: number; outputTokens: number };
  }>;
  totalUsage: { inputTokens: number; outputTokens: number };
  finalOutput: string;
};

interface BuilderAutomationContextValue {
  automationData: AutomationData | null;
  workflowResult: WorkflowResult | null;
  setAutomationData: (data: AutomationData | null) => void;
  setWorkflowResult: (result: WorkflowResult | null) => void;
  clearAutomation: () => void;
}

const BuilderAutomationContext = createContext<BuilderAutomationContextValue | undefined>(
  undefined
);

export function BuilderAutomationProvider({ children }: { children: ReactNode }) {
  const [automationData, setAutomationDataState] = useState<AutomationData | null>(null);
  const [workflowResult, setWorkflowResultState] = useState<WorkflowResult | null>(null);

  const value = useMemo<BuilderAutomationContextValue>(
    () => ({
      automationData,
      workflowResult,
      setAutomationData: (data) => {
        setAutomationDataState(data);
        if (!data) {
          setWorkflowResultState(null);
        }
      },
      setWorkflowResult: setWorkflowResultState,
      clearAutomation: () => {
        setAutomationDataState(null);
        setWorkflowResultState(null);
      },
    }),
    [automationData, workflowResult]
  );

  return (
    <BuilderAutomationContext.Provider value={value}>
      {children}
    </BuilderAutomationContext.Provider>
  );
}

export function useBuilderAutomation() {
  const context = useContext(BuilderAutomationContext);
  if (!context) {
    throw new Error("useBuilderAutomation must be used within a BuilderAutomationProvider");
  }
  return context;
}
