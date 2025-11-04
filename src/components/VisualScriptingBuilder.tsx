import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Connection,
  Edge,
  Node,
  NodeProps,
  Panel,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
  Handle,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  Save,
  Play,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Workflow as WorkflowIcon,
  Box,
  Gauge,
  Puzzle,
  Server,
} from "lucide-react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { NodeSettingsDrawer } from "./NodeSettingsDrawer";
import {
  composeWorkflow,
  type ComposedMessages,
} from "../engine/messageComposer";
import type {
  NodeKind,
  WorkflowNodeData,
  WorkflowNode,
  WorkflowEdge,
} from "../types/workflowNodes";
import { MODEL_CATALOG, listModelsByProvider } from "../data/modelCatalog";

type FlowNode = Node<WorkflowNodeData>;
type FlowEdge = Edge;

type PaletteNodeItem = {
  type: "node";
  kind: NodeKind;
  title: string;
  description: string;
  badge?: string;
  configOverride?: Record<string, any>;
  labelOverride?: string;
  disabled?: boolean;
};

type PaletteTemplateItem = {
  type: "template";
  templateId: string;
  title: string;
  description: string;
  badge?: string;
};

type PaletteItem = PaletteNodeItem | PaletteTemplateItem;

type PaletteSection = {
  id: string;
  title: string;
  description?: string;
  accent: string;
  icon: React.ReactNode;
  items?: PaletteItem[];
  groups?: PaletteGroup[];
};

type PaletteGroup = {
  id: string;
  title: string;
  description?: string;
  badge?: string;
  items: PaletteItem[];
};

type TemplateDefinition = {
  id: string;
  title: string;
  description: string;
  accent: string;
  build: () => {
    name: string;
    nodes: FlowNode[];
    edges: FlowEdge[];
  };
};

type ToolRegistryEntry = {
  name: string;
  displayName: string;
  description: string;
  category: string;
  extrasPip?: string;
  additionalPipPackages?: string[];
  requiresEnvVars?: string[];
  notSupportedOn?: string[];
};

const TOOL_CATEGORY_LABELS: Record<string, string> = {
  rag_memory: "RAG & Memory",
  file_operations: "File Operations",
  shell_system: "Shell & System",
  code_interpretation: "Code Interpretation",
  web_network: "Web & Network",
  multimodal: "Multimodal",
  aws_services: "AWS Services",
  utilities: "Utilities",
  agents_workflows: "Agents & Workflows",
};

function formatCategoryLabel(category: string): string {
  return (
    TOOL_CATEGORY_LABELS[category as keyof typeof TOOL_CATEGORY_LABELS] ??
    category
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function buildPaletteSections(
  toolMetadata?: ToolRegistryEntry[]
): PaletteSection[] {
  const templateSection: PaletteSection = {
    id: "templates",
    title: "Starter Templates",
    description:
      "Ready-to-run workflows that showcase research, writing, and tool-first strategies.",
    accent: "from-purple-600/60 to-emerald-500/60",
    icon: <Sparkles className="w-4 h-4 text-white" />,
    items: Object.values(TEMPLATE_DEFINITIONS).map<PaletteTemplateItem>((tpl) => ({
      type: "template",
      templateId: tpl.id,
      title: tpl.title,
      description: tpl.description,
      badge: "Template",
    })),
  };

  const promptSection: PaletteSection = {
    id: "prompts",
    title: "Prompts & Context",
    description:
      "Compose personas, runtime context, and output guardrails for your workflow.",
    accent: "from-emerald-500/60 to-sky-500/60",
    icon: <Box className="w-4 h-4 text-white" />,
    groups: [
      {
        id: "prompt-core",
        title: "Core Nodes",
        items: [
          {
            type: "node",
            kind: "Prompt",
            title: "Prompt Container",
            description: "Gather background, context, and snippets into one message.",
            badge: "Core",
          },
      {
        type: "node",
        kind: "PromptText",
        title: "Prompt Snippet",
        description: "Add reusable prompt text with roles and handlebars variables.",
        badge: "Snippet",
        configOverride: {
          role: "system",
          template:
            "You are a helpful assistant. Think step-by-step, call tools when needed, and reflect before responding.\nGoal: {{goal}}",
          inputs: {
            goal: "Solve the user's request with accuracy",
          },
        },
      },
    ],
  },
      {
        id: "prompt-backgrounds",
        title: "Persona Backgrounds",
        items: [
          {
            type: "node",
            kind: "Background",
            title: "Research Analyst Persona",
            description: "System context for factual SME research workflows.",
            badge: "Research",
            labelOverride: "SME Research Persona",
            configOverride: {
              text:
                "You are a senior research analyst who verifies every claim, cites authoritative sources, and maintains a neutral tone.",
            },
          },
          {
            type: "node",
            kind: "Background",
            title: "Creative Director Persona",
            description: "System context for writing or campaign ideation flows.",
            badge: "Writer",
            labelOverride: "Creative Director Persona",
            configOverride: {
              text:
                "You are a creative director crafting engaging narratives, blending storytelling with actionable advice while honoring the brand voice.",
            },
          },
          {
            type: "node",
            kind: "Background",
            title: "Customer Support Persona",
            description: "System context tuned for empathetic support assistants.",
            badge: "Support",
            labelOverride: "Support Agent Persona",
            configOverride: {
              text:
                "You are an experienced support specialist. Be concise, empathetic, and always propose the next-best action.",
            },
          },
        ],
      },
      {
        id: "prompt-context",
        title: "Task Context",
        items: [
          {
            type: "node",
            kind: "Context",
            title: "Research Brief",
            description: "Inject research topic, audience, and deliverable style.",
            badge: "Context",
            labelOverride: "Research Brief",
            configOverride: {
              text:
                "Topic: {{topic}}\nAudience: {{audience}}\nKey questions: {{questions}}\nDeliverable: {{deliverable}}",
            },
          },
          {
            type: "node",
            kind: "Context",
            title: "Incident Report",
            description: "Pre-fill structured context for support investigations.",
            badge: "Operations",
            labelOverride: "Incident Context",
            configOverride: {
              text:
                "Incident ID: {{incidentId}}\nCustomer Impact: {{impact}}\nLogs summary: {{logs}}\nKnown attempts: {{attempts}}",
            },
          },
        ],
      },
      {
        id: "prompt-output",
        title: "Output Guards",
        items: [
          {
            type: "node",
            kind: "OutputIndicator",
            title: "Executive Summary",
            description: "Enforce a concise, actionable executive brief format.",
            badge: "Guardrail",
            labelOverride: "Executive Summary",
            configOverride: {
              text:
                "Return a 4-paragraph executive summary with sections: Overview, Key Insights, Risks, Next Steps.",
            },
          },
          {
            type: "node",
            kind: "OutputIndicator",
            title: "JSON Schema Validation",
            description: "Require JSON output validated in the prompt node.",
            badge: "JSON",
            labelOverride: "JSON Contract",
            configOverride: {
              text:
                "Output must be valid JSON matching the schema in the Prompt validator (click Prompt to configure).",
            },
          },
        ],
      },
    ],
  };

  const bedrockModels = MODEL_CATALOG.filter(
    (model) => model.provider === "bedrock"
  );
  const ollamaModels = MODEL_CATALOG.filter(
    (model) => model.provider === "ollama"
  );

  const modelGroups: PaletteGroup[] = [];
  if (bedrockModels.length > 0) {
    modelGroups.push({
      id: "bedrock",
      title: "Bedrock Models",
      items: bedrockModels.map<PaletteNodeItem>((model) => ({
        type: "node",
        kind: "Model",
        title: model.label,
        description: model.description,
        badge: "Bedrock",
        labelOverride: model.label,
        configOverride: {
          provider: "bedrock",
          modelId: model.id,
          temperature: model.defaultConfig.temperature ?? 0.2,
          topP: model.defaultConfig.topP ?? 0.9,
          maxTokens: model.defaultConfig.maxTokens ?? 4096,
        },
      })),
    });
  }

  if (ollamaModels.length > 0) {
    modelGroups.push({
      id: "ollama",
      title: "Ollama Models",
      items: ollamaModels.map<PaletteNodeItem>((model) => ({
        type: "node",
        kind: "Model",
        title: model.label,
        description: model.description,
        badge: "Ollama",
        labelOverride: model.label,
        configOverride: {
          provider: "ollama",
          model: model.id,
          endpoint: model.defaultConfig.endpoint ?? "http://localhost:11434",
          temperature: model.defaultConfig.temperature ?? 0.4,
          topP: model.defaultConfig.topP ?? 0.9,
          numCtx: model.defaultConfig.numCtx ?? 8192,
        },
      })),
    });
  }

  modelGroups.push({
    id: "model-routing",
    title: "Routing & Ensembles",
    items: [
      {
        type: "node",
        kind: "ModelSet",
        title: "Model Set",
        description:
          "Reference multiple model nodes and choose single, router, or ensemble strategies.",
        badge: "Routing",
      },
      {
        type: "node",
        kind: "Router",
        title: "Router",
        description:
          "Evaluate conditions, fallbacks, and retries to steer your workflow dynamically.",
        badge: "Flow",
      },
    ],
  });

  const modelSection: PaletteSection = {
    id: "models",
    title: "Models & Routing",
    description: "Bedrock, Ollama, and ensemble orchestration nodes.",
    accent: "from-sky-500/60 to-indigo-600/60",
    icon: <Gauge className="w-4 h-4 text-white" />,
    groups: modelGroups,
  };

  let toolGroups: PaletteGroup[] = [];
  if (!toolMetadata) {
    toolGroups = [
      {
        id: "loading",
        title: "Loading Strands tools…",
        items: [
          {
            type: "node",
            kind: "Tool",
            title: "Loading catalog",
            description: "Fetching tool metadata from the platform.",
            disabled: true,
          },
        ],
      },
    ];
  } else {
    const grouped = new Map<string, PaletteNodeItem[]>();
    toolMetadata.forEach((tool) => {
      const item: PaletteNodeItem = {
        type: "node",
        kind: "Tool",
        title: tool.displayName,
        description: tool.description,
        badge: formatCategoryLabel(tool.category),
        labelOverride: tool.displayName,
        configOverride: {
          kind: "internal",
          name: tool.name,
          args: {},
        },
      };
      const current = grouped.get(tool.category) ?? [];
      current.push(item);
      grouped.set(tool.category, current);
    });

    toolGroups = Array.from(grouped.entries())
      .sort((a, b) =>
        formatCategoryLabel(a[0]).localeCompare(formatCategoryLabel(b[0]))
      )
      .map(([category, items]) => ({
        id: category,
        title: formatCategoryLabel(category),
        items,
      }));

    toolGroups.push({
      id: "custom-tool",
      title: "Custom Bindings",
      items: [
        {
          type: "node",
          kind: "Tool",
          title: "Blank Tool Node",
          description:
            "Start from an empty tool configuration and fill out settings in the drawer.",
          badge: "Custom",
        },
      ],
    });
  }

  const toolSection: PaletteSection = {
    id: "tools",
    title: "Strands Tools",
    description:
      "Internal Strands tools and agents-as-tools grouped by capability.",
    accent: "from-amber-500/60 to-orange-600/60",
    icon: <Puzzle className="w-4 h-4 text-white" />,
    groups: toolGroups,
  };

  const memorySection: PaletteSection = {
    id: "memory",
    title: "Memory & Knowledge",
    description: "Connect workflows to Convex, S3, and vector memory sources.",
    accent: "from-lime-500/60 to-green-500/60",
    icon: <WorkflowIcon className="w-4 h-4 text-white" />,
    groups: [
      {
        id: "memory-sources",
        title: "Memory Nodes",
        items: [
          {
            type: "node",
            kind: "Memory",
            title: "Convex Memory",
            description: "Use Convex collections for short-term memory.",
            configOverride: { source: "convex", topK: 5 },
            badge: "Convex",
          },
          {
            type: "node",
            kind: "Memory",
            title: "S3 Knowledge Base",
            description: "Reference S3 buckets or knowledge bases for context.",
            configOverride: { source: "s3", index: "knowledge-base", topK: 5 },
            badge: "S3",
          },
          {
            type: "node",
            kind: "Memory",
            title: "Vector Memory",
            description: "Query vector databases for semantic recall.",
            configOverride: {
              source: "vector_db",
              index: "default-index",
              topK: 8,
            },
            badge: "Vector",
          },
        ],
      },
    ],
  };

  const orchestrationSection: PaletteSection = {
    id: "orchestration",
    title: "Flow Orchestration",
    description:
      "Combine toolsets, control concurrency, and expose orchestrators.",
    accent: "from-rose-500/60 to-purple-600/60",
    icon: <WorkflowIcon className="w-4 h-4 text-white" />,
    groups: [
      {
        id: "toolset-routing",
        title: "Tool Routing",
        items: [
          {
            type: "node",
            kind: "ToolSet",
            title: "Tool Set",
            description:
              "Allow-list tools, determine call policy, and set parallelism.",
            badge: "Tooling",
          },
        ],
      },
    ],
  };

  const mcpSection: PaletteSection = {
    id: "mcp",
    title: "Model Context Protocol",
    description:
      "Bind to MCP servers for external data, diagrams, AWS services, and more.",
    accent: "from-cyan-500/60 to-blue-600/60",
    icon: <Server className="w-4 h-4 text-white" />,
    groups: [
      {
        id: "mcp-examples",
        title: "MCP Tool Examples",
        items: [
          {
            type: "node",
            kind: "Tool",
            title: "Document Fetcher",
            description: "Fetch and chunk documents from the document-fetcher MCP.",
            badge: "MCP",
            labelOverride: "MCP Document Fetcher",
            configOverride: {
              kind: "mcp",
              server: "document-fetcher",
              tool: "fetchDocuments",
              params: { source: "s3://knowledge-base" },
            },
          },
          {
            type: "node",
            kind: "Tool",
            title: "AWS Diagram Generator",
            description:
              "Use the aws-diagram MCP to draw architecture diagrams.",
            badge: "MCP",
            labelOverride: "AWS Diagram MCP",
            configOverride: {
              kind: "mcp",
              server: "aws-diagram",
              tool: "generateArchitecture",
              params: { format: "png" },
            },
          },
          {
            type: "node",
            kind: "Tool",
            title: "AgentCore Invoke",
            description:
              "Call another AgentCore agent through the bedrock-agentcore MCP.",
            badge: "MCP",
            labelOverride: "AgentCore Invoke",
            configOverride: {
              kind: "mcp",
              server: "bedrock-agentcore",
              tool: "invokeAgent",
              params: { agentId: "AGENT_ID" },
            },
          },
        ],
      },
    ],
  };

  const integrationSection: PaletteSection = {
    id: "integration",
    title: "Entrypoints & Deployment",
    description:
      "Expose workflows as HTTP, CLI, or Lambda handlers for deployment.",
    accent: "from-teal-500/60 to-emerald-500/60",
    icon: <Server className="w-4 h-4 text-white" />,
    groups: [
      {
        id: "entrypoints",
        title: "Entrypoint Nodes",
        items: [
          {
            type: "node",
            kind: "Entrypoint",
            title: "Entrypoint",
            description:
              "Declare runtime, path, schemas, and streaming options for execution.",
            badge: "Deployment",
          },
        ],
      },
    ],
  };

  return [
    templateSection,
    promptSection,
    modelSection,
    toolSection,
    memorySection,
    orchestrationSection,
    mcpSection,
    integrationSection,
  ];
}

const nodeTypes = {
  workflow: WorkflowCanvasNode,
};

const defaultLabels: Record<NodeKind, string> = {
  Background: "Background",
  Context: "Context",
  OutputIndicator: "Output Instructions",
  PromptText: "Prompt Text",
  Prompt: "Prompt",
  Model: "Model",
  ModelSet: "Model Set",
  Tool: "Tool",
  ToolSet: "Tool Set",
  Entrypoint: "Entrypoint",
  Memory: "Memory",
  Router: "Router",
};

function defaultConfig(kind: NodeKind): WorkflowNodeData["config"] {
  switch (kind) {
    case "Background":
    case "Context":
    case "OutputIndicator":
      return { text: "" };
    case "PromptText":
      return { role: "system", template: "", inputs: {} };
    case "Prompt":
      return { validator: undefined };
    case "Model":
      {
        const [firstBedrock] = listModelsByProvider("bedrock");
        return {
          provider: "bedrock",
          modelId: firstBedrock?.id ?? "anthropic.claude-3-5-sonnet-20241022",
          temperature: firstBedrock?.defaultConfig.temperature ?? 0.2,
          topP: firstBedrock?.defaultConfig.topP ?? 0.9,
          maxTokens: firstBedrock?.defaultConfig.maxTokens ?? 4096,
        };
      }
    case "ModelSet":
      return {
        strategy: "single",
        primary: undefined,
        routerPromptId: undefined,
        k: undefined,
      };
    case "Tool":
      return {
        kind: "internal",
        name: "",
        args: {},
      };
    case "ToolSet":
      return {
        allowList: [],
        maxParallel: 1,
        callPolicy: "model-first",
      };
    case "Entrypoint":
      return {
        runtime: "http",
        path: "/run",
        inputSchema: "",
        outputSchema: "",
        streaming: false,
      };
    case "Memory":
      return {
        source: "convex",
        topK: 5,
      };
    case "Router":
      return {
        conditions: [],
      };
    default:
      return {};
  }
}

function generateId(kind: NodeKind): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${kind.toLowerCase()}-${crypto.randomUUID()}`;
  }
  return `${kind.toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function toWorkflowNode(node: FlowNode): WorkflowNode {
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    data: node.data,
  };
}

function toWorkflowEdge(edge: FlowEdge): WorkflowEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    label: (edge as any).label,
  };
}

function hydrateNode(raw: any): FlowNode {
  return {
    id: raw.id,
    type: raw.type ?? "workflow",
    position: raw.position ?? { x: 0, y: 0 },
    data: raw.data,
  };
}

function hydrateEdge(raw: any): FlowEdge {
  return {
    id: raw.id ?? `${raw.source}-${raw.target}`,
    source: raw.source,
    target: raw.target,
    sourceHandle: raw.sourceHandle,
    targetHandle: raw.targetHandle,
    label: raw.label,
  };
}

function createFlowNode(
  kind: NodeKind,
  position: { x: number; y: number },
  options?: {
    id?: string;
    label?: string;
    notes?: string;
    config?: Record<string, any>;
  }
): FlowNode {
  const id = options?.id ?? generateId(kind);
  return {
    id,
    type: "workflow",
    position,
    data: {
      type: kind,
      label: options?.label ?? defaultLabels[kind],
      notes: options?.notes ?? "",
      config: {
        ...defaultConfig(kind),
        ...(options?.config ?? {}),
      },
    },
  };
}

function createEdge(
  source: FlowNode | string,
  target: FlowNode | string,
  label?: string
): FlowEdge {
  const sourceId = typeof source === "string" ? source : source.id;
  const targetId = typeof target === "string" ? target : target.id;
  const edgeId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${sourceId}-${targetId}-${Date.now()}`;
  return {
    id: edgeId,
    source: sourceId,
    target: targetId,
    label,
  };
}

function PaletteCard({
  item,
  addNode,
  applyTemplate,
}: {
  item: PaletteItem;
  addNode: (
    kind: NodeKind,
    options?: { label?: string; configOverride?: Record<string, any> }
  ) => void;
  applyTemplate: (templateId: string) => void;
}) {
  const isTemplate = item.type === "template";
  const disabled = item.type === "node" && item.disabled;

  return (
    <div className="rounded-md border border-gray-900/60 bg-gray-950/60 p-3 hover:border-emerald-500/40 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-100">{item.title}</p>
          <p className="text-xs text-gray-400 mt-1">{item.description}</p>
          {"badge" in item && item.badge && (
            <span className="inline-block mt-2 text-[11px] uppercase tracking-wide bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded">
              {item.badge}
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (isTemplate) {
              applyTemplate(item.templateId);
            } else {
              addNode(item.kind, {
                label: item.labelOverride,
                configOverride: item.configOverride,
              });
            }
          }}
          className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wide transition-colors ${
            disabled
              ? "bg-gray-800 text-gray-500 cursor-not-allowed"
              : "bg-emerald-600 hover:bg-emerald-500 text-white"
          }`}
        >
          {isTemplate ? "Use Template" : "Add"}
        </button>
      </div>
    </div>
  );
}

const TEMPLATE_DEFINITIONS: Record<string, TemplateDefinition> = {
  research_workflow: {
    id: "research_workflow",
    title: "Research Squad",
    description:
      "Researcher, analyst, fact-checker, and writer pipeline with Claude Sonnet + review tool.",
    accent: "from-emerald-500/80 to-cyan-500/80",
    build: () => {
      const prompt = createFlowNode(
        "Prompt",
        { x: 320, y: 160 },
        {
          label: "Research Prompt",
        }
      );
      const background = createFlowNode(
        "Background",
        { x: 40, y: 40 },
        {
          label: "Mission Brief",
          config: {
            text:
              "You are the lead AI researcher. Build a factual, source-linked report with citations.",
          },
        }
      );
      const context = createFlowNode(
        "Context",
        { x: 40, y: 160 },
        {
          label: "Research Question",
          config: {
            text: "Primary question: {{topic}}\nAudience: {{audience}}",
          },
        }
      );
      const outputIndicator = createFlowNode(
        "OutputIndicator",
        { x: 40, y: 280 },
        {
          label: "Deliverable",
          config: {
            text:
              "Return a markdown report with sections: Summary, Findings, Evidence Table, Next Steps.",
          },
        }
      );
      const promptText = createFlowNode(
        "PromptText",
        { x: 200, y: 40 },
        {
          label: "Research Process",
          config: {
            role: "system",
            template:
              "Follow a three-stage process: 1) Research leads, 2) Analyze data, 3) Draft report. Use tools when you need verification.",
            inputs: {},
          },
        }
      );
      const model = createFlowNode(
        "Model",
        { x: 560, y: 120 },
        {
          label: "Claude 3.5 Sonnet",
          config: {
            provider: "bedrock",
            modelId: "anthropic.claude-3-5-sonnet-20241022",
            temperature: 0.3,
            topP: 0.9,
            maxTokens: 4096,
          },
        }
      );
      const modelSet = createFlowNode(
        "ModelSet",
        { x: 560, y: 260 },
        {
          label: "Primary Model",
          config: {
            strategy: "single",
            primary: model.id,
          },
        }
      );
      const factTool = createFlowNode(
        "Tool",
        { x: 760, y: 120 },
        {
          label: "Fact Checker",
          config: {
            kind: "internal",
            name: "factChecker",
            args: { mode: "web" },
          },
        }
      );
      const writerTool = createFlowNode(
        "Tool",
        { x: 760, y: 220 },
        {
          label: "Report Writer",
          config: {
            kind: "internal",
            name: "reportWriter",
            args: { format: "markdown" },
          },
        }
      );
      const toolSet = createFlowNode(
        "ToolSet",
        { x: 760, y: 320 },
        {
          label: "Research Tools",
          config: {
            allowList: [factTool.id, writerTool.id],
            maxParallel: 2,
            callPolicy: "model-first",
          },
        }
      );
      const entrypoint = createFlowNode(
        "Entrypoint",
        { x: 960, y: 260 },
        {
          label: "HTTP Endpoint",
          config: {
            runtime: "http",
            path: "/research",
            inputSchema: "{ \"topic\": \"string\" }",
            outputSchema: "{ \"report\": \"string\" }",
            streaming: true,
          },
        }
      );

      const nodes = [
        prompt,
        background,
        context,
        outputIndicator,
        promptText,
        model,
        modelSet,
        factTool,
        writerTool,
        toolSet,
        entrypoint,
      ];

      const edges = [
        createEdge(background, prompt, "background"),
        createEdge(context, prompt, "context"),
        createEdge(outputIndicator, prompt, "output"),
        createEdge(promptText, prompt, "prompt-text"),
        createEdge(prompt, modelSet),
        createEdge(model, modelSet),
        createEdge(modelSet, toolSet),
        createEdge(factTool, toolSet),
        createEdge(writerTool, toolSet),
        createEdge(toolSet, entrypoint),
      ];

      return {
        name: "Research Squad Workflow",
        nodes,
        edges,
      };
    },
  },
  writing_workflow: {
    id: "writing_workflow",
    title: "Creative Writer",
    description:
      "Persona-driven writing workflow with critique loop and style enforcement.",
    accent: "from-fuchsia-500/80 to-purple-600/80",
    build: () => {
      const prompt = createFlowNode(
        "Prompt",
        { x: 320, y: 150 },
        { label: "Writer Prompt" }
      );
      const tone = createFlowNode(
        "Background",
        { x: 60, y: 60 },
        {
          label: "Persona & Tone",
          config: {
            text:
              "You are a best-selling non-fiction author who writes with clarity, empathy, and strategic insight.",
          },
        }
      );
      const assignment = createFlowNode(
        "Context",
        { x: 60, y: 180 },
        {
          label: "Assignment",
          config: {
            text:
              "Topic: {{topic}}\nPrimary audience: {{audience}}\nDesired length: {{length}}",
          },
        }
      );
      const guardrail = createFlowNode(
        "OutputIndicator",
        { x: 60, y: 300 },
        {
          label: "Output Contract",
          config: {
            text:
              "Return final article with sections: Hook, Key Insights, Action Steps. Include references when applicable.",
          },
        }
      );
      const draftingPrompt = createFlowNode(
        "PromptText",
        { x: 200, y: 40 },
        {
          label: "Drafting Instructions",
          config: {
            role: "system",
            template:
              "Draft an outline, write the article, then critique and revise to tighten arguments. Keep paragraphs concise.",
            inputs: {},
          },
        }
      );
      const claude = createFlowNode(
        "Model",
        { x: 560, y: 150 },
        {
          label: "Claude Haiku",
          config: {
            provider: "bedrock",
            modelId: "anthropic.claude-3-haiku-20240307-v1:0",
            temperature: 0.5,
            topP: 0.95,
            maxTokens: 4096,
          },
        }
      );
      const editingTool = createFlowNode(
        "Tool",
        { x: 760, y: 120 },
        {
          label: "Critique Tool",
          config: {
            kind: "internal",
            name: "reflexion",
            args: { rounds: 2 },
          },
        }
      );
      const styleTool = createFlowNode(
        "Tool",
        { x: 760, y: 220 },
        {
          label: "Style Guide",
          config: {
            kind: "internal",
            name: "styleGuideEnforcer",
            args: { tone: "thoughtful" },
          },
        }
      );
      const toolSet = createFlowNode(
        "ToolSet",
        { x: 760, y: 320 },
        {
          label: "Writer Tools",
          config: {
            allowList: [editingTool.id, styleTool.id],
            callPolicy: "model-first",
            maxParallel: 1,
          },
        }
      );
      const entrypoint = createFlowNode(
        "Entrypoint",
        { x: 960, y: 260 },
        {
          label: "CLI Command",
          config: {
            runtime: "cli",
            path: "writer:run",
            inputSchema: "{ \"topic\": \"string\" }",
          },
        }
      );

      const nodes = [
        prompt,
        tone,
        assignment,
        guardrail,
        draftingPrompt,
        claude,
        editingTool,
        styleTool,
        toolSet,
        entrypoint,
      ];

      const edges = [
        createEdge(tone, prompt),
        createEdge(assignment, prompt),
        createEdge(guardrail, prompt),
        createEdge(draftingPrompt, prompt),
        createEdge(prompt, claude),
        createEdge(claude, toolSet),
        createEdge(editingTool, toolSet),
        createEdge(styleTool, toolSet),
        createEdge(toolSet, entrypoint),
      ];

      return {
        name: "Creative Writer Workflow",
        nodes,
        edges,
      };
    },
  },
  tool_first_pipeline: {
    id: "tool_first_pipeline",
    title: "Tool-First Automation",
    description:
      "Zero-model pipeline that chains MCP/OpenAPI tools before optional reasoning.",
    accent: "from-orange-500/80 to-amber-500/80",
    build: () => {
      const prompt = createFlowNode(
        "Prompt",
        { x: 300, y: 140 },
        {
          label: "Automation Prompt",
        }
      );
      const context = createFlowNode(
        "Context",
        { x: 60, y: 120 },
        {
          label: "Task Input",
          config: {
            text:
              "Task: {{task}}\nPrimary dataset: {{dataset}}\nOutput target: {{target}}",
          },
        }
      );
      const validator = createFlowNode(
        "OutputIndicator",
        { x: 60, y: 220 },
        {
          label: "Validation Rules",
          config: {
            text: "Validate output with JSON schema defined in validator config.",
          },
        }
      );
      const promptAddon = createFlowNode(
        "PromptText",
        { x: 180, y: 40 },
        {
          label: "Tool Instructions",
          config: {
            role: "system",
            template:
              "Prefer tools before calling the model. Always log tool outputs to shared context logs.",
            inputs: {},
          },
        }
      );
      const toolMcp = createFlowNode(
        "Tool",
        { x: 520, y: 120 },
        {
          label: "MCP Document Fetcher",
          config: {
            kind: "mcp",
            server: "document-fetcher",
            tool: "fetchDocuments",
            params: { source: "s3://knowledge-base" },
          },
        }
      );
      const toolInternal = createFlowNode(
        "Tool",
        { x: 520, y: 220 },
        {
          label: "Summarize Tool",
          config: {
            kind: "internal",
            name: "mapReduce",
            args: { strategy: "map-first" },
          },
        }
      );
      const toolSet = createFlowNode(
        "ToolSet",
        { x: 520, y: 320 },
        {
          label: "Automation Toolset",
          config: {
            allowList: [toolMcp.id, toolInternal.id],
            callPolicy: "tool-first",
            maxParallel: 3,
          },
        }
      );
      const entrypoint = createFlowNode(
        "Entrypoint",
        { x: 760, y: 320 },
        {
          label: "Workflow Tool",
          config: {
            runtime: "lambda",
            path: "tool-first",
            inputSchema: "{ \"task\": \"string\" }",
            outputSchema: "{ \"result\": \"string\" }",
          },
        }
      );

      const nodes = [
        prompt,
        context,
        validator,
        promptAddon,
        toolMcp,
        toolInternal,
        toolSet,
        entrypoint,
      ];

      const edges = [
        createEdge(context, prompt),
        createEdge(validator, prompt),
        createEdge(promptAddon, prompt),
        createEdge(prompt, toolSet),
        createEdge(toolMcp, toolSet),
        createEdge(toolInternal, toolSet),
        createEdge(toolSet, entrypoint),
      ];

      return {
        name: "Tool-First Automation",
        nodes,
        edges,
      };
    },
  },
};

export function VisualScriptingBuilder() {
  const counterRef = useRef(0);
  const toolRegistry = useQuery(api.toolRegistry.getAllTools) as
    | ToolRegistryEntry[]
    | undefined;
  const [workflowName, setWorkflowName] = useState("Untitled Workflow");
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<ComposedMessages | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const paletteSections = useMemo(
    () => buildPaletteSections(toolRegistry),
    [toolRegistry]
  );

  const initialNodes = useMemo<FlowNode[]>(() => {
    const promptId = generateId("Prompt");
    const promptTextId = generateId("PromptText");
    const modelId = generateId("Model");
    const nodes: FlowNode[] = [
      {
        id: promptId,
        type: "workflow",
        position: { x: 200, y: 120 },
        data: {
          type: "Prompt",
          label: "Primary Prompt",
          notes: "",
          config: defaultConfig("Prompt"),
        },
      },
      {
        id: promptTextId,
        type: "workflow",
        position: { x: 20, y: 40 },
        data: {
          type: "PromptText",
          label: "Persona",
          notes: "",
          config: {
            role: "system",
            template: "You are a helpful assistant.",
            inputs: {},
          },
        },
      },
      {
        id: modelId,
        type: "workflow",
        position: { x: 420, y: 120 },
        data: {
          type: "Model",
          label: "Claude 3.5 Sonnet",
          notes: "",
          config: defaultConfig("Model"),
        },
      },
    ];
    counterRef.current = 3;
    return nodes;
  }, []);

  const initialEdges = useMemo<FlowEdge[]>(() => {
    return [
      {
        id: "promptText-to-prompt",
        source: (initialNodes[1] ?? { id: "" }).id,
        target: (initialNodes[0] ?? { id: "" }).id,
        type: "smoothstep",
      },
      {
        id: "prompt-to-model",
        source: (initialNodes[0] ?? { id: "" }).id,
        target: (initialNodes[2] ?? { id: "" }).id,
        type: "smoothstep",
      },
    ];
  }, [initialNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNodeData>(
    initialNodes
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const workflows = useQuery(api.workflows.list, {});
  const saveWorkflowMutation = useAction(api.workflows.save);
  const removeWorkflowMutation = useAction(api.workflows.remove);

  useEffect(() => {
    if (!selectedNodeId) {
      setIsDrawerOpen(false);
    }
  }, [selectedNodeId]);

  const addNode = useCallback(
    (
      kind: NodeKind,
      options?: {
        label?: string;
        configOverride?: Record<string, any>;
      }
    ) => {
      counterRef.current += 1;
      const nodeId = generateId(kind);
      const offset = counterRef.current * 40;
      const newNode: FlowNode = {
        id: nodeId,
        type: "workflow",
        position: { x: 120 + offset, y: 120 + offset },
        data: {
          type: kind,
          label: options?.label ?? defaultLabels[kind],
          notes: "",
          config: {
            ...defaultConfig(kind),
            ...(options?.configOverride ?? {}),
          },
        },
      };
      setNodes((current) => current.concat(newNode));
      setSelectedNodeId(nodeId);
      setIsDrawerOpen(true);
    },
    [setNodes]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges]
  );

  const onNodeClick = useCallback((_event: any, node: FlowNode) => {
    setSelectedNodeId(node.id);
    setIsDrawerOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    const trimmedName = workflowName.trim() || "Untitled Workflow";
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const payloadNodes = nodes.map(toWorkflowNode);
      const payloadEdges = edges.map(toWorkflowEdge);
      const result = await saveWorkflowMutation({
        workflowId: activeWorkflowId ?? undefined,
        name: trimmedName,
        nodes: payloadNodes,
        edges: payloadEdges,
        templateId: "custom",
        status: "draft",
      } as any);
      if (result?.workflowId) {
        setActiveWorkflowId(result.workflowId);
      }
      setStatusMessage("Workflow saved");
    } catch (error: any) {
      setStatusMessage(error?.message ?? "Failed to save workflow");
    } finally {
      setIsSaving(false);
    }
  }, [workflowName, nodes, edges, saveWorkflowMutation, activeWorkflowId]);

  const handlePreview = useCallback(() => {
    setPreviewError(null);
    try {
      const payloadNodes = nodes.map(toWorkflowNode);
      const payloadEdges = edges.map(toWorkflowEdge);
      const composition = composeWorkflow(payloadNodes, payloadEdges);
      setPreview(composition);
    } catch (error: any) {
      setPreview(null);
      setPreviewError(error.message ?? "Unable to compose workflow");
    }
  }, [nodes, edges]);

  const handleDeleteWorkflow = useCallback(
    async (workflowId: string) => {
      try {
        await removeWorkflowMutation({ workflowId } as any);
        if (activeWorkflowId === workflowId) {
          setActiveWorkflowId(null);
        }
        setStatusMessage("Workflow deleted");
      } catch (error: any) {
        setStatusMessage(error?.message ?? "Failed to delete workflow");
      }
    },
    [removeWorkflowMutation, activeWorkflowId]
  );

  const handleLoadWorkflow = useCallback(
    (workflow: any) => {
      const hydratedNodes = (workflow.nodes ?? []).map(hydrateNode);
      const hydratedEdges = (workflow.edges ?? []).map(hydrateEdge);
      setNodes(hydratedNodes);
      setEdges(hydratedEdges);
      setWorkflowName(workflow.name ?? "Untitled Workflow");
      setActiveWorkflowId(workflow._id);
      counterRef.current = hydratedNodes.length;
    },
    [setNodes, setEdges]
  );

  const selectedNode = useMemo<WorkflowNode | null>(() => {
    if (!selectedNodeId) return null;
    const node = nodes.find((item) => item.id === selectedNodeId);
    if (!node) return null;
    return toWorkflowNode(node);
  }, [nodes, selectedNodeId]);

  const handleNodeSave = useCallback(
    (nodeId: string, data: WorkflowNodeData) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data,
              }
            : node
        )
      );
    },
    [setNodes]
  );

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedNodeId(null);
  }, []);

  const toggleSection = useCallback((sectionId: string) => {
    setOpenSections((current) => ({
      ...current,
      [sectionId]: current[sectionId] === undefined ? false : !current[sectionId],
    }));
  }, []);

  const applyTemplate = useCallback(
    (templateId: string) => {
      const template = TEMPLATE_DEFINITIONS[templateId];
      if (!template) {
        return;
      }
      const { nodes: templateNodes, edges: templateEdges, name } = template.build();
      setNodes(templateNodes);
      setEdges(templateEdges);
      setWorkflowName(name);
      setActiveWorkflowId(null);
      setSelectedNodeId(null);
      counterRef.current = templateNodes.length;
      setStatusMessage(`Template "${template.title}" applied`);
    },
    []
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-80 bg-gray-950 text-gray-100 border-r border-gray-900/80 overflow-y-auto">
        <div className="px-5 py-5 border-b border-gray-900/70">
          <div className="flex items-center gap-2">
            <WorkflowIcon className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Builder Palette</h2>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Start with a template or drop individual nodes. Sections use our
            Strands-inspired green/purple theme for quick scanning.
          </p>
        </div>

        <div className="px-4 py-4 space-y-4">
          {paletteSections.map((section) => {
            const isOpen =
              openSections[section.id] ?? true;
            return (
              <div key={section.id} className="rounded-lg border border-gray-900/70 bg-gray-900/40">
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`inline-flex items-center justify-center w-9 h-9 rounded-md bg-gradient-to-br ${section.accent}`}
                    >
                      {section.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-100">
                        {section.title}
                      </p>
                      {section.description && (
                        <p className="text-xs text-gray-400">
                          {section.description}
                        </p>
                      )}
                    </div>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-4">
                    {section.groups
                      ? section.groups.map((group) => (
                          <div key={group.id} className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                                {group.title}
                              </h4>
                              {group.badge && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 text-emerald-200">
                                  {group.badge}
                                </span>
                              )}
                            </div>
                            <div className="space-y-2">
                              {group.items.map((item) => (
                                <PaletteCard
                                  key={
                                    item.type === "template"
                                      ? `group-${group.id}-template-${item.templateId}`
                                      : `group-${group.id}-node-${item.kind}-${item.title}`
                                  }
                                  item={item}
                                  addNode={addNode}
                                  applyTemplate={applyTemplate}
                                />
                              ))}
                            </div>
                          </div>
                        ))
                      : section.items?.map((item) => (
                          <PaletteCard
                            key={
                              item.type === "template"
                                ? `section-${section.id}-template-${item.templateId}`
                                : `section-${section.id}-node-${item.kind}-${item.title}`
                            }
                            item={item}
                            addNode={addNode}
                            applyTemplate={applyTemplate}
                          />
                        ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      <main className="flex-1 relative bg-slate-950">
        <header className="absolute top-4 left-4 right-4 z-20">
          <div className="bg-gray-900/90 backdrop-blur rounded-lg border border-gray-700 px-4 py-3 flex flex-wrap items-center gap-3">
            <input
              value={workflowName}
              onChange={(event) => setWorkflowName(event.target.value)}
              className="flex-1 min-w-[200px] bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="Workflow name"
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePreview}
                className="inline-flex items-center gap-2 px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm transition-colors"
              >
                <Play className="w-4 h-4" />
                Preview
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm transition-colors disabled:opacity-60"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save
              </button>
            </div>

            <div className="flex-1 min-w-[240px]">
              <WorkflowPicker
                workflows={workflows ?? []}
                activeId={activeWorkflowId}
                onSelect={handleLoadWorkflow}
                onDelete={handleDeleteWorkflow}
              />
            </div>

            {statusMessage && (
              <p className="text-xs text-gray-400">{statusMessage}</p>
            )}
          </div>
        </header>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          className="h-full"
        >
          <MiniMap
            className="bg-gray-900/80"
            nodeStrokeColor={(node) => colorForNodeKind(node.data.type)}
            nodeColor={(node) => colorForNodeKind(node.data.type, 0.4)}
          />
          <Controls className="bg-gray-900/80 border border-gray-700" />
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={2}
            color="#1f2937"
          />
          <Panel position="bottom-left" className="bg-gray-900/90 rounded p-2">
            <p className="text-xs text-gray-400">
              Tip: connect Prompt Text → Prompt → Model. Add Tool sets for tool
              calling, then wire an Entrypoint.
            </p>
          </Panel>
        </ReactFlow>
      </main>

      <NodeSettingsDrawer
        node={selectedNode}
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        onSave={handleNodeSave}
      />

      {preview && (
        <CompositionPreview result={preview} onClose={() => setPreview(null)} />
      )}

      {previewError && (
        <div className="absolute bottom-6 right-6 bg-red-600 text-white px-4 py-3 rounded shadow-lg z-30">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Preview error</p>
            <button
              onClick={() => setPreviewError(null)}
              className="text-sm underline"
            >
              Dismiss
            </button>
          </div>
          <p className="text-xs mt-1 max-w-xs">{previewError}</p>
        </div>
      )}
    </div>
  );
}

function WorkflowCanvasNode({ data }: NodeProps<WorkflowNodeData>) {
  const badgeColor = colorForNodeKind(data.type);

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 text-gray-100 px-3 py-2 shadow-md min-w-[160px]">
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-gray-700 !border-gray-500"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-emerald-500"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-white truncate">
          {data.label || defaultLabels[data.type]}
        </span>
        <span
          className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full text-gray-900"
          style={{ backgroundColor: badgeColor }}
        >
          {data.type}
        </span>
      </div>
      {data.notes && (
        <p className="text-[10px] text-gray-400 mt-1 line-clamp-2">{data.notes}</p>
      )}
    </div>
  );
}

function colorForNodeKind(kind: NodeKind, alpha = 1): string {
  const mapper: Record<NodeKind, string> = {
    Background: `rgba(59,130,246,${alpha})`,
    Context: `rgba(96,165,250,${alpha})`,
    OutputIndicator: `rgba(234,179,8,${alpha})`,
    PromptText: `rgba(14,165,233,${alpha})`,
    Prompt: `rgba(236,72,153,${alpha})`,
    Model: `rgba(139,92,246,${alpha})`,
    ModelSet: `rgba(168,85,247,${alpha})`,
    Tool: `rgba(34,197,94,${alpha})`,
    ToolSet: `rgba(16,185,129,${alpha})`,
    Memory: `rgba(249,115,22,${alpha})`,
    Router: `rgba(248,113,113,${alpha})`,
    Entrypoint: `rgba(20,184,166,${alpha})`,
  };
  return mapper[kind] ?? `rgba(107,114,128,${alpha})`;
}

function WorkflowPicker({
  workflows,
  activeId,
  onSelect,
  onDelete,
}: {
  workflows: any[];
  activeId: string | null;
  onSelect: (workflow: any) => void;
  onDelete: (workflowId: string) => void;
}) {
  if (!workflows || workflows.length === 0) {
    return (
      <div className="text-xs text-gray-400">
        No saved workflows yet. Save to persist your canvas.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={activeId ?? ""}
        onChange={(event) => {
          const workflow = workflows.find(
            (item) => item._id === event.target.value
          );
          if (workflow) {
            onSelect(workflow);
          }
        }}
        className="flex-1 text-sm bg-gray-800 border border-gray-700 text-gray-100 px-3 py-2 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
      >
        <option value="">Load workflow…</option>
        {workflows.map((workflow) => (
          <option key={workflow._id} value={workflow._id}>
            {workflow.name}
          </option>
        ))}
      </select>

      {activeId && (
        <button
          onClick={() => onDelete(activeId)}
          className="text-xs text-red-400 hover:text-red-300"
        >
          Delete
        </button>
      )}
    </div>
  );
}

function CompositionPreview({
  result,
  onClose,
}: {
  result: ComposedMessages;
  onClose: () => void;
}) {
  const messages =
    result.kind === "bedrock"
      ? result.bedrock?.messages ?? []
      : result.ollama?.messages ?? [];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="w-[520px] max-h-[80vh] bg-gray-900 text-gray-100 rounded-lg border border-gray-700 shadow-2xl overflow-hidden flex flex-col">
        <header className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">
              Composition Preview
            </p>
            <h3 className="text-lg font-semibold text-white">
              Target: {result.kind}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-gray-200"
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <section>
            <h4 className="text-sm font-semibold text-gray-200">
              Messages ({messages.length})
            </h4>
            <div className="mt-2 space-y-3">
              {messages.map((message: any, index: number) => (
                <div
                  key={index}
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                >
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    {message.role}
                  </p>
                  <pre className="mt-1 text-xs text-gray-200 whitespace-pre-wrap">
                    {"content" in message ? JSON.stringify(message.content, null, 2) : ""}
                  </pre>
                </div>
              ))}
            </div>
          </section>

          {result.kind === "bedrock" && result.bedrock && (
            <section className="text-sm text-gray-300 space-y-1">
              <p>
                <span className="text-gray-400">Model:</span>{" "}
                {result.bedrock.modelId}
              </p>
              <p>
                <span className="text-gray-400">Temperature:</span>{" "}
                {result.bedrock.inferenceConfig.temperature ?? "default"}
              </p>
              <p>
                <span className="text-gray-400">maxTokens:</span>{" "}
                {result.bedrock.inferenceConfig.maxTokens ?? "default"}
              </p>
            </section>
          )}

          {result.kind === "ollama" && result.ollama && (
            <section className="text-sm text-gray-300 space-y-1">
              <p>
                <span className="text-gray-400">Model:</span>{" "}
                {result.ollama.model}
              </p>
              <p>
                <span className="text-gray-400">Endpoint:</span>{" "}
                {result.ollama.endpoint}
              </p>
            </section>
          )}

          {result.promptValidator && (
            <section className="text-sm text-gray-300 space-y-1">
              <p className="text-gray-400">Validator</p>
              <pre className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs whitespace-pre-wrap">
                {JSON.stringify(result.promptValidator, null, 2)}
              </pre>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
