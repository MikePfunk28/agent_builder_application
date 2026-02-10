import type {
  WorkflowNode,
  WorkflowEdge,
  PromptTextConfig,
  PromptConfig,
  ModelConfig,
  ModelSetConfig,
  PromptRole,
} from "../types/workflowNodes";

export interface BedrockMessage {
  role: "user" | "assistant";
  content: Array<{ text: string }>;
}

export interface OllamaMessage {
  role: string;
  content: string;
}

export interface ComposedMessages {
  kind: "bedrock" | "ollama" | "tool-only";
  bedrock?: {
    modelId: string;
    messages: BedrockMessage[];
    inferenceConfig: {
      temperature?: number;
      topP?: number;
      maxTokens?: number;
    };
  };
  ollama?: {
    endpoint: string;
    model: string;
    messages: OllamaMessage[];
  };
  promptValidator?: PromptConfig["validator"];
  metadata?: {
    promptId?: string;
    modelNodeId?: string;
    modelSetId?: string;
  };
}

function renderTemplate(
  template: string,
  inputs?: Record<string, string>,
  runtimeInputs?: Record<string, string>
): string {
  const merged = { ...(inputs || {}), ...(runtimeInputs || {}) };
  return template.replace(/{{\s*([\w.-]+)\s*}}/g, (_, key) => {
    return merged[key] ?? `{{${key}}}`;
  });
}

type NodeMap = Map<string, WorkflowNode>;

function buildNodeMap(nodes: WorkflowNode[]): NodeMap {
  return new Map(nodes.map((node) => [node.id, node]));
}

function getIncoming(
  nodeId: string,
  edges: WorkflowEdge[],
  nodeMap: NodeMap
): WorkflowNode[] {
  return edges
    .filter((edge) => edge.target === nodeId)
    .map((edge) => nodeMap.get(edge.source))
    .filter((node): node is WorkflowNode => Boolean(node));
}

function getOutgoing(
  nodeId: string,
  edges: WorkflowEdge[],
  nodeMap: NodeMap
): WorkflowNode[] {
  return edges
    .filter((edge) => edge.source === nodeId)
    .map((edge) => nodeMap.get(edge.target))
    .filter((node): node is WorkflowNode => Boolean(node));
}

function sortByPosition(nodes: WorkflowNode[]): WorkflowNode[] {
  return [...nodes].sort((a, b) => {
    const ay = a.position?.y ?? 0;
    const by = b.position?.y ?? 0;
    if (ay !== by) return ay - by;
    const ax = a.position?.x ?? 0;
    const bx = b.position?.x ?? 0;
    return ax - bx;
  });
}

function gatherPromptMessages(
  prompt: WorkflowNode,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  nodeMap: NodeMap,
  runtimeInputs?: Record<string, string>
): {
  messages: Array<{ role: PromptRole; text: string }>;
  validator?: PromptConfig["validator"];
} {
  const incoming = getIncoming(prompt.id, edges, nodeMap);
  const backgrounds = sortByPosition(
    incoming.filter((node) => node.data.type === "Background")
  );
  const contexts = sortByPosition(
    incoming.filter((node) => node.data.type === "Context")
  );
  const outputs = sortByPosition(
    incoming.filter((node) => node.data.type === "OutputIndicator")
  );
  const promptTexts = sortByPosition(
    incoming.filter((node) => node.data.type === "PromptText")
  );

  const segments: string[] = [];
  if (backgrounds.length > 0) {
    segments.push(
      backgrounds
        .map((node) => (node.data as any).config.text)
        .filter(Boolean)
        .join("\n\n")
    );
  }
  if (contexts.length > 0) {
    segments.push(
      contexts
        .map((node) => (node.data as any).config.text)
        .filter(Boolean)
        .join("\n\n")
    );
  }
  if (outputs.length > 0) {
    segments.push(
      outputs
        .map((node) => (node.data as any).config.text)
        .filter(Boolean)
        .join("\n\n")
    );
  }

  const messages: Array<{ role: PromptRole; text: string }> = [];

  const systemPrelude = segments.join("\n\n").trim();
  if (systemPrelude) {
    messages.push({ role: "system", text: systemPrelude });
  }

  promptTexts.forEach((node) => {
    const cfg = (node.data as any).config as PromptTextConfig;
    const role = cfg.role ?? "system";
    const rendered = renderTemplate(cfg.template, cfg.inputs, runtimeInputs);
    messages.push({ role, text: rendered });
  });

  // If there were no prompt text nodes, fall back to prompt label/config notes
  if (messages.length === 0) {
    const fallback = prompt.data.label || "Provide a response.";
    messages.push({ role: "system", text: fallback });
  }

  const promptConfig = (prompt.data as any).config as PromptConfig;
  return { messages, validator: promptConfig?.validator };
}

function resolveModelFromSet(
  modelSet: WorkflowNode,
  edges: WorkflowEdge[],
  nodeMap: NodeMap
):
  | {
      config: ModelConfig;
      modelNode: WorkflowNode;
    }
  | undefined {
  const config = modelSet.data.config as ModelSetConfig;
  if (config.strategy !== "single") {
    throw new Error(`Model strategy "${config.strategy}" is not supported yet.`);
  }

  if (config.primary) {
    const primaryNode = nodeMap.get(config.primary);
    if (primaryNode && primaryNode.data.type === "Model") {
      return {
        config: primaryNode.data.config as ModelConfig,
        modelNode: primaryNode,
      };
    }
  }

  const incomingModels = getIncoming(modelSet.id, edges, nodeMap).filter(
    (node) => node.data.type === "Model"
  );

  if (incomingModels.length === 0) {
    return undefined;
  }

  const modelNode = incomingModels[0];
  return { config: modelNode.data.config as ModelConfig, modelNode };
}

function resolveModel(
  prompt: WorkflowNode,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  nodeMap: NodeMap
):
  | {
      config: ModelConfig;
      modelNode: WorkflowNode;
      modelSetNode?: WorkflowNode;
    }
  | undefined {
  const outgoing = getOutgoing(prompt.id, edges, nodeMap);

  const modelSet = outgoing.find((node) => node.data.type === "ModelSet");
  if (modelSet) {
    const resolved = resolveModelFromSet(modelSet, edges, nodeMap);
    if (resolved) {
      return { ...resolved, modelSetNode: modelSet };
    }
  }

  const directModel = outgoing.find((node) => node.data.type === "Model");
  if (directModel) {
    return {
      config: directModel.data.config as ModelConfig,
      modelNode: directModel,
    };
  }

  const anyModel = nodes.find((node) => node.data.type === "Model");
  if (anyModel) {
    return { config: anyModel.data.config as ModelConfig, modelNode: anyModel };
  }

  return undefined;
}

export function composeWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  options?: {
    promptId?: string;
    runtimeInputs?: Record<string, string>;
  }
): ComposedMessages {
  if (!nodes.length) {
    throw new Error("Workflow is empty");
  }

  const nodeMap = buildNodeMap(nodes);
  const promptCandidates = nodes.filter(
    (node) => node.data.type === "Prompt"
  );
  if (promptCandidates.length === 0) {
    throw new Error("At least one Prompt node is required");
  }

  let promptNode: WorkflowNode | undefined;
  if (options?.promptId) {
    promptNode = nodeMap.get(options.promptId);
    if (!promptNode || promptNode.data.type !== "Prompt") {
      throw new Error(`Prompt node ${options.promptId} not found`);
    }
  } else {
    promptNode =
      promptCandidates.find((node) =>
        getOutgoing(node.id, edges, nodeMap).some((n) =>
          ["Model", "ModelSet"].includes(n.data.type)
        )
      ) ?? promptCandidates[0];
  }

  if (!promptNode) {
    throw new Error("Prompt node could not be resolved");
  }

  const { messages, validator } = gatherPromptMessages(
    promptNode,
    nodes,
    edges,
    nodeMap,
    options?.runtimeInputs
  );

  const resolvedModel = resolveModel(promptNode, nodes, edges, nodeMap);
  if (!resolvedModel) {
    return {
      kind: "tool-only",
      promptValidator: validator,
      metadata: {
        promptId: promptNode.id,
      },
    };
  }

  const { config, modelNode, modelSetNode } = resolvedModel;
  if (config.provider === "bedrock") {
    // Convert roles to Bedrock format: system messages become user messages with system prefix
    const bedrockMessages: BedrockMessage[] = messages.map((message) => ({
      role: message.role === "system" ? "user" : message.role,
      content: [{
        text: message.role === "system"
          ? `[System]: ${message.text}`
          : message.text
      }],
    }));
    return {
      kind: "bedrock",
      bedrock: {
        modelId: config.modelId,
        messages: bedrockMessages,
        inferenceConfig: {
          temperature: config.temperature,
          topP: config.topP,
          maxTokens: config.maxTokens,
        },
      },
      promptValidator: validator,
      metadata: {
        promptId: promptNode.id,
        modelNodeId: modelNode.id,
        modelSetId: modelSetNode?.id,
      },
    };
  }

  const ollamaMessages: OllamaMessage[] = messages.map((message) => ({
    role: message.role,
    content: message.text,
  }));
  return {
    kind: "ollama",
    ollama: {
      endpoint: config.endpoint ?? "http://localhost:11434",
      model: config.model,
      messages: ollamaMessages,
    },
    promptValidator: validator,
    metadata: {
      promptId: promptNode.id,
      modelNodeId: modelNode.id,
      modelSetId: modelSetNode?.id,
    },
  };
}

/**
 * executeComposedMessages has been moved to convex/lib/messageExecutor.ts
 * because it requires AWS SDK and Node.js environment variables.
 * Import it from there for server-side usage.
 */
