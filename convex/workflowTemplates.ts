import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Workflow template definitions
export const workflowTemplates = {
  chainOfThought: {
    id: "chain-of-thought",
    name: "Chain of Thought",
    description: "Break down complex reasoning into sequential steps",
    nodes: [
      { id: "input", type: "input", label: "Problem Input" },
      { id: "step1", type: "reasoning", label: "Step 1: Understand" },
      { id: "step2", type: "reasoning", label: "Step 2: Break Down" },
      { id: "step3", type: "reasoning", label: "Step 3: Solve" },
      { id: "output", type: "output", label: "Final Answer" }
    ],
    edges: [
      { from: "input", to: "step1" },
      { from: "step1", to: "step2" },
      { from: "step2", to: "step3" },
      { from: "step3", to: "output" }
    ]
  },
  
  promptChaining: {
    id: "prompt-chaining",
    name: "Prompt Chaining",
    description: "Chain multiple prompts where each output feeds the next",
    nodes: [
      { id: "input", type: "input", label: "Initial Input" },
      { id: "prompt1", type: "llm", label: "Extract Key Info" },
      { id: "prompt2", type: "llm", label: "Analyze Context" },
      { id: "prompt3", type: "llm", label: "Generate Response" },
      { id: "output", type: "output", label: "Final Output" }
    ],
    edges: [
      { from: "input", to: "prompt1" },
      { from: "prompt1", to: "prompt2" },
      { from: "prompt2", to: "prompt3" },
      { from: "prompt3", to: "output" }
    ]
  },

  parallelPrompts: {
    id: "parallel-prompts",
    name: "Parallel Prompts (Async)",
    description: "Execute multiple prompts in parallel and aggregate results",
    nodes: [
      { id: "input", type: "input", label: "Input" },
      { id: "split", type: "split", label: "Split Task" },
      { id: "prompt1", type: "llm", label: "Perspective 1" },
      { id: "prompt2", type: "llm", label: "Perspective 2" },
      { id: "prompt3", type: "llm", label: "Perspective 3" },
      { id: "aggregate", type: "aggregate", label: "Combine Results" },
      { id: "output", type: "output", label: "Synthesized Output" }
    ],
    edges: [
      { from: "input", to: "split" },
      { from: "split", to: "prompt1" },
      { from: "split", to: "prompt2" },
      { from: "split", to: "prompt3" },
      { from: "prompt1", to: "aggregate" },
      { from: "prompt2", to: "aggregate" },
      { from: "prompt3", to: "aggregate" },
      { from: "aggregate", to: "output" }
    ]
  },

  rag: {
    id: "rag",
    name: "RAG (Retrieval Augmented Generation)",
    description: "Retrieve relevant context before generating response",
    nodes: [
      { id: "input", type: "input", label: "Query" },
      { id: "embed", type: "embedding", label: "Generate Embedding" },
      { id: "retrieve", type: "retrieval", label: "Search Knowledge Base" },
      { id: "rerank", type: "rerank", label: "Rerank Results" },
      { id: "generate", type: "llm", label: "Generate with Context" },
      { id: "output", type: "output", label: "Response" }
    ],
    edges: [
      { from: "input", to: "embed" },
      { from: "embed", to: "retrieve" },
      { from: "retrieve", to: "rerank" },
      { from: "rerank", to: "generate" },
      { from: "input", to: "generate" },
      { from: "generate", to: "output" }
    ]
  },

  react: {
    id: "react",
    name: "ReAct (Reasoning + Acting)",
    description: "Iterative reasoning and action execution loop",
    nodes: [
      { id: "input", type: "input", label: "Task" },
      { id: "thought", type: "reasoning", label: "Thought" },
      { id: "action", type: "tool", label: "Action" },
      { id: "observation", type: "observation", label: "Observation" },
      { id: "decision", type: "decision", label: "Continue?" },
      { id: "output", type: "output", label: "Final Answer" }
    ],
    edges: [
      { from: "input", to: "thought" },
      { from: "thought", to: "action" },
      { from: "action", to: "observation" },
      { from: "observation", to: "decision" },
      { from: "decision", to: "thought", condition: "continue" },
      { from: "decision", to: "output", condition: "done" }
    ]
  },

  selfConsistency: {
    id: "self-consistency",
    name: "Self-Consistency",
    description: "Generate multiple reasoning paths and vote on best answer",
    nodes: [
      { id: "input", type: "input", label: "Problem" },
      { id: "split", type: "split", label: "Generate Paths" },
      { id: "path1", type: "reasoning", label: "Reasoning Path 1" },
      { id: "path2", type: "reasoning", label: "Reasoning Path 2" },
      { id: "path3", type: "reasoning", label: "Reasoning Path 3" },
      { id: "vote", type: "vote", label: "Majority Vote" },
      { id: "output", type: "output", label: "Best Answer" }
    ],
    edges: [
      { from: "input", to: "split" },
      { from: "split", to: "path1" },
      { from: "split", to: "path2" },
      { from: "split", to: "path3" },
      { from: "path1", to: "vote" },
      { from: "path2", to: "vote" },
      { from: "path3", to: "vote" },
      { from: "vote", to: "output" }
    ]
  },

  treeOfThoughts: {
    id: "tree-of-thoughts",
    name: "Tree of Thoughts",
    description: "Explore multiple reasoning branches and select best path",
    nodes: [
      { id: "input", type: "input", label: "Problem" },
      { id: "branch1", type: "reasoning", label: "Approach 1" },
      { id: "branch2", type: "reasoning", label: "Approach 2" },
      { id: "eval1", type: "evaluation", label: "Evaluate 1" },
      { id: "eval2", type: "evaluation", label: "Evaluate 2" },
      { id: "select", type: "selection", label: "Select Best" },
      { id: "expand", type: "reasoning", label: "Expand Solution" },
      { id: "output", type: "output", label: "Final Solution" }
    ],
    edges: [
      { from: "input", to: "branch1" },
      { from: "input", to: "branch2" },
      { from: "branch1", to: "eval1" },
      { from: "branch2", to: "eval2" },
      { from: "eval1", to: "select" },
      { from: "eval2", to: "select" },
      { from: "select", to: "expand" },
      { from: "expand", to: "output" }
    ]
  },

  reflexion: {
    id: "reflexion",
    name: "Reflexion",
    description: "Self-reflection and iterative improvement loop",
    nodes: [
      { id: "input", type: "input", label: "Task" },
      { id: "attempt", type: "llm", label: "Generate Solution" },
      { id: "evaluate", type: "evaluation", label: "Self-Evaluate" },
      { id: "reflect", type: "reflection", label: "Reflect on Errors" },
      { id: "decision", type: "decision", label: "Good Enough?" },
      { id: "output", type: "output", label: "Final Solution" }
    ],
    edges: [
      { from: "input", to: "attempt" },
      { from: "attempt", to: "evaluate" },
      { from: "evaluate", to: "decision" },
      { from: "decision", to: "reflect", condition: "improve" },
      { from: "reflect", to: "attempt" },
      { from: "decision", to: "output", condition: "done" }
    ]
  },

  mapReduce: {
    id: "map-reduce",
    name: "Map-Reduce",
    description: "Process data in parallel chunks then combine results",
    nodes: [
      { id: "input", type: "input", label: "Large Dataset" },
      { id: "split", type: "split", label: "Split into Chunks" },
      { id: "map1", type: "llm", label: "Process Chunk 1" },
      { id: "map2", type: "llm", label: "Process Chunk 2" },
      { id: "map3", type: "llm", label: "Process Chunk 3" },
      { id: "reduce", type: "aggregate", label: "Combine Results" },
      { id: "output", type: "output", label: "Final Summary" }
    ],
    edges: [
      { from: "input", to: "split" },
      { from: "split", to: "map1" },
      { from: "split", to: "map2" },
      { from: "split", to: "map3" },
      { from: "map1", to: "reduce" },
      { from: "map2", to: "reduce" },
      { from: "map3", to: "reduce" },
      { from: "reduce", to: "output" }
    ]
  },

  humanInTheLoop: {
    id: "human-in-the-loop",
    name: "Human-in-the-Loop",
    description: "Request human feedback at critical decision points",
    nodes: [
      { id: "input", type: "input", label: "Task" },
      { id: "draft", type: "llm", label: "Generate Draft" },
      { id: "review", type: "human", label: "Human Review" },
      { id: "decision", type: "decision", label: "Approved?" },
      { id: "revise", type: "llm", label: "Revise Based on Feedback" },
      { id: "output", type: "output", label: "Final Output" }
    ],
    edges: [
      { from: "input", to: "draft" },
      { from: "draft", to: "review" },
      { from: "review", to: "decision" },
      { from: "decision", to: "output", condition: "approved" },
      { from: "decision", to: "revise", condition: "rejected" },
      { from: "revise", to: "review" }
    ]
  }
};

export const getWorkflowTemplates = query({
  handler: async () => {
    return Object.values(workflowTemplates);
  }
});

export const getWorkflowTemplate = query({
  args: { templateId: v.string() },
  handler: async (_, { templateId }) => {
    return workflowTemplates[templateId as keyof typeof workflowTemplates] || null;
  }
});

export const createWorkflowFromTemplate = mutation({
  args: {
    templateId: v.string(),
    name: v.string(),
    userId: v.string()
  },
  handler: async (ctx, { templateId, name, userId }) => {
    const template = workflowTemplates[templateId as keyof typeof workflowTemplates];
    if (!template) throw new Error("Template not found");

    const workflowId = await ctx.db.insert("workflows", {
      name,
      userId,
      templateId: template.id,
      nodes: template.nodes,
      edges: template.edges,
      status: "draft",
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    return { workflowId, workflow: template };
  }
});
