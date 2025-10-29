/**
 * StrandsAgents Tool Definitions
 *
 * These are the actual functional components that power the visual scripting system.
 * Each tool is an "Agent as a Tool" that can be composed together.
 */

import { v } from "convex/values";

/**
 * CHATBOT COMPONENTS
 */

export const conversationalChatbotTool = {
  name: "conversational_chatbot",
  type: "chatbot_core",
  description: "Interactive chatbot with memory and reasoning capabilities",
  icon: "💬",
  color: "#3B82F6", // blue
  category: "Chatbot Components",

  parameters: v.object({
    agentName: v.string(),
    personality: v.string(),
    memoryType: v.union(v.literal("short_term"), v.literal("long_term"), v.literal("hybrid")),
    contextWindow: v.number(),
    systemPrompt: v.string(),
    tools: v.array(v.string()),
  }),

  inputs: ["user_message", "conversation_history"],
  outputs: ["response", "updated_context", "reasoning"],

  // This will be implemented in the agent code generator
  strandsAgentCode: `
@agent
class ConversationalChatbot:
    def __init__(self, config):
        self.name = config['agentName']
        self.personality = config['personality']
        self.memory = MemoryManager(config['memoryType'])
        self.context_window = config['contextWindow']
        self.system_prompt = config['systemPrompt']

    @tool
    def process_message(self, user_message: str, conversation_history: list) -> dict:
        # Retrieve relevant context
        context = self.memory.retrieve(user_message, self.context_window)

        # Build prompt with context
        prompt = f"{self.system_prompt}\\n\\nContext: {context}\\n\\nUser: {user_message}"

        # Process with reasoning
        response = self.invoke_model(prompt)

        # Update memory
        self.memory.store(user_message, response)

        return {
            "response": response,
            "context": context,
            "reasoning": self.get_reasoning()
        }
  `,
};

export const chatbotWorkerTool = {
  name: "chatbot_worker",
  type: "specialized_agent",
  description: "Specialized worker agent for specific domains",
  icon: "🤖",
  color: "#EF4444", // red
  category: "Chatbot Components",

  parameters: v.object({
    workerName: v.string(),
    domain: v.string(), // "customer_support", "technical", "research"
    expertise: v.array(v.string()),
    systemPrompt: v.string(),
    tools: v.array(v.string()),
  }),

  inputs: ["task", "context"],
  outputs: ["result", "confidence", "next_actions"],

  strandsAgentCode: `
@agent
class ChatbotWorker:
    def __init__(self, config):
        self.name = config['workerName']
        self.domain = config['domain']
        self.expertise = config['expertise']
        self.system_prompt = config['systemPrompt']

    @tool
    def execute_task(self, task: str, context: dict) -> dict:
        # Validate task is within expertise
        if not self.can_handle(task):
            return {"error": "Task outside expertise", "should_route": True}

        # Execute specialized logic
        result = self.process_with_domain_knowledge(task, context)

        return {
            "result": result,
            "confidence": self.calculate_confidence(),
            "next_actions": self.suggest_follow_ups()
        }
  `,
};

export const chatbotMemoryTool = {
  name: "chatbot_memory",
  type: "context_storage",
  description: "Memory management with context retrieval",
  icon: "🧠",
  color: "#8B5CF6", // purple
  category: "Chatbot Components",

  parameters: v.object({
    storageType: v.union(v.literal("convex"), v.literal("s3"), v.literal("hybrid")),
    retrievalStrategy: v.union(v.literal("similarity"), v.literal("recency"), v.literal("importance")),
    maxContextSize: v.number(),
    compressionEnabled: v.boolean(),
  }),

  inputs: ["query", "conversation_id"],
  outputs: ["relevant_context", "metadata"],

  strandsAgentCode: `
@tool
def retrieve_memory(query: str, conversation_id: str, config: dict) -> dict:
    memory_store = MemoryStore(config['storageType'])

    # Retrieve based on strategy
    if config['retrievalStrategy'] == 'similarity':
        context = memory_store.similarity_search(query, conversation_id)
    elif config['retrievalStrategy'] == 'recency':
        context = memory_store.get_recent(conversation_id, limit=config['maxContextSize'])
    else:
        context = memory_store.importance_ranked(query, conversation_id)

    # Compress if needed
    if config['compressionEnabled'] and len(context) > config['maxContextSize']:
        context = compress_context(context, config['maxContextSize'])

    return {
        "relevant_context": context,
        "metadata": {"source": "memory", "relevance_score": calculate_relevance(query, context)}
    }
  `,
};

/**
 * PROMPT MANAGEMENT TOOLS
 */

export const promptTemplateTool = {
  name: "prompt_template",
  type: "reusable_prompt",
  description: "Reusable prompt template with variables",
  icon: "📝",
  color: "#10B981", // green
  category: "Prompt Tools",

  parameters: v.object({
    templateName: v.string(),
    template: v.string(), // "Hello {name}, how can I help with {topic}?"
    variables: v.array(v.object({
      name: v.string(),
      type: v.string(),
      default: v.optional(v.string()),
      required: v.boolean(),
    })),
    examples: v.array(v.object({
      input: v.any(),
      output: v.string(),
    })),
  }),

  inputs: ["variable_values"],
  outputs: ["rendered_prompt"],

  strandsAgentCode: `
@tool
def render_prompt_template(template: str, variables: dict, variable_values: dict) -> str:
    rendered = template

    # Validate required variables
    required_vars = [v['name'] for v in variables if v['required']]
    missing = [v for v in required_vars if v not in variable_values]
    if missing:
        raise ValueError(f"Missing required variables: {missing}")

    # Replace variables
    for var_name, var_value in variable_values.items():
        placeholder = f"{{{var_name}}}"
        rendered = rendered.replace(placeholder, str(var_value))

    return rendered
  `,
};

export const promptChainTool = {
  name: "prompt_chain",
  type: "sequential_prompts",
  description: "Chain multiple prompts sequentially",
  icon: "⛓️",
  color: "#F59E0B", // amber
  category: "Prompt Tools",

  parameters: v.object({
    chainName: v.string(),
    prompts: v.array(v.object({
      id: v.string(),
      template: v.string(),
      extractOutput: v.string(), // JSONPath or regex to extract from response
    })),
    passThroughContext: v.boolean(),
  }),

  inputs: ["initial_input"],
  outputs: ["final_output", "intermediate_results"],

  strandsAgentCode: `
@tool
def execute_prompt_chain(prompts: list, initial_input: dict, config: dict) -> dict:
    context = initial_input
    intermediate_results = []

    for prompt_config in prompts:
        # Render prompt with current context
        prompt = render_template(prompt_config['template'], context)

        # Execute
        response = invoke_model(prompt)

        # Extract output
        extracted = extract_value(response, prompt_config['extractOutput'])

        intermediate_results.append({
            "prompt_id": prompt_config['id'],
            "response": response,
            "extracted": extracted
        })

        # Update context for next prompt
        if config['passThroughContext']:
            context.update(extracted)

    return {
        "final_output": intermediate_results[-1]['extracted'],
        "intermediate_results": intermediate_results
    }
  `,
};

export const thoughtBuilderTool = {
  name: "thought_builder",
  type: "reasoning_prompt",
  description: "Build explicit reasoning chains (Chain-of-Thought)",
  icon: "🧠",
  color: "#EC4899", // pink
  category: "Prompt Tools",

  parameters: v.object({
    thoughtName: v.string(),
    steps: v.array(v.object({
      name: v.string(),
      instruction: v.string(),
      requiresEvidence: v.boolean(),
    })),
    enableSelfCorrection: v.boolean(),
  }),

  inputs: ["problem"],
  outputs: ["reasoning_chain", "final_answer", "confidence"],

  strandsAgentCode: `
@tool
def build_thought_chain(problem: str, steps: list, config: dict) -> dict:
    reasoning_chain = []
    current_understanding = problem

    for step in steps:
        # Generate reasoning for this step
        thought_prompt = f"{step['instruction']}\\n\\nProblem: {current_understanding}"

        if step['requiresEvidence']:
            thought_prompt += "\\n\\nProvide evidence for your reasoning."

        step_reasoning = invoke_model(thought_prompt)
        reasoning_chain.append({
            "step": step['name'],
            "reasoning": step_reasoning
        })

        # Update understanding
        current_understanding = extract_conclusion(step_reasoning)

    # Self-correction loop
    if config['enableSelfCorrection']:
        confidence = evaluate_reasoning_quality(reasoning_chain)
        if confidence < 0.8:
            # Re-run with corrections
            corrections = identify_weak_reasoning(reasoning_chain)
            reasoning_chain = apply_corrections(reasoning_chain, corrections)

    return {
        "reasoning_chain": reasoning_chain,
        "final_answer": current_understanding,
        "confidence": calculate_confidence(reasoning_chain)
    }
  `,
};

/**
 * CONNECTOR TOOLS
 */

export const mlConnectorTool = {
  name: "ml_connector",
  type: "model_interface",
  description: "Connect to ML models (Bedrock, OpenAI, Ollama)",
  icon: "🔮",
  color: "#6366F1", // indigo
  category: "Connectors",

  parameters: v.object({
    provider: v.union(v.literal("bedrock"), v.literal("openai"), v.literal("ollama")),
    model: v.string(),
    temperature: v.number(),
    maxTokens: v.number(),
    trackCost: v.boolean(),
    enableCaching: v.boolean(),
  }),

  inputs: ["prompt", "system_prompt"],
  outputs: ["response", "usage", "cost"],

  strandsAgentCode: `
@tool
def invoke_ml_model(prompt: str, system_prompt: str, config: dict) -> dict:
    provider = get_provider(config['provider'])

    # Build request
    request = {
        "model": config['model'],
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        "temperature": config['temperature'],
        "max_tokens": config['maxTokens']
    }

    # Check cache
    if config['enableCaching']:
        cached = check_cache(request)
        if cached:
            return cached

    # Invoke model
    response = provider.invoke(request)

    # Track cost
    cost = 0
    if config['trackCost']:
        cost = calculate_cost(config['model'], response['usage'])

    # Cache response
    if config['enableCaching']:
        cache_response(request, response)

    return {
        "response": response['content'],
        "usage": response['usage'],
        "cost": cost
    }
  `,
};

export const dataConnectorTool = {
  name: "data_connector",
  type: "data_source",
  description: "Connect to data sources (DB, API, Files)",
  icon: "🗄️",
  color: "#14B8A6", // teal
  category: "Connectors",

  parameters: v.object({
    sourceType: v.union(v.literal("database"), v.literal("api"), v.literal("file"), v.literal("stream")),
    connectionConfig: v.any(),
    queryTemplate: v.optional(v.string()),
    transformations: v.array(v.string()),
  }),

  inputs: ["query_params"],
  outputs: ["data", "metadata"],

  strandsAgentCode: `
@tool
def fetch_data(query_params: dict, config: dict) -> dict:
    connector = create_connector(config['sourceType'], config['connectionConfig'])

    # Build query
    if config.get('queryTemplate'):
        query = render_template(config['queryTemplate'], query_params)
    else:
        query = query_params

    # Fetch data
    raw_data = connector.fetch(query)

    # Apply transformations
    transformed_data = raw_data
    for transform in config['transformations']:
        transformed_data = apply_transformation(transformed_data, transform)

    return {
        "data": transformed_data,
        "metadata": {
            "source": config['sourceType'],
            "record_count": len(transformed_data),
            "timestamp": get_timestamp()
        }
    }
  `,
};

/**
 * REASONING PATTERN TOOLS
 */

export const chainOfThoughtTool = {
  name: "chain_of_thought",
  type: "sequential_reasoning",
  description: "Step-by-step reasoning with explicit thinking",
  icon: "🧠",
  color: "#A855F7", // violet
  category: "Reasoning Patterns",

  parameters: v.object({
    enableThinking: v.boolean(),
    thinkingBudget: v.number(), // tokens for thinking
    requireEvidence: v.boolean(),
    showReasoning: v.boolean(),
  }),

  inputs: ["problem"],
  outputs: ["reasoning", "answer", "confidence"],

  strandsAgentCode: `
@tool
def chain_of_thought_reasoning(problem: str, config: dict) -> dict:
    prompt = f"""Let's solve this step by step.

Problem: {problem}

{"Think through each step carefully and provide evidence for your reasoning." if config['requireEvidence'] else "Think through each step carefully."}

Step 1:"""

    # Invoke with extended thinking
    response = invoke_model(
        prompt,
        thinking_enabled=config['enableThinking'],
        thinking_budget=config['thinkingBudget']
    )

    # Extract reasoning steps
    reasoning_steps = parse_reasoning_steps(response)
    final_answer = extract_final_answer(response)
    confidence = calculate_confidence_from_reasoning(reasoning_steps)

    result = {
        "answer": final_answer,
        "confidence": confidence
    }

    if config['showReasoning']:
        result["reasoning"] = reasoning_steps

    return result
  `,
};

export const ragSystemTool = {
  name: "rag_system",
  type: "retrieval_augmented",
  description: "Retrieval Augmented Generation with knowledge base",
  icon: "📚",
  color: "#F97316", // orange
  category: "Reasoning Patterns",

  parameters: v.object({
    knowledgeBaseId: v.string(),
    retrievalStrategy: v.union(v.literal("semantic"), v.literal("keyword"), v.literal("hybrid")),
    topK: v.number(),
    rerank: v.boolean(),
    citeSources: v.boolean(),
  }),

  inputs: ["query"],
  outputs: ["response", "sources", "relevance_scores"],

  strandsAgentCode: `
@tool
def rag_generation(query: str, config: dict) -> dict:
    kb = KnowledgeBase(config['knowledgeBaseId'])

    # Retrieve relevant documents
    if config['retrievalStrategy'] == 'semantic':
        docs = kb.semantic_search(query, top_k=config['topK'])
    elif config['retrievalStrategy'] == 'keyword':
        docs = kb.keyword_search(query, top_k=config['topK'])
    else:
        docs = kb.hybrid_search(query, top_k=config['topK'])

    # Rerank if enabled
    if config['rerank']:
        docs = rerank_documents(docs, query)

    # Build augmented prompt
    context = "\\n\\n".join([doc['content'] for doc in docs])
    prompt = f"""Based on the following information, answer the query.

Context:
{context}

Query: {query}

{"Please cite your sources." if config['citeSources'] else ""}

Answer:"""

    response = invoke_model(prompt)

    return {
        "response": response,
        "sources": [{"id": doc['id'], "title": doc['title'], "relevance": doc['score']} for doc in docs],
        "relevance_scores": [doc['score'] for doc in docs]
    }
  `,
};

export const reactLoopTool = {
  name: "react_loop",
  type: "reasoning_action",
  description: "Reasoning + Acting loop for complex tasks",
  icon: "🔄",
  color: "#06B6D4", // cyan
  category: "Reasoning Patterns",

  parameters: v.object({
    maxIterations: v.number(),
    tools: v.array(v.string()),
    requireConfidence: v.number(), // minimum confidence to stop
    enableReflection: v.boolean(),
  }),

  inputs: ["goal"],
  outputs: ["result", "action_history", "reasoning_history"],

  strandsAgentCode: `
@tool
def react_loop(goal: str, config: dict) -> dict:
    action_history = []
    reasoning_history = []
    current_state = {"goal": goal, "progress": []}

    for iteration in range(config['maxIterations']):
        # Reason about current state
        reasoning_prompt = f"""Goal: {goal}

Current state: {current_state}

What should we do next? Reason step by step."""

        reasoning = invoke_model(reasoning_prompt)
        reasoning_history.append(reasoning)

        # Decide action
        action = extract_action(reasoning)

        # Execute action
        tool = get_tool(action['tool_name'])
        result = tool.execute(action['parameters'])

        action_history.append({
            "iteration": iteration,
            "action": action,
            "result": result
        })

        # Update state
        current_state['progress'].append(result)

        # Check if goal achieved
        confidence = evaluate_goal_completion(goal, current_state)
        if confidence >= config['requireConfidence']:
            break

        # Reflection (if enabled)
        if config['enableReflection']:
            reflection = reflect_on_progress(action_history, goal)
            current_state['reflection'] = reflection

    return {
        "result": current_state,
        "action_history": action_history,
        "reasoning_history": reasoning_history
    }
  `,
};

/**
 * HUMAN-IN-THE-LOOP TOOLS
 */

export const handoffToUserTool = {
  name: "handoff_to_user",
  type: "human_interaction",
  description: "Hand off control to human for input or decision",
  icon: "👤",
  color: "#EF4444", // red
  category: "Human-in-the-Loop",

  parameters: v.object({
    question: v.string(),
    options: v.optional(v.array(v.string())),
    requireConfirmation: v.boolean(),
    timeout: v.optional(v.number()), // seconds to wait
    context: v.optional(v.any()),
  }),

  inputs: ["current_state"],
  outputs: ["user_response", "timestamp"],

  strandsAgentCode: `
@tool
def handoff_to_user(current_state: dict, config: dict) -> dict:
    # Build handoff message
    message = {
        "type": "human_input_required",
        "question": config['question'],
        "context": config.get('context', current_state),
        "timestamp": get_timestamp()
    }

    if config.get('options'):
        message['options'] = config['options']

    # Store pending handoff in database
    handoff_id = store_handoff(message)

    # Wait for user response (with timeout)
    timeout = config.get('timeout', 300)  # default 5 min
    user_response = wait_for_user_input(handoff_id, timeout)

    # Require confirmation if needed
    if config['requireConfirmation']:
        confirmation = confirm_with_user(user_response)
        if not confirmation:
            # Re-prompt
            return handoff_to_user(current_state, config)

    return {
        "user_response": user_response,
        "timestamp": get_timestamp(),
        "handoff_id": handoff_id
    }
  `,
};

/**
 * MEMORY TOOLS
 */

export const shortTermMemoryTool = {
  name: "short_term_memory",
  type: "memory_storage",
  description: "Store and retrieve short-term conversation memory",
  icon: "💭",
  color: "#8B5CF6", // purple
  category: "Memory Tools",

  parameters: v.object({
    maxItems: v.number(),
    ttl: v.number(), // time to live in seconds
    compressionThreshold: v.number(),
  }),

  inputs: ["operation", "key", "value"],
  outputs: ["result", "memory_state"],

  strandsAgentCode: `
@tool
def short_term_memory(operation: str, key: str, value: any, config: dict) -> dict:
    memory = ShortTermMemory(
        max_items=config['maxItems'],
        ttl=config['ttl']
    )

    if operation == "store":
        memory.store(key, value)

        # Compress if threshold reached
        if memory.size() > config['compressionThreshold']:
            memory.compress()

        return {"result": "stored", "memory_state": memory.get_state()}

    elif operation == "retrieve":
        result = memory.retrieve(key)
        return {"result": result, "memory_state": memory.get_state()}

    elif operation == "search":
        results = memory.search(value)  # value is search query
        return {"result": results, "memory_state": memory.get_state()}

    elif operation == "clear":
        memory.clear()
        return {"result": "cleared", "memory_state": memory.get_state()}
  `,
};

export const longTermMemoryTool = {
  name: "long_term_memory",
  type: "memory_storage",
  description: "Store and retrieve long-term persistent memory",
  icon: "🧠",
  color: "#A855F7", // violet
  category: "Memory Tools",

  parameters: v.object({
    storageBackend: v.union(v.literal("convex"), v.literal("s3"), v.literal("vector_db")),
    indexingStrategy: v.union(v.literal("semantic"), v.literal("keyword"), v.literal("hybrid")),
    enableVersioning: v.boolean(),
  }),

  inputs: ["operation", "key", "value", "metadata"],
  outputs: ["result", "version"],

  strandsAgentCode: `
@tool
def long_term_memory(operation: str, key: str, value: any, metadata: dict, config: dict) -> dict:
    memory = LongTermMemory(
        backend=config['storageBackend'],
        indexing=config['indexingStrategy']
    )

    if operation == "store":
        version = memory.store(key, value, metadata)

        # Create semantic index
        if config['indexingStrategy'] in ['semantic', 'hybrid']:
            memory.create_embedding(key, value)

        return {"result": "stored", "version": version}

    elif operation == "retrieve":
        result = memory.retrieve(key)

        # Get version history if enabled
        if config['enableVersioning']:
            history = memory.get_versions(key)
            return {"result": result, "version": history[-1], "history": history}

        return {"result": result}

    elif operation == "search":
        if config['indexingStrategy'] == 'semantic':
            results = memory.semantic_search(value, top_k=10)
        elif config['indexingStrategy'] == 'keyword':
            results = memory.keyword_search(value)
        else:
            results = memory.hybrid_search(value)

        return {"result": results}

    elif operation == "delete":
        memory.delete(key)
        return {"result": "deleted"}
  `,
};

export const semanticMemoryTool = {
  name: "semantic_memory",
  type: "memory_storage",
  description: "Semantic search over memory with embeddings",
  icon: "🔍",
  color: "#EC4899", // pink
  category: "Memory Tools",

  parameters: v.object({
    embeddingModel: v.string(), // "text-embedding-3-small", "amazon.titan-embed-text-v1"
    vectorDimensions: v.number(),
    similarityThreshold: v.number(),
    rerankResults: v.boolean(),
  }),

  inputs: ["query", "filters"],
  outputs: ["results", "relevance_scores"],

  strandsAgentCode: `
@tool
def semantic_memory_search(query: str, filters: dict, config: dict) -> dict:
    # Generate query embedding
    embedder = get_embedding_model(config['embeddingModel'])
    query_embedding = embedder.embed(query)

    # Search vector store
    vector_store = VectorMemory(dimensions=config['vectorDimensions'])
    results = vector_store.similarity_search(
        query_embedding,
        filters=filters,
        threshold=config['similarityThreshold']
    )

    # Rerank if enabled
    if config['rerankResults']:
        reranker = get_reranker()
        results = reranker.rerank(query, results)

    return {
        "results": [r['content'] for r in results],
        "relevance_scores": [r['score'] for r in results],
        "metadata": [r['metadata'] for r in results]
    }
  `,
};

/**
 * ADVANCED REASONING PATTERN TOOLS
 */

export const selfConsistencyTool = {
  name: "self_consistency",
  type: "voting_mechanism",
  description: "Multi-path reasoning with voting for consistency",
  icon: "✅",
  color: "#10B981", // green
  category: "Reasoning Patterns",

  parameters: v.object({
    numPaths: v.number(), // how many reasoning paths
    votingStrategy: v.union(v.literal("majority"), v.literal("weighted"), v.literal("consensus")),
    diversityPenalty: v.number(), // penalize similar paths
    requireAgreement: v.number(), // minimum agreement threshold
  }),

  inputs: ["problem"],
  outputs: ["final_answer", "confidence", "reasoning_paths", "vote_distribution"],

  strandsAgentCode: `
@tool
def self_consistency_reasoning(problem: str, config: dict) -> dict:
    reasoning_paths = []
    answers = []

    # Generate multiple reasoning paths
    for i in range(config['numPaths']):
        # Use temperature sampling for diversity
        path = invoke_model(
            f"Solve this problem with reasoning:\\n{problem}",
            temperature=0.7 + (i * 0.1)  # increase diversity
        )

        reasoning_paths.append(path)
        answer = extract_answer(path)
        answers.append(answer)

    # Apply diversity penalty
    if config['diversityPenalty'] > 0:
        answers = penalize_duplicates(answers, config['diversityPenalty'])

    # Vote on answers
    if config['votingStrategy'] == 'majority':
        final_answer, votes = majority_vote(answers)
    elif config['votingStrategy'] == 'weighted':
        # Weight by reasoning quality
        weights = [score_reasoning_quality(path) for path in reasoning_paths]
        final_answer, votes = weighted_vote(answers, weights)
    else:  # consensus
        final_answer, votes = consensus_vote(answers, reasoning_paths)

    # Calculate confidence
    agreement = votes[final_answer] / len(answers)

    if agreement < config['requireAgreement']:
        # Not enough agreement, generate more paths
        return self_consistency_reasoning(problem, {
            **config,
            'numPaths': config['numPaths'] + 2
        })

    return {
        "final_answer": final_answer,
        "confidence": agreement,
        "reasoning_paths": reasoning_paths,
        "vote_distribution": votes
    }
  `,
};

export const treeOfThoughtsTool = {
  name: "tree_of_thoughts",
  type: "branching_reasoning",
  description: "Explore multiple reasoning branches like a tree",
  icon: "🌳",
  color: "#F59E0B", // amber
  category: "Reasoning Patterns",

  parameters: v.object({
    maxDepth: v.number(),
    branchingFactor: v.number(), // thoughts per level
    evaluationStrategy: v.union(v.literal("value"), v.literal("vote"), v.literal("hybrid")),
    pruningThreshold: v.number(), // prune bad branches
    explorationBonus: v.number(), // encourage exploration
  }),

  inputs: ["problem"],
  outputs: ["best_path", "confidence", "tree_structure"],

  strandsAgentCode: `
@tool
def tree_of_thoughts(problem: str, config: dict) -> dict:
    # Initialize tree root
    root = ThoughtNode(
        content=problem,
        depth=0,
        value=0
    )

    # Build tree with BFS/DFS
    frontier = [root]
    explored = []

    while frontier and len(explored) < config['maxDepth']:
        node = frontier.pop(0)

        # Generate child thoughts
        children = []
        for i in range(config['branchingFactor']):
            thought_prompt = f"""Given this problem and current reasoning:

Problem: {problem}
Current thought: {node.content}

What's the next step? Generate thought {i+1}:"""

            child_thought = invoke_model(thought_prompt)

            # Evaluate thought
            if config['evaluationStrategy'] == 'value':
                value = evaluate_thought_value(child_thought, problem)
            elif config['evaluationStrategy'] == 'vote':
                value = vote_on_thought(child_thought, problem)
            else:
                value = hybrid_evaluation(child_thought, problem)

            # Add exploration bonus
            value += config['explorationBonus'] * (1 / (node.depth + 1))

            child = ThoughtNode(
                content=child_thought,
                depth=node.depth + 1,
                value=value,
                parent=node
            )
            children.append(child)

        # Prune low-value branches
        children = [c for c in children if c.value >= config['pruningThreshold']]

        # Add to frontier (sorted by value)
        frontier.extend(sorted(children, key=lambda x: x.value, reverse=True))
        explored.append(node)

    # Find best path
    leaf_nodes = [n for n in explored if n.depth == config['maxDepth'] or not n.children]
    best_leaf = max(leaf_nodes, key=lambda x: x.value)

    # Trace path back to root
    best_path = []
    current = best_leaf
    while current:
        best_path.insert(0, current.content)
        current = current.parent

    return {
        "best_path": best_path,
        "confidence": best_leaf.value,
        "tree_structure": serialize_tree(root)
    }
  `,
};

export const reflexionTool = {
  name: "reflexion",
  type: "self_improvement",
  description: "Self-reflection and iterative improvement",
  icon: "🪞",
  color: "#06B6D4", // cyan
  category: "Reasoning Patterns",

  parameters: v.object({
    maxIterations: v.number(),
    improvementThreshold: v.number(), // stop if improvement < threshold
    critiqueLevels: v.array(v.string()), // ["logic", "evidence", "clarity"]
    enableMemory: v.boolean(), // remember past mistakes
  }),

  inputs: ["task"],
  outputs: ["final_result", "iteration_history", "improvements"],

  strandsAgentCode: `
@tool
def reflexion_improvement(task: str, config: dict) -> dict:
    iteration_history = []
    current_solution = None
    memory = ReflexionMemory() if config['enableMemory'] else None

    for iteration in range(config['maxIterations']):
        # Generate solution
        if current_solution is None:
            solution = invoke_model(f"Solve this task:\\n{task}")
        else:
            # Use reflection to improve
            solution = invoke_model(f"""Previous solution:\\n{current_solution}

Critiques:\\n{critique}

Improve the solution:""")

        # Self-critique on multiple levels
        critiques = {}
        for level in config['critiqueLevels']:
            critique_prompt = f"""Critique this solution on {level}:

Task: {task}
Solution: {solution}

Provide specific critiques:"""

            critiques[level] = invoke_model(critique_prompt)

        # Calculate improvement score
        if current_solution:
            improvement = calculate_improvement(current_solution, solution, critiques)

            if improvement < config['improvementThreshold']:
                break  # converged

        # Store in memory
        if memory:
            memory.store_attempt(solution, critiques)

        iteration_history.append({
            "iteration": iteration,
            "solution": solution,
            "critiques": critiques
        })

        current_solution = solution
        critique = "\\n".join(critiques.values())

    # Extract lessons learned
    improvements = []
    if memory:
        improvements = memory.extract_lessons()

    return {
        "final_result": current_solution,
        "iteration_history": iteration_history,
        "improvements": improvements
    }
  `,
};

export const mapReduceTool = {
  name: "map_reduce",
  type: "parallel_processing",
  description: "Parallel processing with aggregation (Map-Reduce)",
  icon: "🗺️",
  color: "#14B8A6", // teal
  category: "Reasoning Patterns",

  parameters: v.object({
    chunkSize: v.number(),
    mapPrompt: v.string(), // prompt for map phase
    reducePrompt: v.string(), // prompt for reduce phase
    parallelism: v.number(), // max parallel tasks
    aggregationStrategy: v.union(v.literal("concatenate"), v.literal("summarize"), v.literal("vote")),
  }),

  inputs: ["data"],
  outputs: ["result", "intermediate_results"],

  strandsAgentCode: `
@tool
def map_reduce_processing(data: list, config: dict) -> dict:
    # MAP PHASE: Split data into chunks
    chunks = split_into_chunks(data, config['chunkSize'])

    # Process chunks in parallel
    map_results = []
    for i in range(0, len(chunks), config['parallelism']):
        batch = chunks[i:i + config['parallelism']]

        # Parallel invocation
        batch_results = parallel_invoke([
            f"{config['mapPrompt']}\\n\\nData: {chunk}"
            for chunk in batch
        ])

        map_results.extend(batch_results)

    # REDUCE PHASE: Aggregate results
    if config['aggregationStrategy'] == 'concatenate':
        final_result = "\\n\\n".join(map_results)

    elif config['aggregationStrategy'] == 'summarize':
        # Hierarchical reduction if too many results
        while len(map_results) > 1:
            reduced = []
            for i in range(0, len(map_results), 2):
                pair = map_results[i:i+2]
                summary = invoke_model(f"{config['reducePrompt']}\\n\\n{pair}")
                reduced.append(summary)
            map_results = reduced

        final_result = map_results[0]

    else:  # vote
        final_result = majority_vote(map_results)

    return {
        "result": final_result,
        "intermediate_results": map_results
    }
  `,
};

export const parallelPromptsTool = {
  name: "parallel_prompts",
  type: "async_processing",
  description: "Execute multiple prompts in parallel for speed",
  icon: "⚡",
  color: "#F97316", // orange
  category: "Prompt Tools",

  parameters: v.object({
    prompts: v.array(v.object({
      id: v.string(),
      template: v.string(),
      priority: v.number(),
    })),
    maxParallelism: v.number(),
    timeoutMs: v.number(),
    failureStrategy: v.union(v.literal("skip"), v.literal("retry"), v.literal("fallback")),
  }),

  inputs: ["input_data"],
  outputs: ["results", "timings", "failures"],

  strandsAgentCode: `
@tool
def parallel_prompts_execution(input_data: dict, config: dict) -> dict:
    prompts = config['prompts']

    # Sort by priority
    prompts = sorted(prompts, key=lambda p: p['priority'], reverse=True)

    # Execute in batches
    results = {}
    timings = {}
    failures = []

    for i in range(0, len(prompts), config['maxParallelism']):
        batch = prompts[i:i + config['maxParallelism']]

        # Render prompts with input data
        rendered = [
            render_template(p['template'], input_data)
            for p in batch
        ]

        # Parallel execution with timeout
        start_time = time.now()
        batch_results = parallel_invoke_with_timeout(
            rendered,
            timeout_ms=config['timeoutMs']
        )
        end_time = time.now()

        # Handle results and failures
        for prompt, result in zip(batch, batch_results):
            if result.is_error():
                failures.append(prompt['id'])

                if config['failureStrategy'] == 'retry':
                    retry_result = invoke_model(rendered[batch.index(prompt)])
                    if not retry_result.is_error():
                        results[prompt['id']] = retry_result
                elif config['failureStrategy'] == 'fallback':
                    results[prompt['id']] = get_fallback_value(prompt)
                # skip = don't add to results
            else:
                results[prompt['id']] = result

            timings[prompt['id']] = end_time - start_time

    return {
        "results": results,
        "timings": timings,
        "failures": failures
    }
  `,
};

/**
 * Export all tools as registry
 */
export const STRANDS_TOOLS_REGISTRY = {
  // Chatbot Components
  conversational_chatbot: conversationalChatbotTool,
  chatbot_worker: chatbotWorkerTool,
  chatbot_memory: chatbotMemoryTool,

  // Prompt Tools
  prompt_template: promptTemplateTool,
  prompt_chain: promptChainTool,
  thought_builder: thoughtBuilderTool,
  parallel_prompts: parallelPromptsTool,

  // Connectors
  ml_connector: mlConnectorTool,
  data_connector: dataConnectorTool,

  // Reasoning Patterns
  chain_of_thought: chainOfThoughtTool,
  rag_system: ragSystemTool,
  react_loop: reactLoopTool,
  self_consistency: selfConsistencyTool,
  tree_of_thoughts: treeOfThoughtsTool,
  reflexion: reflexionTool,
  map_reduce: mapReduceTool,

  // Human-in-the-Loop
  handoff_to_user: handoffToUserTool,

  // Memory Tools
  short_term_memory: shortTermMemoryTool,
  long_term_memory: longTermMemoryTool,
  semantic_memory: semanticMemoryTool,
};

/**
 * Tool categories for sidebar
 */
export const TOOL_CATEGORIES = [
  {
    name: "Chatbot Components",
    icon: "💬",
    tools: ["conversational_chatbot", "chatbot_worker", "chatbot_memory"],
  },
  {
    name: "Prompt Tools",
    icon: "📝",
    tools: ["prompt_template", "prompt_chain", "thought_builder", "parallel_prompts"],
  },
  {
    name: "Connectors",
    icon: "🔌",
    tools: ["ml_connector", "data_connector"],
  },
  {
    name: "Reasoning Patterns",
    icon: "🧠",
    tools: ["chain_of_thought", "rag_system", "react_loop", "self_consistency", "tree_of_thoughts", "reflexion", "map_reduce"],
  },
  {
    name: "Human-in-the-Loop",
    icon: "👤",
    tools: ["handoff_to_user"],
  },
  {
    name: "Memory Tools",
    icon: "💭",
    tools: ["short_term_memory", "long_term_memory", "semantic_memory"],
  },
];
