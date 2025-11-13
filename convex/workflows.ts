import { mutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";

async function getUserScope(ctx: any): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required to manage workflows.");
  }

  const scope =
    identity.subject ||
    identity.tokenIdentifier ||
    identity.email ||
    identity.provider;

  if (!scope) {
    throw new Error("Unable to resolve user identity.");
  }

  return scope;
}

const ALLOWED_NODE_TYPES = new Set([
  "Prompt",
  "PromptText",
  "Model",
  "Tool",
  "Router",
  "Memory",
  "Entrypoint",
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
]);

function sanitizeString(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }
  return value.slice(0, maxLength);
}

function deepSanitize(value: any, maxStringLength = 4000, depth = 0): any {
  if (depth > 4) {
    return null;
  }

  if (typeof value === "string") {
    return sanitizeString(value, maxStringLength);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((entry) => deepSanitize(entry, maxStringLength, depth + 1));
  }

  if (typeof value === "object" && value !== null) {
    const sanitized: Record<string, any> = {};
    for (const [key, val] of Object.entries(value).slice(0, 50)) {
      sanitized[key] = deepSanitize(val, maxStringLength, depth + 1);
    }
    return sanitized;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  return null;
}

function sanitizeNode(node: any) {
  if (typeof node !== "object" || node === null) {
    throw new Error("Invalid node payload.");
  }

  const id = sanitizeString(node.id, 128);
  const data = node.data ?? {};
  const nodeKind = sanitizeString(data.type, 64);

  if (!id) {
    throw new Error("Workflow nodes must include an id.");
  }

  if (!nodeKind || !ALLOWED_NODE_TYPES.has(nodeKind)) {
    throw new Error(`Unsupported node type: ${nodeKind || "unknown"}.`);
  }

  const position =
    typeof node.position === "object" && node.position !== null
      ? {
          x: Number(node.position.x) || 0,
          y: Number(node.position.y) || 0,
        }
      : undefined;

  const label = sanitizeString(data.label, 256);
  const notes = sanitizeString(data.notes, 4000);

  const config =
    typeof data.config === "object" && data.config !== null
      ? deepSanitize(data.config)
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

function sanitizeEdge(edge: any) {
  if (typeof edge !== "object" || edge === null) {
    throw new Error("Invalid edge payload.");
  }

  const id = sanitizeString(edge.id, 128);
  const source = sanitizeString(edge.source, 128);
  const target = sanitizeString(edge.target, 128);
  const type = sanitizeString(edge.type ?? "smoothstep", 32);

  if (!id || !source || !target) {
    throw new Error("Edges must include id, source, and target.");
  }

  return { id, source, target, type };
}

function sanitizeWorkflowPayload(nodes: any[], edges: any[]) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw new Error("Workflows require at least one node.");
  }

  if (nodes.length > 150) {
    throw new Error("Workflow node limit exceeded (max 150).");
  }

  if (!Array.isArray(edges)) {
    throw new Error("Edges payload must be an array.");
  }

  if (edges.length > 300) {
    throw new Error("Workflow edge limit exceeded (max 300).");
  }

  const sanitizedNodes = nodes.map(sanitizeNode);
  const sanitizedEdges = edges.map(sanitizeEdge);

  return { sanitizedNodes, sanitizedEdges };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userScope = await getUserScope(ctx);
    return await ctx.db
      .query("workflows")
      .withIndex("by_user", (q) => q.eq("userId", userScope))
      .order("desc")
      .take(50);
  },
});

export const get = query({
  args: {
    workflowId: v.id("workflows"),
  },
  handler: async (ctx, args) => {
    const workflow = await ctx.db.get(args.workflowId);
    if (!workflow) {
      return null;
    }
    const userScope = await getUserScope(ctx);
    if (workflow.userId !== userScope) {
      throw new Error("Workflow not found for current user");
    }
    return workflow;
  },
});

// Internal query for Node.js actions to fetch workflows without user scope check
export const getInternal = internalQuery({
  args: {
    workflowId: v.id("workflows"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.workflowId);
  },
});

export const save = mutation({
  args: {
    workflowId: v.optional(v.id("workflows")),
    name: v.string(),
    nodes: v.array(v.any()),
    edges: v.array(v.any()),
    templateId: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userScope = await getUserScope(ctx);
    const now = Date.now();
    const status = args.status ?? "draft";
    const templateId = args.templateId ?? "custom";
    const { sanitizedNodes, sanitizedEdges } = sanitizeWorkflowPayload(args.nodes, args.edges);

    if (args.workflowId) {
      const existing = await ctx.db.get(args.workflowId);
      if (!existing) {
        throw new Error("Workflow not found");
      }
      if (existing.userId !== userScope) {
        throw new Error("Workflow not found for current user");
      }
      await ctx.db.patch(args.workflowId, {
        name: args.name,
        nodes: sanitizedNodes,
        edges: sanitizedEdges,
        status,
        updatedAt: now,
      });
      return { workflowId: args.workflowId };
    }

    const workflowId = await ctx.db.insert("workflows", {
      name: args.name,
      userId: userScope,
      templateId,
      nodes: sanitizedNodes,
      edges: sanitizedEdges,
      status,
      createdAt: now,
      updatedAt: now,
    });

    return { workflowId };
  },
});

export const remove = mutation({
  args: {
    workflowId: v.id("workflows"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.workflowId);
    if (!existing) {
      return { removed: false };
    }
    const userScope = await getUserScope(ctx);
    if (existing.userId !== userScope) {
      throw new Error("Workflow not found for current user");
    }
    await ctx.db.delete(args.workflowId);
    return { removed: true };
  },
});
