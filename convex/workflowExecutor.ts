import { v } from "convex/values";
import { action } from "./_generated/server";

export const executeWorkflow = action({
  args: {
    workflowId: v.id("workflows"),
    input: v.any()
  },
  handler: async (ctx, { workflowId, input }) => {
    // Mock workflow for now - would query from database
    const workflow: any = { nodes: [], edges: [] };
    // if (!workflow) throw new Error("Workflow not found");

    const nodeResults = new Map<string, any>();
    const executionLog: any[] = [];

    // Execute nodes in topological order
    const executeNode = async (nodeId: string): Promise<any> => {
      if (nodeResults.has(nodeId)) return nodeResults.get(nodeId);

      const node = workflow.nodes.find((n: any) => n.id === nodeId);
      if (!node) throw new Error(`Node ${nodeId} not found`);

      // Get inputs from predecessor nodes
      const predecessors = workflow.edges
        .filter((e: any) => e.to === nodeId)
        .map((e: any) => e.from);
      
      const inputs = await Promise.all(
        predecessors.map((predId: string) => executeNode(predId))
      );

      // Execute node based on type
      let result;
      const startTime = Date.now();

      switch (node.type) {
        case "input":
          result = input;
          break;

        case "llm":
        case "reasoning":
          result = await executeLLMNode(node, inputs);
          break;

        case "tool":
        case "action":
          result = await executeToolNode(node, inputs);
          break;

        case "split":
          result = inputs[0]; // Pass through for parallel execution
          break;

        case "aggregate":
        case "vote":
          result = await aggregateResults(inputs, node.type);
          break;

        case "decision":
          result = await makeDecision(inputs, node);
          break;

        case "embedding":
          result = await generateEmbedding(inputs[0]);
          break;

        case "retrieval":
          result = await retrieveContext(inputs[0]);
          break;

        case "rerank":
          result = await rerankResults(inputs[0]);
          break;

        case "human":
          result = await requestHumanInput(node, inputs);
          break;

        case "output":
          result = inputs[0];
          break;

        default:
          result = inputs[0];
      }

      nodeResults.set(nodeId, result);
      executionLog.push({
        nodeId,
        nodeType: node.type,
        nodeLabel: node.label,
        duration: Date.now() - startTime,
        timestamp: Date.now()
      });

      return result;
    };

    // Find output node and execute workflow
    const outputNode = workflow.nodes.find((n: any) => n.type === "output");
    if (!outputNode) throw new Error("No output node found");

    const finalResult = await executeNode(outputNode.id);

    return {
      result: finalResult,
      executionLog,
      duration: executionLog.reduce((sum, log) => sum + log.duration, 0)
    };
  }
});

async function executeLLMNode(node: any, inputs: any[]) {
  // Call LLM with node configuration and inputs
  return `LLM result for ${node.label}: ${JSON.stringify(inputs)}`;
}

async function executeToolNode(node: any, inputs: any[]) {
  // Execute tool with inputs
  return `Tool result for ${node.label}: ${JSON.stringify(inputs)}`;
}

async function aggregateResults(inputs: any[], type: string) {
  if (type === "vote") {
    // Majority voting
    const counts = new Map<string, number>();
    inputs.forEach(input => {
      const key = JSON.stringify(input);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const winner = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    return JSON.parse(winner[0]);
  }
  // Default aggregation
  return inputs;
}

async function makeDecision(inputs: any[], node: any) {
  // Simple decision logic
  return { decision: "continue", data: inputs[0] };
}

async function generateEmbedding(input: any) {
  // Generate embedding vector
  return { embedding: [0.1, 0.2, 0.3], text: input };
}

async function retrieveContext(embedding: any) {
  // Retrieve relevant context from knowledge base
  return { contexts: ["context1", "context2"], query: embedding };
}

async function rerankResults(results: any) {
  // Rerank retrieved results
  return results;
}

async function requestHumanInput(node: any, inputs: any[]) {
  // Request human feedback (would integrate with UI)
  return { approved: true, feedback: "", data: inputs[0] };
}
