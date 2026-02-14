import { action, mutation, query, internalQuery, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { WorkflowNode } from "../src/types/workflowNodes";
import { findToolMetadata, normalizeToolName } from "./lib/strandsTools";

async function getUserScope( ctx: any ): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if ( !identity ) {
    throw new Error( "Authentication required to manage workflows." );
  }

  const scope =
    identity.subject ||
    identity.tokenIdentifier ||
    identity.email ||
    identity.provider;

  if ( !scope ) {
    throw new Error( "Unable to resolve user identity." );
  }

  return scope;
}

const ALLOWED_NODE_TYPES = new Set( [
  "Prompt",
  "PromptText",       // Deprecated – kept for migration of saved workflows
  "Background",
  "Context",
  "OutputIndicator",
  "Model",
  "ModelSet",
  "Tool",
  "ToolSet",
  "Router",
  "Memory",
  "Entrypoint",
  "Agent",
  "SubAgent",
  "Decision",
  "Aggregate",
  "Human",
  "Embedding",
  "Retrieval",
  "Rerank",
  "AwsService",
  "Database",
  "Storage",
  "Compute",
  "Networking",
  "Security",
  "Monitoring",
  "AI-ML",
] );

function sanitizeString( value: unknown, maxLength: number ) {
  if ( typeof value !== "string" ) {
    return "";
  }
  return value.slice( 0, maxLength );
}

function deepSanitize( value: any, maxStringLength = 4000, depth = 0 ): any {
  if ( depth > 4 ) {
    return null;
  }

  if ( typeof value === "string" ) {
    return sanitizeString( value, maxStringLength );
  }

  if ( Array.isArray( value ) ) {
    return value.slice( 0, 50 ).map( ( entry ) => deepSanitize( entry, maxStringLength, depth + 1 ) );
  }

  if ( typeof value === "object" && value !== null ) {
    const sanitized: Record<string, any> = {};
    for ( const [key, val] of Object.entries( value ).slice( 0, 50 ) ) {
      sanitized[key] = deepSanitize( val, maxStringLength, depth + 1 );
    }
    return sanitized;
  }

  if ( typeof value === "number" || typeof value === "boolean" ) {
    return value;
  }

  return null;
}

function sanitizeNode( node: any ) {
  if ( typeof node !== "object" || node === null ) {
    throw new Error( "Invalid node payload." );
  }

  const id = sanitizeString( node.id, 128 );
  const data = node.data ?? {};
  const nodeKind = sanitizeString( data.type, 64 );

  if ( !id ) {
    throw new Error( "Workflow nodes must include an id." );
  }

  if ( !nodeKind || !ALLOWED_NODE_TYPES.has( nodeKind ) ) {
    throw new Error( `Unsupported node type: ${nodeKind || "unknown"}.` );
  }

  const position =
    typeof node.position === "object" && node.position !== null
      ? {
        x: Number( node.position.x ) || 0,
        y: Number( node.position.y ) || 0,
      }
      : undefined;

  const label = sanitizeString( data.label, 256 );
  const notes = sanitizeString( data.notes, 4000 );

  const config =
    typeof data.config === "object" && data.config !== null
      ? deepSanitize( data.config )
      : {};

  return {
    id,
    type: "workflow",
    position,
    data: {
      type: nodeKind,
      label,
      notes,
      config,
    },
  };
}

function sanitizeEdge( edge: any ) {
  if ( typeof edge !== "object" || edge === null ) {
    throw new Error( "Invalid edge payload." );
  }

  const id = sanitizeString( edge.id, 128 );
  const source = sanitizeString( edge.source, 128 );
  const target = sanitizeString( edge.target, 128 );
  const type = sanitizeString( edge.type ?? "smoothstep", 32 );

  if ( !id || !source || !target ) {
    throw new Error( "Edges must include id, source, and target." );
  }

  return { id, source, target, type };
}

function sanitizeWorkflowPayload( nodes: any[], edges: any[] ) {
  if ( !Array.isArray( nodes ) || nodes.length === 0 ) {
    throw new Error( "Workflows require at least one node." );
  }

  if ( nodes.length > 150 ) {
    throw new Error( "Workflow node limit exceeded (max 150)." );
  }

  if ( !Array.isArray( edges ) ) {
    throw new Error( "Edges payload must be an array." );
  }

  if ( edges.length > 300 ) {
    throw new Error( "Workflow edge limit exceeded (max 300)." );
  }

  const sanitizedNodes = nodes.map( sanitizeNode );
  const sanitizedEdges = edges.map( sanitizeEdge );

  return { sanitizedNodes, sanitizedEdges };
}

export const list = query( {
  args: {},
  handler: async ( ctx ) => {
    const userScope = await getUserScope( ctx );
    return await ctx.db
      .query( "workflows" )
      .withIndex( "by_user", ( q ) => q.eq( "userId", userScope ) )
      .order( "desc" )
      .take( 50 );
  },
} );

export const get = query( {
  args: {
    workflowId: v.id( "workflows" ),
  },
  handler: async ( ctx, args ) => {
    const workflow = await ctx.db.get( args.workflowId );
    if ( !workflow ) {
      return null;
    }
    const userScope = await getUserScope( ctx );
    if ( workflow.userId !== userScope ) {
      throw new Error( "Workflow not found for current user" );
    }
    return workflow;
  },
} );

// Internal query for Node.js actions to fetch workflows without user scope check
export const getInternal = internalQuery( {
  args: {
    workflowId: v.id( "workflows" ),
  },
  handler: async ( ctx, args ) => {
    return await ctx.db.get( args.workflowId );
  },
} );

// Internal mutation to update workflow status from actions
export const updateStatusInternal = internalMutation( {
  args: {
    workflowId: v.id( "workflows" ),
    status: v.string(),
  },
  handler: async ( ctx, args ) => {
    await ctx.db.patch( args.workflowId, {
      status: args.status,
      updatedAt: Date.now(),
    } );
  },
} );

export const save = mutation( {
  args: {
    workflowId: v.optional( v.id( "workflows" ) ),
    name: v.string(),
    nodes: v.array( v.any() ), // v.any(): raw frontend nodes — sanitized by sanitizeWorkflowPayload before storage
    edges: v.array( v.any() ), // v.any(): raw frontend edges — sanitized by sanitizeWorkflowPayload before storage
    templateId: v.optional( v.string() ),
    status: v.optional( v.string() ),
  },
  handler: async ( ctx, args ) => {
    const userScope = await getUserScope( ctx );
    const now = Date.now();
    const status = args.status ?? "draft";
    const templateId = args.templateId ?? "custom";
    const { sanitizedNodes, sanitizedEdges } = sanitizeWorkflowPayload( args.nodes, args.edges );

    if ( args.workflowId ) {
      const existing = await ctx.db.get( args.workflowId );
      if ( !existing ) {
        throw new Error( "Workflow not found" );
      }
      if ( existing.userId !== userScope ) {
        throw new Error( "Workflow not found for current user" );
      }
      await ctx.db.patch( args.workflowId, {
        name: args.name,
        nodes: sanitizedNodes,
        edges: sanitizedEdges,
        status,
        updatedAt: now,
      } );
      return { workflowId: args.workflowId };
    }

    const workflowId = await ctx.db.insert( "workflows", {
      name: args.name,
      userId: userScope,
      templateId,
      nodes: sanitizedNodes,
      edges: sanitizedEdges,
      status,
      createdAt: now,
      updatedAt: now,
    } );

    return { workflowId };
  },
} );

export const remove = mutation( {
  args: {
    workflowId: v.id( "workflows" ),
  },
  handler: async ( ctx, args ) => {
    const existing = await ctx.db.get( args.workflowId );
    if ( !existing ) {
      return { removed: false };
    }
    const userScope = await getUserScope( ctx );
    if ( existing.userId !== userScope ) {
      throw new Error( "Workflow not found for current user" );
    }
    await ctx.db.delete( args.workflowId );
    return { removed: true };
  },
} );

type AgentBlueprint = {
  name: string;
  description: string;
  model: string;
  modelProvider: string;
  deploymentType: "aws" | "ollama";
  systemPrompt: string;
  tools: any[];
};

export const publishAsAgent = action( {
  args: {
    workflowId: v.id( "workflows" ),
    agentName: v.optional( v.string() ),
    description: v.optional( v.string() ),
  },
  handler: async ( ctx, args ): Promise<{ agentId: Id<"agents">; workflowId: Id<"workflows"> }> => {
    const userScope = await getUserScope( ctx );
    const workflow = await ctx.runQuery( internal.workflows.getInternal, {
      workflowId: args.workflowId,
    } );

    if ( !workflow ) {
      throw new Error( "Workflow not found" );
    }

    if ( workflow.userId !== userScope ) {
      throw new Error( "You do not have access to this workflow" );
    }

    const blueprint = buildAgentBlueprint( {
      workflow,
      requestedName: args.agentName,
      requestedDescription: args.description,
    } );

    const generation: { generatedCode: string; requirementsTxt: string; mcpConfig: string | null } = await ctx.runAction( api.codeGenerator.generateAgent, {
      name: blueprint.name,
      model: blueprint.model,
      systemPrompt: blueprint.systemPrompt,
      tools: blueprint.tools,
      deploymentType: blueprint.deploymentType,
    } );

    const agentId: Id<"agents"> = await ctx.runMutation( api.agents.create, {
      name: blueprint.name,
      description: blueprint.description,
      model: blueprint.model,
      modelProvider: blueprint.modelProvider,
      systemPrompt: blueprint.systemPrompt,
      tools: blueprint.tools,
      generatedCode: generation.generatedCode,
      dockerConfig: "",
      deploymentType: blueprint.deploymentType,
      isPublic: false,
      exposableAsMCPTool: false,
      mcpToolName: "",
      mcpInputSchema: undefined,
      sourceWorkflowId: args.workflowId,
    } as any );

    await ctx.runMutation( internal.workflows.updateStatusInternal, {
      workflowId: args.workflowId,
      status: "published",
    } );

    return {
      agentId,
      workflowId: args.workflowId,
    };
  },
} );

function buildAgentBlueprint( params: {
  workflow: any;
  requestedName?: string | null;
  requestedDescription?: string | null;
} ): AgentBlueprint {
  const nodes = ( params.workflow.nodes || [] ) as WorkflowNode[];
  if ( !nodes.length ) {
    throw new Error( "Workflow must include at least one node before publishing." );
  }

  const modelNode = nodes.find( ( node ) => node.data?.type === "Model" );
  if ( !modelNode ) {
    throw new Error( "Add a Model node before generating an agent." );
  }

  const { model, modelProvider, deploymentType } = extractModelFromNode( modelNode );
  const systemPrompt = buildSystemPrompt( nodes );
  const toolSpecs = buildToolSpecs( nodes );

  const name = ( params.requestedName?.trim() || params.workflow.name || "Visual Workflow Agent" ).slice( 0, 80 );
  const description =
    params.requestedDescription?.trim() ||
    `Agent generated from visual workflow "${params.workflow.name}".`;

  return {
    name,
    description,
    model,
    modelProvider,
    deploymentType,
    systemPrompt,
    tools: toolSpecs,
  };
}

function extractModelFromNode( node: WorkflowNode ): {
  model: string;
  modelProvider: string;
  deploymentType: "aws" | "ollama";
} {
  const config: any = node.data?.config || {};
  const model = config.modelId || config.model || "anthropic.claude-3-5-sonnet-20241022-v2:0";

  let provider = ( config.provider || "" ).toLowerCase();
  if ( !provider ) {
    // Bedrock IDs contain dots before the colon (e.g. "anthropic.claude-3-5-sonnet:0")
    // Ollama IDs have no dots (e.g. "llama3:latest")
    if ( model.includes( ":" ) ) {
      const prefix = model.split( ":" )[0];
      provider = prefix.includes( "." ) ? "bedrock" : "ollama";
    } else {
      provider = "bedrock";
    }
  }

  const deploymentType: "aws" | "ollama" = provider === "ollama" ? "ollama" : "aws";
  const modelProvider = provider === "ollama" ? "ollama" : "bedrock";

  return { model, modelProvider, deploymentType };
}

function buildSystemPrompt( nodes: WorkflowNode[] ): string {
  const sections: string[] = [];

  const backgrounds = nodes
    .filter( ( node ): node is WorkflowNode & { data: { type: "Background"; config: { text: string } } } =>
      node.data?.type === "Background" && "text" in ( node.data.config || {} ) )
    .map( ( node ) => node.data.config.text );
  if ( backgrounds.length ) {
    sections.push( backgrounds.join( "\n\n" ) );
  }

  const systemSnippets = nodes
    .filter( ( node ): node is WorkflowNode & { data: { type: "PromptText"; config: { role?: string; template: string } } } =>
      node.data?.type === "PromptText" )
    .filter( ( node ) => ( node.data.config.role || "system" ) === "system" )
    .map( ( node ) => node.data.config.template )
    .filter( Boolean );
  if ( systemSnippets.length ) {
    sections.push( systemSnippets.join( "\n\n" ) );
  }

  // Prompt templates are the primary authored instructions in modern workflows.
  const promptTemplates = nodes
    .filter( ( node ) => node.data?.type === "Prompt" )
    .map( ( node ) => {
      const config: any = node.data?.config || {};
      const role = typeof config.role === "string" ? config.role : "system";
      const template = typeof config.template === "string" ? config.template.trim() : "";
      return { role, template };
    } )
    .filter( ( item ) => item.template.length > 0 );

  const systemPromptTemplates = promptTemplates
    .filter( ( item ) => item.role === "system" )
    .map( ( item ) => item.template );
  if ( systemPromptTemplates.length ) {
    sections.push( systemPromptTemplates.join( "\n\n" ) );
  } else if ( promptTemplates.length ) {
    // Fallback to non-system templates if no explicit system prompt exists.
    sections.push( promptTemplates.map( ( item ) => item.template ).join( "\n\n" ) );
  }

  const promptNode = nodes.find( ( node ) => node.data?.type === "Prompt" );
  const promptNotes = promptNode?.data?.notes || "";
  if ( promptNotes ) {
    sections.push( promptNotes );
  }

  const combined = sections.join( "\n\n" ).trim();
  return combined || "You are a helpful assistant. Think step-by-step and call tools when they improve accuracy.";
}

function buildToolSpecs( nodes: WorkflowNode[] ) {
  const specs = new Map<string, any>();

  nodes
    .filter( ( node ) => node.data?.type === "Tool" )
    .forEach( ( node ) => {
      const config: any = node.data?.config || {};
      const normalizedName = normalizeToolName( config.name || node.data?.label || node.id );
      const metadata = findToolMetadata( normalizedName );
      const pipPackages = new Set<string>();

      if ( metadata?.basePip ) {
        pipPackages.add( metadata.basePip );
      }
      ( metadata?.additionalPipPackages || [] ).forEach( ( pkg ) => pipPackages.add( pkg ) );

      const spec = {
        name: metadata?.name || normalizedName || "custom_tool",
        type: config.kind || "internal",
        config: {
          description:
            metadata?.description ||
            node.data?.notes ||
            node.data?.label ||
            "Workflow tool generated from visual scripting.",
          parameters: buildParameterMetadata( config.args ),
        },
        requiresPip: pipPackages.size > 0 || Boolean( metadata?.extrasPip ),
        pipPackages: pipPackages.size ? Array.from( pipPackages ) : undefined,
        extrasPip: metadata?.extrasPip,
        notSupportedOn: metadata?.notSupportedOn,
      };

      specs.set( spec.name, spec );
    } );

  return Array.from( specs.values() );
}

function buildParameterMetadata( args: Record<string, any> | undefined ) {
  if ( !args || typeof args !== "object" ) {
    return [];
  }

  return Object.entries( args ).slice( 0, 10 ).map( ( [name, value] ) => ( {
    name,
    type: typeof value,
    description: `Auto-generated parameter for ${name}`,
    required: true,
  } ) );
}
