/**
 * Workflow Template Seeder
 *
 * Pre-built workflow templates that users can load into the visual scripting builder
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
            id: "chatbot-1",
            type: "conversational_chatbot",
            position: { x: 200, y: 100 },
            data: {
              agentName: "Support Assistant",
              personality: "Helpful, patient, and professional",
              memoryType: "hybrid",
              contextWindow: 10,
              systemPrompt: `You are a friendly customer support assistant. Your goal is to help customers resolve their issues quickly and professionally.

Guidelines:
- Be empathetic and patient
- Ask clarifying questions when needed
- Provide step-by-step solutions
- Escalate to human agents for complex issues
- Always maintain a positive tone`,
              tools: ["knowledge_base_search", "ticket_system", "escalation_router"],
            },
          },
          {
            id: "memory-1",
            type: "chatbot_memory",
            position: { x: 200, y: 250 },
            data: {
              storageType: "hybrid",
              retrievalStrategy: "similarity",
              maxContextSize: 5000,
              compressionEnabled: true,
            },
          },
          {
            id: "rag-1",
            type: "rag_system",
            position: { x: 400, y: 100 },
            data: {
              knowledgeBaseId: "customer_support_kb",
              retrievalStrategy: "hybrid",
              topK: 5,
              rerank: true,
              citeSources: true,
            },
          },
          {
            id: "worker-1",
            type: "chatbot_worker",
            position: { x: 400, y: 250 },
            data: {
              workerName: "Escalation Handler",
              domain: "customer_support",
              expertise: ["complex_issues", "billing", "technical_problems"],
              systemPrompt: "You are a senior support specialist who handles complex escalations.",
              tools: ["ticket_creation", "agent_assignment"],
            },
          },
        ],
        connections: [
          {
            source: "chatbot-1",
            sourceHandle: "conversation_history",
            target: "memory-1",
            targetHandle: "query",
          },
          {
            source: "chatbot-1",
            sourceHandle: "user_message",
            target: "rag-1",
            targetHandle: "query",
          },
          {
            source: "rag-1",
            sourceHandle: "response",
            target: "chatbot-1",
            targetHandle: "context",
          },
          {
            source: "chatbot-1",
            sourceHandle: "escalation_needed",
            target: "worker-1",
            targetHandle: "task",
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
            id: "chatbot-1",
            type: "conversational_chatbot",
            position: { x: 200, y: 100 },
            data: {
              agentName: "Tech Assistant",
              personality: "Technical, precise, and helpful",
              memoryType: "long_term",
              contextWindow: 20,
              systemPrompt: `You are a senior software engineer assistant. Help developers with code analysis, debugging, and technical questions.

Capabilities:
- Code review and analysis
- Debugging assistance
- API documentation lookup
- Best practices guidance
- Architecture recommendations`,
              tools: ["code_analyzer", "documentation_search", "github_integration"],
            },
          },
          {
            id: "data-1",
            type: "data_connector",
            position: { x: 400, y: 50 },
            data: {
              sourceType: "api",
              connectionConfig: {
                apiUrl: "https://api.github.com",
                authType: "token",
              },
              queryTemplate: "/repos/{owner}/{repo}/issues",
              transformations: ["filter_open", "sort_by_priority"],
            },
          },
          {
            id: "worker-1",
            type: "chatbot_worker",
            position: { x: 400, y: 150 },
            data: {
              workerName: "Code Analyzer",
              domain: "technical",
              expertise: ["code_review", "security_analysis", "performance_optimization"],
              systemPrompt: "You are a code analysis specialist. Review code for bugs, security issues, and optimization opportunities.",
              tools: ["static_analysis", "security_scanner", "performance_profiler"],
            },
          },
          {
            id: "rag-1",
            type: "rag_system",
            position: { x: 400, y: 250 },
            data: {
              knowledgeBaseId: "technical_docs",
              retrievalStrategy: "semantic",
              topK: 10,
              rerank: true,
              citeSources: true,
            },
          },
        ],
        connections: [
          {
            source: "chatbot-1",
            sourceHandle: "code_request",
            target: "data-1",
            targetHandle: "query_params",
          },
          {
            source: "data-1",
            sourceHandle: "data",
            target: "worker-1",
            targetHandle: "context",
          },
          {
            source: "chatbot-1",
            sourceHandle: "doc_query",
            target: "rag-1",
            targetHandle: "query",
          },
          {
            source: "rag-1",
            sourceHandle: "response",
            target: "chatbot-1",
            targetHandle: "context",
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
            id: "chatbot-1",
            type: "conversational_chatbot",
            position: { x: 200, y: 150 },
            data: {
              agentName: "Research Assistant",
              personality: "Analytical, thorough, and objective",
              memoryType: "long_term",
              contextWindow: 15,
              systemPrompt: `You are a research analyst assistant. Help users gather information, analyze data, and create comprehensive reports.

Focus areas:
- Web research and fact-checking
- Data analysis and visualization
- Report generation
- Source citation and verification`,
              tools: ["web_search", "data_analysis", "report_generator"],
            },
          },
          {
            id: "cot-1",
            type: "chain_of_thought",
            position: { x: 400, y: 50 },
            data: {
              enableThinking: true,
              thinkingBudget: 3000,
              requireEvidence: true,
              showReasoning: true,
            },
          },
          {
            id: "rag-1",
            type: "rag_system",
            position: { x: 400, y: 150 },
            data: {
              knowledgeBaseId: "research_papers",
              retrievalStrategy: "hybrid",
              topK: 8,
              rerank: true,
              citeSources: true,
            },
          },
          {
            id: "data-1",
            type: "data_connector",
            position: { x: 400, y: 250 },
            data: {
              sourceType: "api",
              connectionConfig: {
                apiUrl: "https://api.example.com/research",
              },
              queryTemplate: "/search?q={query}&type=academic",
              transformations: ["deduplicate", "sort_by_relevance"],
            },
          },
        ],
        connections: [
          {
            source: "chatbot-1",
            sourceHandle: "research_question",
            target: "cot-1",
            targetHandle: "problem",
          },
          {
            source: "cot-1",
            sourceHandle: "reasoning_chain",
            target: "rag-1",
            targetHandle: "query",
          },
          {
            source: "rag-1",
            sourceHandle: "response",
            target: "data-1",
            targetHandle: "query_params",
          },
          {
            source: "data-1",
            sourceHandle: "data",
            target: "chatbot-1",
            targetHandle: "context",
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
            id: "cot-1",
            type: "chain_of_thought",
            position: { x: 200, y: 100 },
            data: {
              enableThinking: true,
              thinkingBudget: 5000,
              requireEvidence: true,
              showReasoning: true,
            },
          },
          {
            id: "thought-1",
            type: "thought_builder",
            position: { x: 400, y: 100 },
            data: {
              thoughtName: "Systematic Debugger",
              steps: [
                {
                  name: "Problem Analysis",
                  instruction: "Analyze the problem and identify key components",
                  requiresEvidence: true,
                },
                {
                  name: "Hypothesis Generation",
                  instruction: "Generate possible explanations",
                  requiresEvidence: false,
                },
                {
                  name: "Evidence Gathering",
                  instruction: "Collect evidence for each hypothesis",
                  requiresEvidence: true,
                },
                {
                  name: "Solution Formulation",
                  instruction: "Formulate the best solution based on evidence",
                  requiresEvidence: true,
                },
              ],
              enableSelfCorrection: true,
            },
          },
          {
            id: "ml-1",
            type: "ml_connector",
            position: { x: 600, y: 100 },
            data: {
              provider: "bedrock",
              model: "claude-3-5-sonnet-20241022",
              temperature: 0.3,
              maxTokens: 4096,
              trackCost: true,
              enableCaching: true,
            },
          },
        ],
        connections: [
          {
            source: "cot-1",
            sourceHandle: "reasoning",
            target: "thought-1",
            targetHandle: "problem",
          },
          {
            source: "thought-1",
            sourceHandle: "reasoning_chain",
            target: "ml-1",
            targetHandle: "prompt",
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
            id: "chatbot-1",
            type: "conversational_chatbot",
            position: { x: 200, y: 150 },
            data: {
              agentName: "Knowledge Bot",
              personality: "Knowledgeable and precise",
              memoryType: "short_term",
              contextWindow: 5,
              systemPrompt: "You are a knowledge base assistant. Answer questions based on the provided documentation.",
              tools: ["knowledge_search"],
            },
          },
          {
            id: "rag-1",
            type: "rag_system",
            position: { x: 400, y: 150 },
            data: {
              knowledgeBaseId: "company_docs",
              retrievalStrategy: "hybrid",
              topK: 5,
              rerank: true,
              citeSources: true,
            },
          },
          {
            id: "memory-1",
            type: "chatbot_memory",
            position: { x: 400, y: 250 },
            data: {
              storageType: "convex",
              retrievalStrategy: "recency",
              maxContextSize: 3000,
              compressionEnabled: false,
            },
          },
        ],
        connections: [
          {
            source: "chatbot-1",
            sourceHandle: "user_message",
            target: "rag-1",
            targetHandle: "query",
          },
          {
            source: "rag-1",
            sourceHandle: "response",
            target: "chatbot-1",
            targetHandle: "context",
          },
          {
            source: "chatbot-1",
            sourceHandle: "conversation_history",
            target: "memory-1",
            targetHandle: "query",
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
            id: "react-1",
            type: "react_loop",
            position: { x: 300, y: 100 },
            data: {
              maxIterations: 10,
              tools: ["web_search", "calculator", "code_executor", "file_reader"],
              requireConfidence: 0.9,
              enableReflection: true,
            },
          },
          {
            id: "ml-1",
            type: "ml_connector",
            position: { x: 500, y: 50 },
            data: {
              provider: "bedrock",
              model: "claude-3-5-sonnet-20241022",
              temperature: 0.7,
              maxTokens: 8192,
              trackCost: true,
              enableCaching: true,
            },
          },
          {
            id: "data-1",
            type: "data_connector",
            position: { x: 500, y: 150 },
            data: {
              sourceType: "api",
              connectionConfig: {
                apiUrl: "https://api.example.com",
              },
              queryTemplate: "/execute?action={action}",
              transformations: ["validate", "sanitize"],
            },
          },
        ],
        connections: [
          {
            source: "react-1",
            sourceHandle: "action_history",
            target: "ml-1",
            targetHandle: "prompt",
          },
          {
            source: "ml-1",
            sourceHandle: "response",
            target: "data-1",
            targetHandle: "query_params",
          },
          {
            source: "data-1",
            sourceHandle: "data",
            target: "react-1",
            targetHandle: "goal",
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
