/**
 * Workflow Template Seeder
 *
 * Pre-built workflow templates that users can load into the visual scripting builder.
 * All node types MUST be in the ALLOWED_NODE_TYPES set defined in workflows.ts.
 * All node data MUST follow the { type, label, notes, config } structure.
 */

import { internalMutation } from "./_generated/server";

export const seedWorkflowTemplates = internalMutation({
  handler: async (ctx) => {
    // Check if already seeded
    const existing = await ctx.db.query("workflowTemplates").first();
    if (existing) {
      console.log("Workflow templates already seeded");
      return;
    }

    const templates = [
      /**
       * 1. CUSTOMER SUPPORT CHATBOT
       */
      {
        name: "Customer Support Chatbot",
        description: "Full-featured customer support bot with knowledge base and escalation",
        category: "Support",
        icon: "💬",
        difficulty: "Intermediate",
        nodes: [
          {
            id: "prompt-1",
            type: "workflow",
            position: { x: 200, y: 100 },
            data: {
              type: "Prompt",
              label: "Support Assistant",
              notes: "Helpful, patient, and professional",
              config: {
                validator: undefined,
              },
            },
          },
          {
            id: "memory-1",
            type: "workflow",
            position: { x: 200, y: 250 },
            data: {
              type: "Memory",
              label: "Conversation Memory",
              notes: "Hybrid memory with similarity retrieval",
              config: {
                source: "convex",
                topK: 10,
              },
            },
          },
          {
            id: "tool-rag-1",
            type: "workflow",
            position: { x: 400, y: 100 },
            data: {
              type: "Tool",
              label: "Knowledge Base Search",
              notes: "RAG retrieval from customer support knowledge base",
              config: {
                kind: "internal",
                name: "knowledge_base_search",
              },
            },
          },
          {
            id: "model-1",
            type: "workflow",
            position: { x: 400, y: 250 },
            data: {
              type: "Model",
              label: "Escalation Handler",
              notes: "Senior support specialist for complex escalations",
              config: {
                provider: "bedrock",
                temperature: 0.3,
                maxTokens: 4096,
              },
            },
          },
        ],
        connections: [
          {
            id: "e-prompt-memory",
            source: "prompt-1",
            target: "memory-1",
          },
          {
            id: "e-prompt-rag",
            source: "prompt-1",
            target: "tool-rag-1",
          },
          {
            id: "e-rag-prompt",
            source: "tool-rag-1",
            target: "prompt-1",
          },
          {
            id: "e-prompt-model",
            source: "prompt-1",
            target: "model-1",
          },
        ],
        isOfficial: true,
        usageCount: 0,
        createdAt: Date.now(),
      },

      /**
       * 2. TECHNICAL ASSISTANT
       */
      {
        name: "Technical Assistant",
        description: "Code analysis and debugging assistant with documentation access",
        category: "Development",
        icon: "🔧",
        difficulty: "Advanced",
        nodes: [
          {
            id: "prompt-1",
            type: "workflow",
            position: { x: 200, y: 100 },
            data: {
              type: "Prompt",
              label: "Tech Assistant",
              notes: "Technical, precise, and helpful. Code review, debugging, API docs.",
              config: {
                validator: undefined,
              },
            },
          },
          {
            id: "tool-data-1",
            type: "workflow",
            position: { x: 400, y: 50 },
            data: {
              type: "Tool",
              label: "GitHub Data Connector",
              notes: "Fetches issues, PRs, and code from GitHub API",
              config: {
                kind: "internal",
                name: "github_integration",
              },
            },
          },
          {
            id: "model-1",
            type: "workflow",
            position: { x: 400, y: 150 },
            data: {
              type: "Model",
              label: "Code Analyzer",
              notes: "Specializes in code review, security analysis, performance",
              config: {
                provider: "bedrock",
                temperature: 0.2,
                maxTokens: 4096,
              },
            },
          },
          {
            id: "tool-rag-1",
            type: "workflow",
            position: { x: 400, y: 250 },
            data: {
              type: "Tool",
              label: "Technical Docs Search",
              notes: "Semantic search over technical documentation",
              config: {
                kind: "internal",
                name: "documentation_search",
              },
            },
          },
        ],
        connections: [
          {
            id: "e-prompt-data",
            source: "prompt-1",
            target: "tool-data-1",
          },
          {
            id: "e-data-model",
            source: "tool-data-1",
            target: "model-1",
          },
          {
            id: "e-prompt-rag",
            source: "prompt-1",
            target: "tool-rag-1",
          },
          {
            id: "e-rag-prompt",
            source: "tool-rag-1",
            target: "prompt-1",
          },
        ],
        isOfficial: true,
        usageCount: 0,
        createdAt: Date.now(),
      },

      /**
       * 3. RESEARCH ASSISTANT
       */
      {
        name: "Research Assistant",
        description: "Web research and data analysis with structured output",
        category: "Research",
        icon: "🔍",
        difficulty: "Intermediate",
        nodes: [
          {
            id: "prompt-1",
            type: "workflow",
            position: { x: 200, y: 150 },
            data: {
              type: "Prompt",
              label: "Research Assistant",
              notes: "Analytical, thorough, and objective. Web research, data analysis, reports.",
              config: {
                validator: undefined,
              },
            },
          },
          {
            id: "prompt-cot-1",
            type: "workflow",
            position: { x: 400, y: 50 },
            data: {
              type: "Prompt",
              label: "Chain of Thought Reasoning",
              notes: "Step-by-step reasoning with evidence requirements",
              config: {
                validator: undefined,
              },
            },
          },
          {
            id: "tool-rag-1",
            type: "workflow",
            position: { x: 400, y: 150 },
            data: {
              type: "Tool",
              label: "Research Papers Search",
              notes: "Hybrid retrieval from research paper knowledge base",
              config: {
                kind: "internal",
                name: "research_search",
              },
            },
          },
          {
            id: "tool-data-1",
            type: "workflow",
            position: { x: 400, y: 250 },
            data: {
              type: "Tool",
              label: "Academic Data Connector",
              notes: "Searches academic APIs with deduplication and relevance sorting",
              config: {
                kind: "internal",
                name: "academic_search",
              },
            },
          },
        ],
        connections: [
          {
            id: "e-prompt-cot",
            source: "prompt-1",
            target: "prompt-cot-1",
          },
          {
            id: "e-cot-rag",
            source: "prompt-cot-1",
            target: "tool-rag-1",
          },
          {
            id: "e-rag-data",
            source: "tool-rag-1",
            target: "tool-data-1",
          },
          {
            id: "e-data-prompt",
            source: "tool-data-1",
            target: "prompt-1",
          },
        ],
        isOfficial: true,
        usageCount: 0,
        createdAt: Date.now(),
      },

      /**
       * 4. CHAIN OF THOUGHT DEBUGGER
       */
      {
        name: "Chain of Thought Debugger",
        description: "Step-by-step reasoning for complex problem solving",
        category: "Reasoning",
        icon: "🧠",
        difficulty: "Advanced",
        nodes: [
          {
            id: "prompt-cot-1",
            type: "workflow",
            position: { x: 200, y: 100 },
            data: {
              type: "Prompt",
              label: "Chain of Thought Analyzer",
              notes: "Enables deep thinking with evidence requirements",
              config: {
                validator: undefined,
              },
            },
          },
          {
            id: "prompt-thought-1",
            type: "workflow",
            position: { x: 400, y: 100 },
            data: {
              type: "Prompt",
              label: "Systematic Debugger",
              notes: "Steps: Problem Analysis, Hypothesis Generation, Evidence Gathering, Solution Formulation",
              config: {
                validator: undefined,
              },
            },
          },
          {
            id: "model-1",
            type: "workflow",
            position: { x: 600, y: 100 },
            data: {
              type: "Model",
              label: "Reasoning Model",
              notes: "Low temperature for precise reasoning",
              config: {
                provider: "bedrock",
                temperature: 0.3,
                maxTokens: 4096,
              },
            },
          },
        ],
        connections: [
          {
            id: "e-cot-thought",
            source: "prompt-cot-1",
            target: "prompt-thought-1",
          },
          {
            id: "e-thought-model",
            source: "prompt-thought-1",
            target: "model-1",
          },
        ],
        isOfficial: true,
        usageCount: 0,
        createdAt: Date.now(),
      },

      /**
       * 5. RAG KNOWLEDGE BOT
       */
      {
        name: "RAG Knowledge Bot",
        description: "Knowledge base chatbot with retrieval augmented generation",
        category: "Knowledge",
        icon: "📚",
        difficulty: "Beginner",
        nodes: [
          {
            id: "prompt-1",
            type: "workflow",
            position: { x: 200, y: 150 },
            data: {
              type: "Prompt",
              label: "Knowledge Bot",
              notes: "Knowledgeable and precise. Answers from documentation.",
              config: {
                validator: undefined,
              },
            },
          },
          {
            id: "tool-rag-1",
            type: "workflow",
            position: { x: 400, y: 150 },
            data: {
              type: "Tool",
              label: "Knowledge Base Search",
              notes: "Hybrid retrieval with reranking and source citation",
              config: {
                kind: "internal",
                name: "knowledge_search",
              },
            },
          },
          {
            id: "memory-1",
            type: "workflow",
            position: { x: 400, y: 250 },
            data: {
              type: "Memory",
              label: "Conversation Memory",
              notes: "Short-term recency-based memory",
              config: {
                source: "convex",
                topK: 5,
              },
            },
          },
        ],
        connections: [
          {
            id: "e-prompt-rag",
            source: "prompt-1",
            target: "tool-rag-1",
          },
          {
            id: "e-rag-prompt",
            source: "tool-rag-1",
            target: "prompt-1",
          },
          {
            id: "e-prompt-memory",
            source: "prompt-1",
            target: "memory-1",
          },
        ],
        isOfficial: true,
        usageCount: 0,
        createdAt: Date.now(),
      },

      /**
       * 6. REACT AUTONOMOUS AGENT
       */
      {
        name: "ReAct Autonomous Agent",
        description: "Self-directed agent that reasons and acts iteratively",
        category: "Advanced",
        icon: "🔄",
        difficulty: "Expert",
        nodes: [
          {
            id: "router-1",
            type: "workflow",
            position: { x: 300, y: 100 },
            data: {
              type: "Router",
              label: "ReAct Decision Loop",
              notes: "Iterates up to 10 times, requires confidence 0.9",
              config: {
                conditions: [
                  { type: "if", expression: "success", thenNode: "model-1", elseNode: "tool-data-1" },
                ],
              },
            },
          },
          {
            id: "model-1",
            type: "workflow",
            position: { x: 500, y: 50 },
            data: {
              type: "Model",
              label: "Reasoning Model",
              notes: "Creative temperature for exploration",
              config: {
                provider: "bedrock",
                temperature: 0.7,
                maxTokens: 8192,
              },
            },
          },
          {
            id: "tool-data-1",
            type: "workflow",
            position: { x: 500, y: 150 },
            data: {
              type: "Tool",
              label: "Action Executor",
              notes: "Executes actions with validation and sanitization",
              config: {
                kind: "internal",
                name: "action_executor",
              },
            },
          },
        ],
        connections: [
          {
            id: "e-router-model",
            source: "router-1",
            target: "model-1",
          },
          {
            id: "e-model-data",
            source: "model-1",
            target: "tool-data-1",
          },
          {
            id: "e-data-router",
            source: "tool-data-1",
            target: "router-1",
          },
        ],
        isOfficial: true,
        usageCount: 0,
        createdAt: Date.now(),
      },
    ];

    // Insert all templates
    for (const template of templates) {
      await ctx.db.insert("workflowTemplates", template);
    }

    console.log(`Seeded ${templates.length} workflow templates`);
  },
});
