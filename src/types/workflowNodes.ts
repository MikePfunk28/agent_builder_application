export type PromptRole = "system" | "user" | "assistant";

export type NodeKind =
  | "Background"
  | "Context"
  | "OutputIndicator"
  | "PromptText"
  | "Prompt"
  | "Model"
  | "ModelSet"
  | "Tool"
  | "ToolSet"
  | "Entrypoint"
  | "Memory"
  | "Router";

export interface NodeMeta {
  label?: string;
  notes?: string;
}

export interface BackgroundConfig {
  text: string;
}

export interface ContextConfig {
  text: string;
}

export interface OutputIndicatorConfig {
  text: string;
}

export interface PromptTextConfig {
  role?: PromptRole;
  template: string;
  inputs?: Record<string, string>;
}

export interface PromptConfig {
  validator?: {
    type: "regex" | "json-schema";
    spec: string;
  };
}

export type ModelProvider = "bedrock" | "ollama";

export interface BedrockModelConfig {
  provider: "bedrock";
  modelId: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

export interface OllamaModelConfig {
  provider: "ollama";
  model: string;
  endpoint?: string;
  temperature?: number;
  topP?: number;
  numCtx?: number;
}

export type ModelConfig = BedrockModelConfig | OllamaModelConfig;

export interface ModelSetConfig {
  strategy: "single" | "router" | "ensemble-self-consistency" | "ensemble-map-reduce";
  primary?: string;
  routerPromptId?: string;
  k?: number;
}

export type ToolConfig =
  | {
      kind: "mcp";
      server: string;
      tool: string;
      params?: Record<string, any>;
      envRefs?: string[];
    }
  | {
      kind: "openapi";
      specUri: string;
      opId: string;
      authRef?: string;
      params?: Record<string, any>;
    }
  | {
      kind: "internal";
      name: string;
      args?: Record<string, any>;
    };

export interface ToolSetConfig {
  allowList?: string[];
  maxParallel?: number;
  callPolicy?: "model-first" | "tool-first" | "interleave";
}

export interface EntrypointConfig {
  runtime: "http" | "cli" | "lambda";
  path?: string;
  inputSchema?: string;
  outputSchema?: string;
  streaming?: boolean;
}

export interface MemoryConfig {
  source: "convex" | "s3" | "vector_db";
  index?: string;
  topK?: number;
  filters?: Record<string, any>;
}

export interface RouterConfig {
  conditions: Array<{
    type: "if" | "retry" | "fallback";
    expression: string;
    thenNode: string;
    elseNode?: string;
  }>;
}

export type WorkflowNodeData =
  | ({ type: "Background"; config: BackgroundConfig } & NodeMeta)
  | ({ type: "Context"; config: ContextConfig } & NodeMeta)
  | ({ type: "OutputIndicator"; config: OutputIndicatorConfig } & NodeMeta)
  | ({ type: "PromptText"; config: PromptTextConfig } & NodeMeta)
  | ({ type: "Prompt"; config: PromptConfig } & NodeMeta)
  | ({ type: "Model"; config: ModelConfig } & NodeMeta)
  | ({ type: "ModelSet"; config: ModelSetConfig } & NodeMeta)
  | ({ type: "Tool"; config: ToolConfig } & NodeMeta)
  | ({ type: "ToolSet"; config: ToolSetConfig } & NodeMeta)
  | ({ type: "Entrypoint"; config: EntrypointConfig } & NodeMeta)
  | ({ type: "Memory"; config: MemoryConfig } & NodeMeta)
  | ({ type: "Router"; config: RouterConfig } & NodeMeta);

export interface WorkflowNode {
  id: string;
  type?: string;
  position?: { x: number; y: number };
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface WorkflowGraph {
  version: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}
