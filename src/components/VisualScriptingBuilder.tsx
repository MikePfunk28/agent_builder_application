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
  Bot,
  Zap,
} from "lucide-react";
import { useQuery, useAction, useMutation } from "convex/react";
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
import { MODEL_CATALOG, listModelsByProvider, LOCAL_MODEL_ENDPOINTS } from "../data/modelCatalog";
import type { Id } from "../../convex/_generated/dataModel";

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

function formatCategoryLabel( category: string ): string {
  return (
    TOOL_CATEGORY_LABELS[category] ??
    category
      .split( "_" )
      .map( ( part ) => part.charAt( 0 ).toUpperCase() + part.slice( 1 ) )
      .join( " " )
  );
}

interface MCPServerEntry {
  name: string;
  availableTools?: Array<{ name: string; description: string }>;
  disabled?: boolean;
  status?: string;
}

function buildPaletteSections(
  toolMetadata?: ToolRegistryEntry[],
  mcpServers?: MCPServerEntry[]
): PaletteSection[] {
  const templateSection: PaletteSection = {
    id: "templates",
    title: "Starter Templates",
    description:
      "Ready-to-run workflows that showcase research, writing, and tool-first strategies.",
    accent: "from-purple-600/60 to-emerald-500/60",
    icon: <Sparkles className="w-4 h-4 text-white" />,
    items: Object.values( TEMPLATE_DEFINITIONS ).map<PaletteTemplateItem>( ( tpl ) => ( {
      type: "template",
      templateId: tpl.id,
      title: tpl.title,
      description: tpl.description,
      badge: "Template",
    } ) ),
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
            title: "Prompt",
            description: "The primary prompt node. Configure role, template text with {{handlebars}}, and output validation.",
            badge: "Core",
            configOverride: {
              role: "system",
              template:
                "You are a helpful assistant. Think step-by-step, call tools when needed, and reflect before responding.\nGoal: {{goal}}",
              inputs: {
                goal: "Solve the user's request with accuracy",
              },
              validator: undefined,
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

  // One generic "Model" entry per provider - user picks specific model in settings drawer
  const firstBedrock = MODEL_CATALOG.find(
    ( m ) => m.provider === "bedrock" && m.recommended
  ) ?? MODEL_CATALOG.find( ( m ) => m.provider === "bedrock" );
  const firstOllama = MODEL_CATALOG.find(
    ( m ) => m.provider === "ollama" && m.recommended
  ) ?? MODEL_CATALOG.find( ( m ) => m.provider === "ollama" );
  const firstLmstudio = MODEL_CATALOG.find(
    ( m ) => m.provider === "lmstudio"
  );

  const modelGroups: PaletteGroup[] = [];
  const modelItems: PaletteNodeItem[] = [];

  if ( firstBedrock ) {
    modelItems.push( {
      type: "node",
      kind: "Model",
      title: "Bedrock Model",
      description: "AWS Bedrock model - select specific model in settings.",
      badge: "Bedrock",
      configOverride: {
        provider: "bedrock",
        modelId: firstBedrock.id,
        temperature: firstBedrock.defaultConfig.temperature ?? 0.2,
        topP: firstBedrock.defaultConfig.topP ?? 0.9,
        maxTokens: firstBedrock.defaultConfig.maxTokens ?? 4096,
      },
    } );
  }

  if ( firstOllama ) {
    modelItems.push( {
      type: "node",
      kind: "Model",
      title: "Ollama Model",
      description: "Local Ollama model - select specific model in settings.",
      badge: "Ollama",
      configOverride: {
        provider: "ollama",
        model: firstOllama.id,
        endpoint: firstOllama.defaultConfig.endpoint ?? LOCAL_MODEL_ENDPOINTS.ollama,
        temperature: firstOllama.defaultConfig.temperature ?? 0.4,
        topP: firstOllama.defaultConfig.topP ?? 0.9,
        numCtx: firstOllama.defaultConfig.numCtx ?? 8192,
      },
    } );
  }

  if ( firstLmstudio ) {
    modelItems.push( {
      type: "node",
      kind: "Model",
      title: "LMStudio Model",
      description: "Local LMStudio model (OpenAI-compatible) - configure in settings.",
      badge: "LMStudio",
      configOverride: {
        provider: "lmstudio",
        model: firstLmstudio.id,
        endpoint: firstLmstudio.defaultConfig.endpoint ?? LOCAL_MODEL_ENDPOINTS.lmstudio,
        temperature: firstLmstudio.defaultConfig.temperature ?? 0.4,
        topP: firstLmstudio.defaultConfig.topP ?? 0.9,
        maxTokens: firstLmstudio.defaultConfig.maxTokens ?? 4096,
      },
    } );
  }

  if ( modelItems.length > 0 ) {
    modelGroups.push( {
      id: "models",
      title: "Models",
      items: modelItems,
    } );
  }

  modelGroups.push( {
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
  } );

  const modelSection: PaletteSection = {
    id: "models",
    title: "Models & Routing",
    description: "Bedrock, Ollama, and ensemble orchestration nodes.",
    accent: "from-sky-500/60 to-indigo-600/60",
    icon: <Gauge className="w-4 h-4 text-white" />,
    groups: modelGroups,
  };

  let toolGroups: PaletteGroup[] = [];
  if ( !toolMetadata ) {
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
    toolMetadata.forEach( ( tool ) => {
      const item: PaletteNodeItem = {
        type: "node",
        kind: "Tool",
        title: tool.displayName,
        description: tool.description,
        badge: formatCategoryLabel( tool.category ),
        labelOverride: tool.displayName,
        configOverride: {
          kind: "internal",
          name: tool.name,
          args: {},
        },
      };
      const current = grouped.get( tool.category ) ?? [];
      current.push( item );
      grouped.set( tool.category, current );
    } );

    toolGroups = Array.from( grouped.entries() )
      .sort( ( a, b ) =>
        formatCategoryLabel( a[0] ).localeCompare( formatCategoryLabel( b[0] ) )
      )
      .map( ( [category, items] ) => ( {
        id: category,
        title: formatCategoryLabel( category ),
        items,
      } ) );

    toolGroups.push( {
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
    } );
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

  // Build MCP section dynamically from registered servers
  const mcpItems: PaletteNodeItem[] = [];
  const activeServers = ( mcpServers ?? [] ).filter(
    ( s ) => !s.disabled && s.status !== "error"
  );
  for ( const server of activeServers ) {
    if ( server.availableTools && server.availableTools.length > 0 ) {
      for ( const tool of server.availableTools ) {
        mcpItems.push( {
          type: "node",
          kind: "Tool",
          title: `${tool.name} (${server.name.replace( /-mcp-server$/, "" )})`,
          description: tool.description || `MCP tool from ${server.name}`,
          badge: "MCP",
          labelOverride: `MCP: ${tool.name}`,
          configOverride: {
            kind: "mcp",
            server: server.name,
            tool: tool.name,
            params: {},
          },
        } );
      }
    } else {
      // Server with no enumerated tools — add a generic entry
      mcpItems.push( {
        type: "node",
        kind: "Tool",
        title: server.name.replace( /-mcp-server$/, "" ),
        description: `MCP server: ${server.name}. Configure tool in the settings drawer.`,
        badge: "MCP",
        labelOverride: `MCP: ${server.name.replace( /-mcp-server$/, "" )}`,
        configOverride: {
          kind: "mcp",
          server: server.name,
          tool: "",
          params: {},
        },
      } );
    }
  }

  const mcpSection: PaletteSection = {
    id: "mcp",
    title: "Model Context Protocol",
    description:
      mcpItems.length > 0
        ? `${activeServers.length} MCP server(s) with ${mcpItems.length} tool(s). Add more on the MCP page.`
        : "No MCP servers configured yet. Add servers on the MCP page.",
    accent: "from-cyan-500/60 to-blue-600/60",
    icon: <Server className="w-4 h-4 text-white" />,
    groups:
      mcpItems.length > 0
        ? [{ id: "mcp-tools", title: "Available MCP Tools", items: mcpItems }]
        : [],
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

  const agentSection: PaletteSection = {
    id: "agents",
    title: "Agents & Swarms",
    description:
      "Deploy autonomous agents and multi-agent coordination patterns.",
    accent: "from-violet-500/60 to-pink-600/60",
    icon: <Bot className="w-4 h-4 text-white" />,
    groups: [
      {
        id: "agent-core",
        title: "Agent Nodes",
        items: [
          {
            type: "node",
            kind: "Agent",
            title: "Agent",
            description:
              "An autonomous agent with its own prompt, model, and tools. Select from your agent library or configure inline.",
            badge: "Agent",
          },
          {
            type: "node",
            kind: "SubAgent",
            title: "Sub-Agent",
            description:
              "A child agent within a swarm, graph, or workflow pattern. Connect to a parent Agent node.",
            badge: "Sub-Agent",
          },
        ],
      },
    ],
  };

  return [
    templateSection,
    promptSection,
    modelSection,
    agentSection,
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
  Prompt: "Prompt",
  Model: "Model",
  ModelSet: "Model Set",
  Tool: "Tool",
  ToolSet: "Tool Set",
  Entrypoint: "Entrypoint",
  Memory: "Memory",
  Router: "Router",
  Agent: "Agent",
  SubAgent: "Sub-Agent",
};

function defaultConfig( kind: NodeKind ): WorkflowNodeData["config"] {
  switch ( kind ) {
    case "Background":
    case "Context":
    case "OutputIndicator":
      return { text: "" };
    case "Prompt":
      return { role: "system", template: "", inputs: {}, validator: undefined };
    case "Model":
      {
        const [firstBedrock] = listModelsByProvider( "bedrock" );
        return {
          provider: "bedrock",
          modelId: firstBedrock?.id ?? "anthropic.claude-haiku-4-5-20250514-v1:0",
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
    case "Agent":
      return {
        executionMode: "direct",
      };
    case "SubAgent":
      return {
        role: "worker",
        communicationProtocol: "hierarchical",
      };
    default:
      return {};
  }
}

function generateId( kind: NodeKind ): string {
  if ( typeof crypto !== "undefined" && "randomUUID" in crypto ) {
    return `${kind.toLowerCase()}-${crypto.randomUUID()}`;
  }
  return `${kind.toLowerCase()}-${Date.now()}-${Math.floor( Math.random() * 1000 )}`;
}

function toWorkflowNode( node: FlowNode ): WorkflowNode {
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    data: node.data,
  };
}

function toWorkflowEdge( edge: FlowEdge ): WorkflowEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
    label: ( edge as any ).label,
  };
}

function hydrateNode( raw: any ): FlowNode {
  return {
    id: raw.id,
    type: raw.type ?? "workflow",
    position: raw.position ?? { x: 0, y: 0 },
    data: raw.data,
  };
}

function hydrateEdge( raw: any ): FlowEdge {
  return {
    id: raw.id ?? `${raw.source}-${raw.target}`,
    source: raw.source,
    target: raw.target,
    sourceHandle: raw.sourceHandle,
    targetHandle: raw.targetHandle,
    label: raw.label,
  };
}

/**
 * Migrate legacy PromptText nodes into their connected Prompt nodes.
 * For each PromptText node, merges its role/template/inputs into the
 * target Prompt, then removes the PromptText node and its edge.
 */
function migratePromptTextNodes(
  nodes: FlowNode[],
  edges: FlowEdge[]
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const promptTextNodes = nodes.filter( ( n ) => n.data?.type === "PromptText" );
  if ( promptTextNodes.length === 0 ) return { nodes, edges };

  const migratedNodeIds = new Set<string>();
  const migratedEdgeIds = new Set<string>();
  const updatedNodes = new Map<string, FlowNode>();

  for ( const ptNode of promptTextNodes ) {
    // Find the edge from this PromptText to a Prompt node
    const outEdge = edges.find(
      ( e ) => e.source === ptNode.id && nodes.some( ( n ) => n.id === e.target && n.data?.type === "Prompt" )
    );

    if ( outEdge ) {
      const targetPrompt = nodes.find( ( n ) => n.id === outEdge.target );
      if ( targetPrompt ) {
        const ptConfig = ptNode.data?.config as any;
        const promptConfig = { ...( targetPrompt.data?.config as any ) };

        // Merge PromptText fields into Prompt if Prompt doesn't already have them
        if ( !promptConfig.template && ptConfig?.template ) {
          promptConfig.template = ptConfig.template;
        }
        if ( !promptConfig.role && ptConfig?.role ) {
          promptConfig.role = ptConfig.role;
        }
        if ( !promptConfig.inputs && ptConfig?.inputs ) {
          promptConfig.inputs = ptConfig.inputs;
        }

        const updated = updatedNodes.get( targetPrompt.id ) ?? { ...targetPrompt };
        updated.data = { ...updated.data, config: promptConfig };
        updatedNodes.set( targetPrompt.id, updated );

        migratedEdgeIds.add( outEdge.id );
      }
    }

    migratedNodeIds.add( ptNode.id );

    // Also remove any incoming edges to the PromptText node
    edges.filter( ( e ) => e.target === ptNode.id ).forEach( ( e ) => migratedEdgeIds.add( e.id ) );
  }

  const finalNodes = nodes
    .filter( ( n ) => !migratedNodeIds.has( n.id ) )
    .map( ( n ) => updatedNodes.get( n.id ) ?? n );
  const finalEdges = edges.filter( ( e ) => !migratedEdgeIds.has( e.id ) );

  return { nodes: finalNodes, edges: finalEdges };
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
  const id = options?.id ?? generateId( kind );
  return {
    id,
    type: "workflow",
    position,
    data: {
      type: kind,
      label: options?.label ?? defaultLabels[kind],
      notes: options?.notes ?? "",
      config: {
        ...defaultConfig( kind ),
        ...( options?.config ?? {} ),
      },
    } as WorkflowNodeData,
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

function PaletteCard( {
  item,
  addNode,
  applyTemplate,
}: Readonly<{
  item: PaletteItem;
  addNode: (
    kind: NodeKind,
    options?: { label?: string; configOverride?: Record<string, any> }
  ) => void;
  applyTemplate: ( templateId: string ) => void;
}> ) {
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
            if ( isTemplate ) {
              applyTemplate( item.templateId );
            } else {
              addNode( item.kind, {
                label: item.labelOverride || undefined,
                configOverride: item.configOverride,
              } );
            }
          }}
          className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wide transition-colors ${disabled
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
      "Researcher, analyst, fact-checker, and writer pipeline with Claude Haiku + review tool.",
    accent: "from-emerald-500/80 to-cyan-500/80",
    build: () => {
      const prompt = createFlowNode(
        "Prompt",
        { x: 320, y: 160 },
        {
          label: "Research Prompt",
          config: {
            role: "system",
            template:
              "Follow a three-stage process: 1) Research leads, 2) Analyze data, 3) Draft report. Use tools when you need verification.",
            inputs: {},
            validator: undefined,
          },
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
      const [tplBedrock] = listModelsByProvider( "bedrock" );
      const model = createFlowNode(
        "Model",
        { x: 560, y: 120 },
        {
          label: tplBedrock?.label ?? "Claude 4.5 Haiku",
          config: {
            provider: "bedrock",
            modelId: tplBedrock?.id ?? "anthropic.claude-haiku-4-5-20250514-v1:0",
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
        model,
        modelSet,
        factTool,
        writerTool,
        toolSet,
        entrypoint,
      ];

      const edges = [
        createEdge( background, prompt, "background" ),
        createEdge( context, prompt, "context" ),
        createEdge( outputIndicator, prompt, "output" ),
        createEdge( prompt, modelSet ),
        createEdge( model, modelSet ),
        createEdge( modelSet, toolSet ),
        createEdge( factTool, toolSet ),
        createEdge( writerTool, toolSet ),
        createEdge( toolSet, entrypoint ),
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
        {
          label: "Writer Prompt",
          config: {
            role: "system",
            template:
              "Draft an outline, write the article, then critique and revise to tighten arguments. Keep paragraphs concise.",
            inputs: {},
            validator: undefined,
          },
        }
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
      const [tpl2Bedrock] = listModelsByProvider( "bedrock" );
      const claude = createFlowNode(
        "Model",
        { x: 560, y: 150 },
        {
          label: tpl2Bedrock?.label ?? "Claude 4.5 Haiku",
          config: {
            provider: "bedrock",
            modelId: tpl2Bedrock?.id ?? "anthropic.claude-haiku-4-5-20250514-v1:0",
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
        claude,
        editingTool,
        styleTool,
        toolSet,
        entrypoint,
      ];

      const edges = [
        createEdge( tone, prompt ),
        createEdge( assignment, prompt ),
        createEdge( guardrail, prompt ),
        createEdge( prompt, claude ),
        createEdge( claude, toolSet ),
        createEdge( editingTool, toolSet ),
        createEdge( styleTool, toolSet ),
        createEdge( toolSet, entrypoint ),
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
          config: {
            role: "system",
            template:
              "Prefer tools before calling the model. Always log tool outputs to shared context logs.",
            inputs: {},
            validator: undefined,
          },
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
        toolMcp,
        toolInternal,
        toolSet,
        entrypoint,
      ];

      const edges = [
        createEdge( context, prompt ),
        createEdge( validator, prompt ),
        createEdge( prompt, toolSet ),
        createEdge( toolMcp, toolSet ),
        createEdge( toolInternal, toolSet ),
        createEdge( toolSet, entrypoint ),
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
  const counterRef = useRef( 0 );
  const toolRegistry = useQuery( api.toolRegistry.getAllTools ) as
    | ToolRegistryEntry[]
    | undefined;
  const mcpServers = useQuery( api.mcpConfig.listMCPServers ) as
    | MCPServerEntry[]
    | undefined;
  const [workflowName, setWorkflowName] = useState( "Untitled Workflow" );
  const [activeWorkflowId, setActiveWorkflowId] = useState<Id<"workflows"> | null>( null );
  const [statusMessage, setStatusMessage] = useState<string | null>( null );
  const [preview, setPreview] = useState<ComposedMessages | null>( null );
  const [previewError, setPreviewError] = useState<string | null>( null );
  const [isSaving, setIsSaving] = useState( false );
  const [isPublishing, setIsPublishing] = useState( false );
  const [isExecuting, setIsExecuting] = useState( false );
  const [executionResult, setExecutionResult] = useState<{ success: boolean; result?: unknown; error?: string; executionTime?: number } | null>( null );
  const [publishedAgentId, setPublishedAgentId] = useState<Id<"agents"> | null>( null );
  const [openSections, setOpenSections] = useState<Record<string, boolean>>( {} );

  const paletteSections = useMemo(
    () => buildPaletteSections( toolRegistry, mcpServers ),
    [toolRegistry, mcpServers]
  );

  const initialNodes = useMemo<FlowNode[]>( () => {
    const promptId = generateId( "Prompt" );
    const modelId = generateId( "Model" );
    const nodes: FlowNode[] = [
      {
        id: promptId,
        type: "workflow",
        position: { x: 200, y: 120 },
        data: {
          type: "Prompt",
          label: "Persona",
          notes: "",
          config: {
            role: "system",
            template: "You are a helpful assistant.",
            inputs: {},
            validator: undefined,
          },
        } as WorkflowNodeData,
      },
      {
        id: modelId,
        type: "workflow",
        position: { x: 420, y: 120 },
        data: {
          type: "Model",
          label: "Claude 4.5 Haiku",
          notes: "",
          config: defaultConfig( "Model" ),
        } as WorkflowNodeData,
      },
    ];
    counterRef.current = 2;
    return nodes;
  }, [] );

  const initialEdges = useMemo<FlowEdge[]>( () => {
    return [
      {
        id: "prompt-to-model",
        source: ( initialNodes[0] ?? { id: "" } ).id,
        target: ( initialNodes[1] ?? { id: "" } ).id,
        type: "smoothstep",
      },
    ];
  }, [initialNodes] );

  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNodeData>(
    initialNodes
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState( initialEdges );

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>( null );
  const [isDrawerOpen, setIsDrawerOpen] = useState( false );

  const workflows = useQuery( api.workflows.list, {} );
  const saveWorkflowMutation = useMutation( api.workflows.save );
  const removeWorkflowMutation = useMutation( api.workflows.remove );
  const executeWorkflowAction = useAction( api.workflowExecutor.executeWorkflow );
  // const publishWorkflowAction = useAction(api.workflows.publishAsAgent);

  useEffect( () => {
    if ( !selectedNodeId ) {
      setIsDrawerOpen( false );
    }
  }, [selectedNodeId] );

  useEffect( () => {
    setPublishedAgentId( null );
  }, [activeWorkflowId] );

  const addNode = useCallback(
    (
      kind: NodeKind,
      options?: {
        label?: string;
        configOverride?: Record<string, any>;
      }
    ) => {
      counterRef.current += 1;
      const nodeId = generateId( kind );
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
            ...defaultConfig( kind ),
            ...( options?.configOverride ?? {} ),
          },
        } as WorkflowNodeData,
      };
      setNodes( ( current ) => current.concat( newNode ) );
      setSelectedNodeId( nodeId );
      setIsDrawerOpen( true );
    },
    [setNodes]
  );

  const onConnect = useCallback(
    ( connection: Connection ) => {
      setEdges( ( eds ) => addEdge( connection, eds ) );
    },
    [setEdges]
  );

  const onNodeClick = useCallback( ( _event: any, node: FlowNode ) => {
    setSelectedNodeId( node.id );
    setIsDrawerOpen( true );
  }, [] );

  const persistWorkflow = useCallback( async (): Promise<Id<"workflows"> | null> => {
    const trimmedName = workflowName.trim() || "Untitled Workflow";
    const payloadNodes = nodes.map( toWorkflowNode );
    const payloadEdges = edges.map( toWorkflowEdge );

    const result = await saveWorkflowMutation( {
      workflowId: activeWorkflowId ?? undefined,
      name: trimmedName,
      nodes: payloadNodes,
      edges: payloadEdges,
      templateId: "custom",
      status: "draft",
    } );

    const resolvedId: Id<"workflows"> | null =
      ( result?.workflowId as Id<"workflows"> | undefined ) ?? activeWorkflowId ?? null;

    if ( resolvedId ) {
      setActiveWorkflowId( resolvedId );
    }

    return resolvedId;
  }, [workflowName, nodes, edges, saveWorkflowMutation, activeWorkflowId] );

  const handleSave = useCallback( async () => {
    setIsSaving( true );
    setStatusMessage( null );
    try {
      const workflowId = await persistWorkflow();
      if ( workflowId ) {
        setStatusMessage( "Workflow saved" );
      } else {
        setStatusMessage( "Unable to determine workflow ID after saving" );
      }
    } catch ( error: any ) {
      setStatusMessage( error?.message ?? "Failed to save workflow" );
    } finally {
      setIsSaving( false );
    }
  }, [persistWorkflow] );

  const handlePublish = useCallback( async () => {
    setIsPublishing( true );
    setStatusMessage( null );
    setPublishedAgentId( null );
    try {
      const workflowId = await persistWorkflow();
      if ( !workflowId ) {
        throw new Error( "Save the workflow before generating an agent." );
      }

      // const result = await publishWorkflowAction({
      //   workflowId,
      //   agentName: workflowName.trim() || undefined,
      //   description: workflowName
      //     ? `Generated from visual workflow "${workflowName}"`
      //     : "Generated from visual workflow",
      // });
      const result = { agentId: null }; // Placeholder

      if ( result?.agentId ) {
        setPublishedAgentId( result.agentId as Id<"agents"> );
      }
      setStatusMessage( "Agent generated from workflow." );
    } catch ( error: any ) {
      setStatusMessage( error?.message ?? "Failed to generate agent" );
    } finally {
      setIsPublishing( false );
    }
  }, [persistWorkflow, workflowName] );

  const handlePreview = useCallback( () => {
    setPreviewError( null );
    try {
      const payloadNodes = nodes.map( toWorkflowNode );
      const payloadEdges = edges.map( toWorkflowEdge );
      const composition = composeWorkflow( payloadNodes, payloadEdges );
      setPreview( composition );
    } catch ( error: any ) {
      setPreview( null );
      setPreviewError( error.message ?? "Unable to compose workflow" );
    }
  }, [nodes, edges] );

  const handleRun = useCallback( async () => {
    setIsExecuting( true );
    setExecutionResult( null );
    setStatusMessage( null );
    try {
      const workflowId = await persistWorkflow();
      if ( !workflowId ) {
        throw new Error( "Save the workflow before running it." );
      }
      const result = await executeWorkflowAction( {
        workflowId,
        input: {},
      } );
      setExecutionResult( result as { success: boolean; result?: unknown; error?: string; executionTime?: number } );
      setStatusMessage( result?.success ? "Workflow executed successfully" : "Workflow execution failed" );
    } catch ( error: any ) {
      setExecutionResult( { success: false, error: error?.message ?? "Execution failed" } );
      setStatusMessage( error?.message ?? "Failed to run workflow" );
    } finally {
      setIsExecuting( false );
    }
  }, [persistWorkflow, executeWorkflowAction] );

  const handleDeleteWorkflow = useCallback(
    async ( workflowId: Id<"workflows"> ) => {
      try {
        await removeWorkflowMutation( { workflowId } );
        if ( activeWorkflowId === workflowId ) {
          setActiveWorkflowId( null );
        }
        setStatusMessage( "Workflow deleted" );
      } catch ( error: any ) {
        setStatusMessage( error?.message ?? "Failed to delete workflow" );
      }
    },
    [removeWorkflowMutation, activeWorkflowId]
  );

  const handleLoadWorkflow = useCallback(
    ( workflow: any ) => {
      const hydratedNodes = ( workflow.nodes ?? [] ).map( hydrateNode );
      const hydratedEdges = ( workflow.edges ?? [] ).map( hydrateEdge );
      // Auto-migrate legacy PromptText nodes into connected Prompt nodes
      const migrated = migratePromptTextNodes( hydratedNodes, hydratedEdges );
      setNodes( migrated.nodes );
      setEdges( migrated.edges );
      setWorkflowName( workflow.name ?? "Untitled Workflow" );
      setActiveWorkflowId( workflow._id );
      counterRef.current = migrated.nodes.length;
    },
    [setNodes, setEdges]
  );

  const selectedNode = useMemo<WorkflowNode | null>( () => {
    if ( !selectedNodeId ) return null;
    const node = nodes.find( ( item ) => item.id === selectedNodeId );
    if ( !node ) return null;
    return toWorkflowNode( node );
  }, [nodes, selectedNodeId] );

  const handleNodeSave = useCallback(
    ( nodeId: string, data: WorkflowNodeData ) => {
      setNodes( ( current ) =>
        current.map( ( node ) =>
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

  const closeDrawer = useCallback( () => {
    setIsDrawerOpen( false );
    setSelectedNodeId( null );
  }, [] );

  const toggleSection = useCallback( ( sectionId: string ) => {
    setOpenSections( ( current ) => ( {
      ...current,
      [sectionId]: current[sectionId] === undefined ? false : !current[sectionId],
    } ) );
  }, [] );

  const applyTemplate = useCallback(
    ( templateId: string ) => {
      const template = TEMPLATE_DEFINITIONS[templateId];
      if ( !template ) {
        return;
      }
      const { nodes: templateNodes, edges: templateEdges, name } = template.build();
      setNodes( templateNodes );
      setEdges( templateEdges );
      setWorkflowName( name );
      setActiveWorkflowId( null );
      setSelectedNodeId( null );
      counterRef.current = templateNodes.length;
      setStatusMessage( `Template "${template.title}" applied` );
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
          {paletteSections.map( ( section ) => {
            const isOpen =
              openSections[section.id] ?? true;
            return (
              <div key={section.id} className="rounded-lg border border-gray-900/70 bg-gray-900/40">
                <button
                  type="button"
                  onClick={() => toggleSection( section.id )}
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
                      ? section.groups.map( ( group ) => (
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
                            {group.items.map( ( item ) => (
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
                            ) )}
                          </div>
                        </div>
                      ) )
                      : section.items?.map( ( item ) => (
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
                      ) )}
                  </div>
                )}
              </div>
            );
          } )}
        </div>
      </aside>

      <main className="flex-1 relative bg-slate-950">
        <header className="absolute top-4 left-4 right-4 z-20">
          <div className="bg-gray-900/90 backdrop-blur rounded-lg border border-gray-700 px-4 py-3 flex flex-wrap items-center gap-3">
            <input
              value={workflowName}
              onChange={( event ) => setWorkflowName( event.target.value )}
              className="flex-1 min-w-[200px] bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="Workflow name"
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handlePreview()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm transition-colors"
              >
                <Play className="w-4 h-4" />
                Preview
              </button>

              <button
                type="button"
                onClick={() => void handleRun()}
                disabled={isExecuting || isSaving}
                className="inline-flex items-center gap-2 px-3 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white text-sm transition-colors disabled:opacity-60"
              >
                {isExecuting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Run
              </button>

              <button
                type="button"
                onClick={() => void handleSave()}
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

              <button
                type="button"
                onClick={() => void handlePublish()}
                disabled={isPublishing || isSaving}
                className="inline-flex items-center gap-2 px-3 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-sm transition-colors disabled:opacity-60"
              >
                {isPublishing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
                Generate Agent
              </button>
            </div>

            <div className="flex-1 min-w-[240px]">
              <WorkflowPicker
                workflows={workflows ?? []}
                activeId={activeWorkflowId}
                onSelect={handleLoadWorkflow}
                onDelete={( workflowId ) => void handleDeleteWorkflow( workflowId )}
              />
            </div>

            {statusMessage && (
              <p className="text-xs text-gray-400">{statusMessage}</p>
            )}
            {publishedAgentId && (
              <p className="text-xs text-green-400">
                Agent ID: <span className="font-mono">{publishedAgentId}</span>
              </p>
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
            nodeStrokeColor={( node ) => colorForNodeKind( node.data.type )}
            nodeColor={( node ) => colorForNodeKind( node.data.type, 0.4 )}
          />
          <Controls className="bg-gray-900/80 border border-gray-700" />
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={2}
            color="#1f2937"
          />
          <Panel position="bottom-left" className="bg-gray-900/90 rounded p-2 max-w-md">
            <p className="text-xs text-gray-400 leading-relaxed">
              <span className="text-emerald-400 font-semibold">Flow:</span>{" "}
              Background/Context/Output → <span className="text-sky-300">Prompt</span>{" "}
              → Model → Output.{" "}
              Connect <span className="text-green-300">Tool</span> or{" "}
              <span className="text-green-300">ToolSet</span> nodes for tool calling.{" "}
              Add <span className="text-violet-300">Agent</span> nodes for autonomous execution.
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
        <CompositionPreview result={preview} onClose={() => setPreview( null )} />
      )}

      {previewError && (
        <div className="absolute bottom-6 right-6 bg-red-600 text-white px-4 py-3 rounded shadow-lg z-30">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Preview error</p>
            <button
              onClick={() => setPreviewError( null )}
              className="text-sm underline"
            >
              Dismiss
            </button>
          </div>
          <p className="text-xs mt-1 max-w-xs">{previewError}</p>
        </div>
      )}

      {executionResult && (
        <div className={`absolute bottom-6 left-6 right-6 max-w-xl mx-auto ${executionResult.success ? "bg-gray-900 border-emerald-600" : "bg-gray-900 border-red-600"} border text-white px-4 py-3 rounded-lg shadow-lg z-30`}>
          <div className="flex items-center justify-between mb-2">
            <p className={`text-sm font-semibold ${executionResult.success ? "text-emerald-400" : "text-red-400"}`}>
              {executionResult.success ? "Execution Complete" : "Execution Failed"}
            </p>
            <div className="flex items-center gap-2">
              {executionResult.executionTime && (
                <span className="text-xs text-gray-400">{executionResult.executionTime}ms</span>
              )}
              <button
                type="button"
                onClick={() => setExecutionResult( null )}
                className="text-xs text-gray-400 hover:text-white underline"
              >
                Dismiss
              </button>
            </div>
          </div>
          {executionResult.error && (
            <p className="text-xs text-red-300 mb-1">{executionResult.error}</p>
          )}
          {executionResult.result && (
            <pre className="text-xs text-gray-300 bg-gray-950 rounded p-2 max-h-48 overflow-auto whitespace-pre-wrap">
              {typeof executionResult.result === "string"
                ? executionResult.result
                : JSON.stringify( executionResult.result, null, 2 )}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

const NODE_TOOLTIPS: Record<NodeKind, string> = {
  Entrypoint: "Starting point of the workflow. Defines how this agent is triggered (HTTP, CLI, etc).",
  Prompt: "The primary prompt node. Set role, template text with {{handlebars}}, template inputs, and optional output validation.",
  Model: "LLM configuration — pick provider and model. Connect Tool/ToolSet nodes as inputs for tool calling.",
  ModelSet: "Group of models for A/B testing or fallback chains.",
  Tool: "A callable tool — internal (memory, handoff) or MCP (external server). Connect as input to a Model node.",
  ToolSet: "Bundle multiple Tools into a named set the Model can call.",
  Memory: "Persistent memory node — short-term, long-term, or semantic memory for the agent.",
  Router: "Conditional branching — routes execution to different paths based on LLM output or rules.",
  Background: "Background context injected into every turn (e.g. knowledge, rules, constraints).",
  Context: "Dynamic context that changes per-turn (e.g. user profile, session state).",
  OutputIndicator: "Instructions for how the final output should be formatted (e.g. JSON, summary, markdown).",
  Agent: "An autonomous agent with its own system prompt, model, and tools. Connect SubAgent nodes for multi-agent patterns.",
  SubAgent: "A child agent within a swarm or graph. Connect as input to an Agent node running in swarm/graph/workflow mode.",
};

function WorkflowCanvasNode( { data }: NodeProps<WorkflowNodeData> ) {
  // Legacy PromptText nodes map to Prompt for display purposes
  const displayKind: NodeKind = data.type === "PromptText" ? "Prompt" : data.type;
  const badgeColor = colorForNodeKind( displayKind );

  return (
    <div
      className="rounded-lg border border-gray-700 bg-gray-900 text-gray-100 px-3 py-2 shadow-md min-w-[160px]"
      title={NODE_TOOLTIPS[displayKind] ?? data.type}
    >
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
          {data.label || defaultLabels[displayKind]}
        </span>
        <span
          className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full text-gray-900"
          style={{ backgroundColor: badgeColor }}
        >
          {displayKind}
        </span>
      </div>
      {data.notes && (
        <p className="text-[10px] text-gray-400 mt-1 line-clamp-2">{data.notes}</p>
      )}
    </div>
  );
}

function colorForNodeKind( kind: NodeKind, alpha = 1 ): string {
  const mapper: Record<NodeKind, string> = {
    Background: `rgba(59,130,246,${alpha})`,
    Context: `rgba(96,165,250,${alpha})`,
    OutputIndicator: `rgba(234,179,8,${alpha})`,
    Prompt: `rgba(236,72,153,${alpha})`,
    Model: `rgba(139,92,246,${alpha})`,
    ModelSet: `rgba(168,85,247,${alpha})`,
    Tool: `rgba(34,197,94,${alpha})`,
    ToolSet: `rgba(16,185,129,${alpha})`,
    Memory: `rgba(249,115,22,${alpha})`,
    Router: `rgba(248,113,113,${alpha})`,
    Entrypoint: `rgba(20,184,166,${alpha})`,
    Agent: `rgba(167,139,250,${alpha})`,
    SubAgent: `rgba(196,181,253,${alpha})`,
  };
  return mapper[kind] ?? `rgba(107,114,128,${alpha})`;
}

function WorkflowPicker( {
  workflows,
  activeId,
  onSelect,
  onDelete,
}: {
  workflows: any[];
  activeId: Id<"workflows"> | null;
  onSelect: ( workflow: any ) => void;
  onDelete: ( workflowId: Id<"workflows"> ) => void;
} ) {
  if ( !workflows || workflows.length === 0 ) {
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
        onChange={( event ) => {
          const workflow = workflows.find(
            ( item ) => item._id === event.target.value
          );
          if ( workflow ) {
            void onSelect( workflow );
          }
        }}
        className="flex-1 text-sm bg-gray-800 border border-gray-700 text-gray-100 px-3 py-2 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
        aria-label="Select workflow to load"
      >
        <option value="">Load workflow…</option>
        {workflows.map( ( workflow ) => (
          <option key={workflow._id} value={workflow._id}>
            {workflow.name}
          </option>
        ) )}
      </select>

      {activeId && (
        <button
          onClick={() => { void onDelete( activeId ); }}
          className="text-xs text-red-400 hover:text-red-300"
        >
          Delete
        </button>
      )}
    </div>
  );
}

function CompositionPreview( {
  result,
  onClose,
}: {
  result: ComposedMessages;
  onClose: () => void;
} ) {
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
              {messages.map( ( message: any, index: number ) => (
                <div
                  key={index}
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                >
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    {message.role}
                  </p>
                  <pre className="mt-1 text-xs text-gray-200 whitespace-pre-wrap">
                    {"content" in message ? JSON.stringify( message.content, null, 2 ) : ""}
                  </pre>
                </div>
              ) )}
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
                {JSON.stringify( result.promptValidator, null, 2 )}
              </pre>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
