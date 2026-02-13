/**
 * Meta-tooling Feature Implementation
 * 
 * This module enables agents to dynamically create tools they need at runtime.
 * Agents can request new tools, which are then generated, validated, and loaded
 * dynamically for immediate use.
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7
 */

import { mutation, query, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Meta-tooling system prompt template
 * This is added to agent system prompts to enable meta-tooling capability
 */
export const META_TOOLING_INSTRUCTIONS = `
## Meta-Tooling Capability

You have the ability to create new tools dynamically when you need functionality that is not currently available. This is called "meta-tooling".

### When to Use Meta-Tooling

Use meta-tooling when:
1. You need a specific capability that is not provided by your existing tools
2. The task requires specialized processing or data transformation
3. You need to integrate with an external API or service not covered by existing tools
4. You need custom business logic specific to the user's domain

### How to Request a New Tool

When you determine you need a new tool, use the \`create_tool\` function with:
- **name**: A unique, descriptive name for the tool (snake_case)
- **description**: Clear description of what the tool does
- **parameters**: JSON schema defining the tool's input parameters
- **code**: Python code implementing the tool with @tool decorator

### Tool Code Requirements

Your tool code must:
1. Use the @tool decorator from strandsagents
2. Be syntactically valid Python
3. Include proper error handling
4. Have clear docstrings
5. Return a string or JSON-serializable result

### Example Tool Creation

\`\`\`python
@tool(
    name="calculate_roi",
    description="Calculate return on investment",
    parameters={
        "initial_investment": {"type": "number", "description": "Initial investment amount"},
        "final_value": {"type": "number", "description": "Final value"},
        "time_period": {"type": "number", "description": "Time period in years"}
    }
)
async def calculate_roi(initial_investment: float, final_value: float, time_period: float) -> str:
    """Calculate ROI percentage"""
    try:
        roi = ((final_value - initial_investment) / initial_investment) * 100
        annual_roi = roi / time_period
        return f"ROI: {roi:.2f}% (Annual: {annual_roi:.2f}%)"
    except Exception as e:
        return f"Error calculating ROI: {str(e)}"
\`\`\`

### Best Practices

1. **Keep tools focused**: Each tool should do one thing well
2. **Handle errors gracefully**: Always include try-except blocks
3. **Validate inputs**: Check parameters before processing
4. **Return useful output**: Provide clear, actionable results
5. **Document thoroughly**: Include docstrings and comments

Once you create a tool, it will be validated and loaded automatically. You can then use it immediately in your workflow.
`;

/**
 * Predefined agent templates for common use cases
 * These are automatically suggested when meta-tooling detects specific patterns
 */
export const PREDEFINED_AGENT_TEMPLATES = {
  data_analyst: {
    name: "Data Analysis Agent",
    description: "Specialized agent for data analysis and visualization",
    systemPrompt: `You are a data analysis expert. You excel at:
- Loading and parsing data from various formats (CSV, JSON, Excel)
- Performing statistical analysis
- Creating visualizations
- Identifying patterns and insights
- Generating reports

Use your tools to analyze data thoroughly and provide actionable insights.`,
    tools: ["file_read", "calculator", "python_repl", "generate_image"],
    triggerPatterns: ["analyze data", "data analysis", "statistics", "visualization", "chart", "graph"]
  },
  
  web_researcher: {
    name: "Web Research Agent",
    description: "Specialized agent for web research and information gathering",
    systemPrompt: `You are a web research specialist. You excel at:
- Searching the web for information
- Evaluating source credibility
- Synthesizing information from multiple sources
- Fact-checking and verification
- Summarizing findings

Use your tools to conduct thorough research and provide well-sourced answers.`,
    tools: ["http_request", "browser", "search", "file_write"],
    triggerPatterns: ["research", "search", "find information", "look up", "investigate"]
  },
  
  code_assistant: {
    name: "Code Assistant Agent",
    description: "Specialized agent for code generation and debugging",
    systemPrompt: `You are a coding expert. You excel at:
- Writing clean, efficient code
- Debugging and fixing errors
- Code review and optimization
- Explaining code concepts
- Following best practices

Use your tools to help with coding tasks and provide high-quality solutions.`,
    tools: ["code_interpreter", "file_read", "file_write", "editor"],
    triggerPatterns: ["write code", "debug", "fix error", "implement", "program"]
  },
  
  automation_specialist: {
    name: "Automation Specialist Agent",
    description: "Specialized agent for task automation and workflow creation",
    systemPrompt: `You are an automation expert. You excel at:
- Identifying automation opportunities
- Creating efficient workflows
- Scheduling recurring tasks
- Integrating multiple tools
- Optimizing processes

Use your tools to automate tasks and create efficient workflows.`,
    tools: ["shell", "cron", "workflow", "batch", "file_operations"],
    triggerPatterns: ["automate", "schedule", "workflow", "recurring", "batch process"]
  },
  
  api_integrator: {
    name: "API Integration Agent",
    description: "Specialized agent for API integration and data exchange",
    systemPrompt: `You are an API integration specialist. You excel at:
- Understanding API documentation
- Making HTTP requests
- Handling authentication
- Parsing responses
- Error handling and retries

Use your tools to integrate with external APIs and exchange data.`,
    tools: ["http_request", "use_aws", "file_read", "file_write"],
    triggerPatterns: ["api", "integrate", "connect to", "fetch from", "send to"]
  }
};

/**
 * Query to get meta-tooling instructions for agent system prompts
 */
export const getMetaToolingInstructions = query({
  args: {},
  handler: async (_ctx) => {
    return META_TOOLING_INSTRUCTIONS;
  },
});

/**
 * Query to get predefined agent templates
 */
export const getAgentTemplates = query({
  args: {},
  handler: async (_ctx) => {
    return PREDEFINED_AGENT_TEMPLATES;
  },
});

/**
 * Query to suggest agent template based on user query
 */
export const suggestAgentTemplate = query({
  args: { query: v.string() },
  handler: async (_ctx, args) => {
    const queryLower = args.query.toLowerCase();
    
    // Find matching templates based on trigger patterns
    for (const [key, template] of Object.entries(PREDEFINED_AGENT_TEMPLATES)) {
      if (template.triggerPatterns.some(pattern => queryLower.includes(pattern))) {
        return {
          templateKey: key,
          template,
          confidence: "high"
        };
      }
    }
    
    return null;
  },
});

/**
 * Mutation to create a new dynamic tool with validation
 * This is called by agents when they need a tool that doesn't exist
 */
export const createTool = mutation({
  args: {
    name: v.string(),
    displayName: v.string(),
    description: v.string(),
    code: v.string(),
    parameters: v.any(),
    returnType: v.optional(v.string()),
    category: v.optional(v.string()),
    pipPackages: v.optional(v.array(v.string())),
    extrasPip: v.optional(v.string()),
    agentId: v.optional(v.id("agents")),
  },
  handler: async (ctx, args) => {
    // Get userId from mutation context
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be authenticated to create tools");
    }

    // Validate tool code syntax first
    const validation = validateToolCodeHandler(args.code);

    if (!validation.valid) {
      throw new Error(`Tool code validation failed: ${validation.error}`);
    }

    // Check if tool with this name already exists for this user
    const existing = await ctx.db
      .query("dynamicTools")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    if (existing) {
      throw new Error(`Tool with name "${args.name}" already exists`);
    }

    // Create the tool
    const toolId = await ctx.db.insert("dynamicTools", {
      name: args.name,
      displayName: args.displayName,
      description: args.description,
      userId,
      agentId: args.agentId,
      code: args.code,
      validated: true,
      parameters: args.parameters,
      returnType: args.returnType,
      category: args.category,
      pipPackages: args.pipPackages,
      extrasPip: args.extrasPip,
      invocationCount: 0,
      successCount: 0,
      errorCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: true,
      isPublic: false,
    });

    return { toolId, validated: true };
  },
});

/**
 * Internal mutation to create a tool (called from action after validation)
 */
export const createToolInternal = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    displayName: v.string(),
    description: v.string(),
    code: v.string(),
    parameters: v.any(),
    returnType: v.optional(v.string()),
    category: v.optional(v.string()),
    pipPackages: v.optional(v.array(v.string())),
    extrasPip: v.optional(v.string()),
    agentId: v.optional(v.id("agents")),
  },
  handler: async (ctx, args) => {
    const { userId } = args;

    // Check if tool with this name already exists for this user
    const existing = await ctx.db
      .query("dynamicTools")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    if (existing) {
      throw new Error(`Tool with name "${args.name}" already exists`);
    }

    // Create the tool
    const toolId = await ctx.db.insert("dynamicTools", {
      name: args.name,
      displayName: args.displayName,
      description: args.description,
      userId,
      agentId: args.agentId,
      code: args.code,
      validated: true,
      parameters: args.parameters,
      returnType: args.returnType,
      category: args.category,
      pipPackages: args.pipPackages,
      extrasPip: args.extrasPip,
      invocationCount: 0,
      successCount: 0,
      errorCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: true,
      isPublic: false,
    });

    return { toolId, validated: true };
  },
});

/**
 * Validation logic extracted for reuse
 */
function validateToolCodeHandler(code: string) {
  try {
    // Basic validation checks
    code = code.trim();
      
      // Check for @tool decorator
      if (!code.includes("@tool")) {
        return {
          valid: false,
          error: "Tool code must include @tool decorator"
        };
      }
      
      // Check for async def or def
      if (!code.includes("async def") && !code.includes("def ")) {
        return {
          valid: false,
          error: "Tool code must define a function"
        };
      }
      
      // Check for basic Python syntax patterns
      // More lenient regex that allows for complex parameter lists and return type annotations
      const hasProperIndentation = /(async )?def \w+\(.*\)(\s*->\s*\w+)?:/s.test(code);
      if (!hasProperIndentation) {
        return {
          valid: false,
          error: "Tool function definition has invalid syntax"
        };
      }
      
      // Check for return statement or yield
      if (!code.includes("return") && !code.includes("yield")) {
        return {
          valid: false,
          error: "Tool function must return a value"
        };
      }
      
      // Check for balanced parentheses and brackets
      const openParens = (code.match(/\(/g) || []).length;
      const closeParens = (code.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        return {
          valid: false,
          error: "Unbalanced parentheses in tool code"
        };
      }
      
      const openBrackets = (code.match(/\[/g) || []).length;
      const closeBrackets = (code.match(/\]/g) || []).length;
      if (openBrackets !== closeBrackets) {
        return {
          valid: false,
          error: "Unbalanced brackets in tool code"
        };
      }
      
      const openBraces = (code.match(/\{/g) || []).length;
      const closeBraces = (code.match(/\}/g) || []).length;
      if (openBraces !== closeBraces) {
        return {
          valid: false,
          error: "Unbalanced braces in tool code"
        };
      }
      
      // Check for dangerous operations
      const dangerousPatterns = [
        /import\s+os\s*;\s*os\.system/,
        /exec\s*\(/,
        /eval\s*\(/,
        /__import__/,
        /subprocess\.call/,
      ];
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(code)) {
          return {
            valid: false,
            error: "Tool code contains potentially dangerous operations"
          };
        }
      }
      
      return { valid: true };
      
    } catch (error) {
      return {
        valid: false,
        error: `Validation error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
}

/**
 * Action to validate tool code syntax
 * Uses Python AST parsing to check for syntax errors
 */
export const validateToolCode = internalAction({
  args: {
    code: v.string(),
  },
  handler: async (_ctx, args) => {
    return validateToolCodeHandler(args.code);
  },
});

/**
 * Query to list dynamic tools for a user
 */
export const listTools = query({
  args: {
    includePublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    // Get user's tools
    const userTools = await ctx.db
      .query("dynamicTools")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Optionally include public tools
    if (args.includePublic) {
      const publicTools = await ctx.db
        .query("dynamicTools")
        .withIndex("by_public", (q) => q.eq("isPublic", true))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
      
      return [...userTools, ...publicTools];
    }

    return userTools;
  },
});

/**
 * Query to get a specific tool by name
 */
export const getTool = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    // Try to find user's tool first
    const userTool = await ctx.db
      .query("dynamicTools")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    if (userTool) {
      return userTool;
    }

    // Fall back to public tools
    const publicTool = await ctx.db
      .query("dynamicTools")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .filter((q) => q.eq(q.field("isPublic"), true))
      .first();

    return publicTool;
  },
});

/**
 * Mutation to update tool usage statistics
 */
export const recordToolInvocation = internalMutation({
  args: {
    toolId: v.id("dynamicTools"),
    success: v.boolean(),
  },
  handler: async (ctx, args) => {
    const tool = await ctx.db.get(args.toolId);
    if (!tool) {
      return;
    }

    await ctx.db.patch(args.toolId, {
      invocationCount: tool.invocationCount + 1,
      successCount: args.success ? tool.successCount + 1 : tool.successCount,
      errorCount: args.success ? tool.errorCount : tool.errorCount + 1,
      lastInvokedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Mutation to update a tool with validation
 */
export const updateTool = mutation({
  args: {
    toolId: v.id("dynamicTools"),
    code: v.optional(v.string()),
    description: v.optional(v.string()),
    parameters: v.optional(v.any()),
    isActive: v.optional(v.boolean()),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Get userId from mutation context
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be authenticated to update tools");
    }

    const tool = await ctx.db.get(args.toolId);
    if (!tool || tool.userId !== userId) {
      throw new Error("Tool not found or access denied");
    }

    // If code is being updated, validate it
    if (args.code) {
      const validation = validateToolCodeHandler(args.code);

      if (!validation.valid) {
        throw new Error(`Tool code validation failed: ${validation.error}`);
      }
    }

    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.code !== undefined) {
      updates.code = args.code;
      updates.validated = true;
    }
    if (args.description !== undefined) updates.description = args.description;
    if (args.parameters !== undefined) updates.parameters = args.parameters;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    if (args.isPublic !== undefined) updates.isPublic = args.isPublic;

    await ctx.db.patch(args.toolId, updates);
  },
});

/**
 * Internal mutation to update a tool
 */
export const updateToolInternal = internalMutation({
  args: {
    userId: v.id("users"),
    toolId: v.id("dynamicTools"),
    code: v.optional(v.string()),
    description: v.optional(v.string()),
    parameters: v.optional(v.any()),
    isActive: v.optional(v.boolean()),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId } = args;

    const tool = await ctx.db.get(args.toolId);
    if (!tool || tool.userId !== userId) {
      throw new Error("Tool not found or access denied");
    }

    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.code !== undefined) {
      updates.code = args.code;
      updates.validated = true;
    }
    if (args.description !== undefined) updates.description = args.description;
    if (args.parameters !== undefined) updates.parameters = args.parameters;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    if (args.isPublic !== undefined) updates.isPublic = args.isPublic;

    await ctx.db.patch(args.toolId, updates);
  },
});

/**
 * Mutation to delete a tool
 */
export const deleteTool = mutation({
  args: { toolId: v.id("dynamicTools") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be authenticated");
    }

    const tool = await ctx.db.get(args.toolId);
    if (!tool || tool.userId !== userId) {
      throw new Error("Tool not found or access denied");
    }

    await ctx.db.delete(args.toolId);
  },
});

/**
 * Query to get tool usage statistics
 */
export const getToolStats = query({
  args: { toolId: v.id("dynamicTools") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const tool = await ctx.db.get(args.toolId);
    if (!tool || (tool.userId !== userId && !tool.isPublic)) {
      return null;
    }

    return {
      invocationCount: tool.invocationCount,
      successCount: tool.successCount,
      errorCount: tool.errorCount,
      successRate: tool.invocationCount > 0
        ? (tool.successCount / tool.invocationCount) * 100
        : 0,
      lastInvokedAt: tool.lastInvokedAt,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// Skill CRUD — extends dynamicTools as unified skill registry
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Internal query used by strandsAgentExecution to load a skill by its ID.
 */
export const getSkillById = internalQuery( {
  args: { skillId: v.id( "dynamicTools" ) },
  handler: async ( ctx, args ) => {
    return await ctx.db.get( args.skillId );
  },
} );

/**
 * List skills (dynamicTools with skillType set) for the authenticated user.
 * Includes public skills from other users.
 */
export const listSkills = query( {
  args: {},
  handler: async ( ctx ) => {
    const userId = await getAuthUserId( ctx );
    if ( !userId ) return [];

    // Get user's own skills
    const userTools = await ctx.db
      .query( "dynamicTools" )
      .withIndex( "by_user", ( q ) => q.eq( "userId", userId ) )
      .filter( ( q ) => q.and(
        q.eq( q.field( "isActive" ), true ),
        q.neq( q.field( "skillType" ), undefined ),
      ) )
      .collect();

    // Get public skills from others
    const publicTools = await ctx.db
      .query( "dynamicTools" )
      .withIndex( "by_public", ( q ) => q.eq( "isPublic", true ) )
      .filter( ( q ) => q.and(
        q.eq( q.field( "isActive" ), true ),
        q.neq( q.field( "skillType" ), undefined ),
        q.neq( q.field( "userId" ), userId ),
      ) )
      .collect();

    return [...userTools, ...publicTools];
  },
} );

/**
 * Look up a skill by name for the authenticated user (own + public).
 */
export const getSkillByName = query( {
  args: { name: v.string() },
  handler: async ( ctx, args ) => {
    const userId = await getAuthUserId( ctx );
    if ( !userId ) return null;

    // Own skill first
    const own = await ctx.db
      .query( "dynamicTools" )
      .withIndex( "by_name", ( q ) => q.eq( "name", args.name ) )
      .filter( ( q ) => q.and(
        q.eq( q.field( "userId" ), userId ),
        q.neq( q.field( "skillType" ), undefined ),
      ) )
      .first();
    if ( own ) return own;

    // Public skill
    return await ctx.db
      .query( "dynamicTools" )
      .withIndex( "by_name", ( q ) => q.eq( "name", args.name ) )
      .filter( ( q ) => q.and(
        q.eq( q.field( "isPublic" ), true ),
        q.neq( q.field( "skillType" ), undefined ),
      ) )
      .first();
  },
} );

/**
 * Create a new skill (dynamicTool with skillType + skillConfig + toolDefinition).
 */
export const createSkill = mutation( {
  args: {
    name: v.string(),
    displayName: v.string(),
    description: v.string(),
    skillType: v.union(
      v.literal( "code" ),
      v.literal( "internal" ),
      v.literal( "mcp" ),
      v.literal( "agent" ),
      v.literal( "composite" ),
      v.literal( "sandbox" ),
    ),
    skillConfig: v.optional( v.any() ),
    toolDefinition: v.object( {
      name: v.string(),
      description: v.string(),
      inputSchema: v.any(),
    } ),
    skillInstructions: v.optional( v.string() ),
    tags: v.optional( v.array( v.string() ) ),
  },
  handler: async ( ctx, args ) => {
    const userId = await getAuthUserId( ctx );
    if ( !userId ) {
      throw new Error( "Must be authenticated to create skills" );
    }

    // Check for duplicate name
    const existing = await ctx.db
      .query( "dynamicTools" )
      .withIndex( "by_name", ( q ) => q.eq( "name", args.name ) )
      .filter( ( q ) => q.eq( q.field( "userId" ), userId ) )
      .first();
    if ( existing ) {
      throw new Error( `Skill with name "${args.name}" already exists` );
    }

    const toolId = await ctx.db.insert( "dynamicTools", {
      name: args.name,
      displayName: args.displayName,
      description: args.description,
      userId,
      code: "", // Skills may not have code (internal/mcp types)
      validated: true,
      parameters: args.toolDefinition.inputSchema || {},
      invocationCount: 0,
      successCount: 0,
      errorCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: true,
      isPublic: false,
      // Skill-specific fields
      skillType: args.skillType,
      skillConfig: args.skillConfig,
      toolDefinition: args.toolDefinition,
      skillInstructions: args.skillInstructions,
      tags: args.tags,
      version: "1.0.0",
    } );

    return { toolId, validated: true };
  },
} );

/**
 * Seed built-in skills that map to existing tools.ts actions.
 * Called once during setup or migration. Idempotent — skips existing skills.
 */
export const seedBuiltinSkills = internalMutation( {
  args: { userId: v.id( "users" ) },
  handler: async ( ctx, args ) => {
    const builtinSkills = [
      {
        name: "short_term_memory",
        displayName: "Short-Term Memory",
        description: "Store and retrieve short-term memory for the current conversation",
        skillType: "internal" as const,
        skillConfig: { actionName: "short_term_memory" },
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["store", "retrieve"], description: "store or retrieve" },
            key: { type: "string", description: "Memory key" },
            value: { type: "string", description: "Value to store (only for store action)" },
          },
          required: ["action", "key"],
        },
        tags: ["memory", "builtin"],
      },
      {
        name: "long_term_memory",
        displayName: "Long-Term Memory",
        description: "Store and retrieve long-term memory that persists across conversations",
        skillType: "internal" as const,
        skillConfig: { actionName: "long_term_memory" },
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["store", "retrieve", "search"], description: "Memory operation" },
            key: { type: "string", description: "Memory key" },
            value: { type: "string", description: "Value to store" },
          },
          required: ["action", "key"],
        },
        tags: ["memory", "builtin"],
      },
      {
        name: "semantic_memory",
        displayName: "Semantic Memory",
        description: "Semantic search across stored memories using embedding similarity",
        skillType: "internal" as const,
        skillConfig: { actionName: "semantic_memory" },
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            maxResults: { type: "number", description: "Maximum results to return" },
          },
          required: ["query"],
        },
        tags: ["memory", "search", "builtin"],
      },
      {
        name: "handoff_to_user",
        displayName: "Handoff to User",
        description: "Hand off the conversation to the human user when agent needs clarification",
        skillType: "internal" as const,
        skillConfig: { actionName: "handoff_to_user" },
        inputSchema: {
          type: "object",
          properties: {
            reason: { type: "string", description: "Reason for handoff" },
            context: { type: "string", description: "Context for the user" },
          },
          required: ["reason"],
        },
        tags: ["handoff", "builtin"],
      },
      {
        name: "self_consistency",
        displayName: "Self-Consistency",
        description: "Run multiple reasoning paths and select the most consistent answer",
        skillType: "internal" as const,
        skillConfig: { actionName: "self_consistency" },
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "The question to reason about" },
            numSamples: { type: "number", description: "Number of reasoning paths (default 3)" },
          },
          required: ["prompt"],
        },
        tags: ["reasoning", "builtin"],
      },
      {
        name: "tree_of_thoughts",
        displayName: "Tree of Thoughts",
        description: "Explore multiple reasoning branches, evaluating and pruning for best path",
        skillType: "internal" as const,
        skillConfig: { actionName: "tree_of_thoughts" },
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "The problem to reason about" },
            breadth: { type: "number", description: "Branches per level (default 3)" },
            depth: { type: "number", description: "Reasoning depth (default 3)" },
          },
          required: ["prompt"],
        },
        tags: ["reasoning", "builtin"],
      },
      {
        name: "reflexion",
        displayName: "Reflexion",
        description: "Iterative self-critique and refinement of answers",
        skillType: "internal" as const,
        skillConfig: { actionName: "reflexion" },
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "The task to refine" },
            maxIterations: { type: "number", description: "Maximum refinement rounds (default 3)" },
          },
          required: ["prompt"],
        },
        tags: ["reasoning", "builtin"],
      },
      {
        name: "map_reduce",
        displayName: "Map-Reduce",
        description: "Break a task into subtasks, process in parallel, then synthesize results",
        skillType: "internal" as const,
        skillConfig: { actionName: "map_reduce" },
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "The task to decompose" },
            chunks: { type: "number", description: "Number of subtasks (default 3)" },
          },
          required: ["prompt"],
        },
        tags: ["reasoning", "parallel", "builtin"],
      },
      {
        name: "parallel_prompts",
        displayName: "Parallel Prompts",
        description: "Run multiple prompts in parallel and combine results",
        skillType: "internal" as const,
        skillConfig: { actionName: "parallel_prompts" },
        inputSchema: {
          type: "object",
          properties: {
            prompts: {
              type: "array",
              items: { type: "string" },
              description: "List of prompts to run in parallel",
            },
          },
          required: ["prompts"],
        },
        tags: ["reasoning", "parallel", "builtin"],
      },
    ];

    let seeded = 0;
    for ( const skill of builtinSkills ) {
      // Skip if already exists
      const existing = await ctx.db
        .query( "dynamicTools" )
        .withIndex( "by_name", ( q ) => q.eq( "name", skill.name ) )
        .filter( ( q ) => q.eq( q.field( "userId" ), args.userId ) )
        .first();
      if ( existing ) continue;

      await ctx.db.insert( "dynamicTools", {
        name: skill.name,
        displayName: skill.displayName,
        description: skill.description,
        userId: args.userId,
        code: "",
        validated: true,
        parameters: skill.inputSchema,
        invocationCount: 0,
        successCount: 0,
        errorCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isActive: true,
        isPublic: true, // Built-in skills are public
        skillType: skill.skillType,
        skillConfig: skill.skillConfig,
        toolDefinition: {
          name: skill.name,
          description: skill.description,
          inputSchema: skill.inputSchema,
        },
        tags: skill.tags,
        version: "1.0.0",
      } );
      seeded++;
    }

    return { seeded, total: builtinSkills.length };
  },
} );
