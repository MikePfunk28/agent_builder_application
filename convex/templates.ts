import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { category: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.category) {
      return await ctx.db
        .query("templates")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .collect();
    }
    
    return await ctx.db.query("templates").collect();
  },
});

export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    const templates = await ctx.db.query("templates").collect();
    const categories = [...new Set(templates.map(t => t.category))];
    return categories;
  },
});

export const seedTemplates = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if templates already exist
    const existingTemplates = await ctx.db.query("templates").collect();
    if (existingTemplates.length > 0) {
      return "Templates already seeded";
    }

    const templates = [
      {
        name: "Data Analyst Agent",
        description: "Analyze datasets, create visualizations, and generate insights",
        category: "Analytics",
        model: "claude-3-5-sonnet-20241022",
        systemPrompt: "You are a data analyst AI agent. You excel at analyzing datasets, creating visualizations, and generating actionable insights. You can work with CSV files, databases, and APIs to gather data and present findings in clear, understandable formats.",
        tools: [
          {
            name: "Data Analysis",
            type: "data_analysis",
            requiresPip: true,
            pipPackages: ["pandas", "numpy", "matplotlib", "seaborn"],
          },
          {
            name: "Database Access",
            type: "database",
            requiresPip: true,
            pipPackages: ["sqlite3", "pandas"],
          },
          {
            name: "File Operations",
            type: "file_operations",
            requiresPip: false,
            pipPackages: [],
          },
        ],
        isOfficial: true,
      },
      {
        name: "Web Research Agent",
        description: "Search the web, gather information, and compile research reports",
        category: "Research",
        model: "claude-3-5-sonnet-20241022",
        systemPrompt: "You are a web research AI agent. You specialize in finding, analyzing, and synthesizing information from the internet. You can search multiple sources, verify information, and create comprehensive research reports on any topic.",
        tools: [
          {
            name: "Web Search",
            type: "web_search",
            requiresPip: true,
            pipPackages: ["requests", "beautifulsoup4"],
          },
          {
            name: "API Client",
            type: "api_client",
            requiresPip: true,
            pipPackages: ["httpx", "requests"],
          },
          {
            name: "File Operations",
            type: "file_operations",
            requiresPip: false,
            pipPackages: [],
          },
        ],
        isOfficial: true,
      },
      {
        name: "Code Assistant Agent",
        description: "Help with coding tasks, debugging, and code review",
        category: "Development",
        model: "claude-3-5-sonnet-20241022",
        systemPrompt: "You are a coding assistant AI agent. You help developers with coding tasks, debugging, code review, and technical problem-solving. You can execute code, analyze repositories, and provide detailed explanations and solutions.",
        tools: [
          {
            name: "Code Interpreter",
            type: "code_interpreter",
            requiresPip: false,
            pipPackages: [],
          },
          {
            name: "File Operations",
            type: "file_operations",
            requiresPip: false,
            pipPackages: [],
          },
          {
            name: "Memory Manager",
            type: "memory_manager",
            requiresPip: false,
            pipPackages: [],
          },
        ],
        isOfficial: true,
      },
    ];

    for (const template of templates) {
      await ctx.db.insert("templates", template);
    }

    return `Seeded ${templates.length} templates`;
  },
});
