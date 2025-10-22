"""
Agent Builder Application - Updated Infrastructure Diagram Generator
Complete infrastructure visualization with all implemented components

This script generates comprehensive architecture diagrams including:
- Three Chat System (Chat UI, Agent Builder, Test Chat)
- MCP Servers (11+ configured)
- Rate-Limited External APIs (Tavily, Mem0, AgentOps)
- Model Registry (49 models: Bedrock + Ollama)
- Tool Registry (50+ Strands tools)
- Memory Architecture (STM/LTM hybrid)
- Authentication (Web Identity Federation)
- DNS & Domains (Cloudflare, NOT Route53)
- Testing vs Deployment Separation

Run this script to generate updated architecture diagrams:
    python generate_infrastructure_diagram_updated.py

Requirements:
    pip install diagrams
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.aws.compute import ECS, Lambda, Fargate, ECR
from diagrams.aws.database import Dynamodb
from diagrams.aws.network import ELB, VPC, PrivateSubnet, PublicSubnet, InternetGateway, NATGateway
from diagrams.aws.storage import S3
from diagrams.aws.integration import SQS
from diagrams.aws.management import Cloudwatch, Cloudformation, SystemsManager, CloudwatchLogs
from diagrams.aws.devtools import Codebuild
from diagrams.aws.devtools import XRay
from diagrams.aws.security import IAM, SecretsManager, Cognito
from diagrams.aws.ml import Bedrock
from diagrams.aws.general import User, Client
from diagrams.saas.cdn import Cloudflare
from diagrams.onprem.client import Users


def generate_complete_infrastructure_updated():
    """Generate complete Agent Builder infrastructure diagram with ALL implemented components"""

    with Diagram(
        "Agent Builder Application - Complete Infrastructure (Updated)",
        show=False,
        direction="TB",
        filename="agent_builder_complete_infrastructure_updated",
        outformat="png",
        graph_attr={"splines": "ortho", "nodesep": "1.0", "ranksep": "1.0"}
    ):

        # Users
        users = Users("Platform\\nUsers")
        
        # Frontend Layer (Cloudflare Pages)
        with Cluster("Frontend - Cloudflare Pages\\n(ai-forge.mikepfunk.com)\\nCloudflare CDN + DNS + DDoS + SSL"):
            with Cluster("Three Chat System"):
                chat_ui = Client("Chat UI Panel\\n(Agent Building\\nInterleaved Reasoning)")
                agent_builder_input = Client("Agent Builder Input\\n(Automated Processing\\nClaude Haiku 4.5)")
                test_chat = Client("Test Chat\\n(Agent Testing\\nConversation Manager)")
            
            with Cluster("Additional UI Panels"):
                monitor_ui = Client("Monitoring\\nPanel")
                audit_ui = Client("Auditing\\nPanel")
            
            cloudflare_cdn = Cloudflare("Cloudflare CDN\\n+ DDoS + DNS + SSL")
            frontend_app = Client("React + Vite\\nSPA")
        
        # Authentication Layer (Web Identity Federation)
        with Cluster("Authentication (Web Identity Federation)\\nNO Static AWS Keys - Temporary Credentials Only"):
            cognito = Cognito("AWS Cognito\\nUser Pool\\n(us-east-1_hMFTc7CNL)")
            github_oauth = IAM("GitHub\\nOAuth")
            google_oauth = IAM("Google\\nOAuth")
            sts_assume = IAM("STS AssumeRole\\nWebIdentity\\n(Temporary Creds)")

        # Convex Backend
        with Cluster("Backend - Convex Serverless\\n(resolute-kudu-325.convex.cloud)\\nCustom API Domain: api.mikepfunk.com"):
            with Cluster("Core Services"):
                convex_api = Lambda("Convex\\nAPI Gateway")
                convex_functions = Lambda("Convex\\nFunctions")
                convex_realtime = Lambda("Real-time\\nSubscriptions")
            
            with Cluster("Database & Memory Architecture"):
                convex_db = Lambda("Convex DB\\n(14+ Tables)")
                stm_memory = Lambda("STM Memory\\n(<8KB)\\nReal-time Access")
                dynamodb_index = Dynamodb("DynamoDB\\nMemory Indexing\\nSemantic Search")
            
            with Cluster("Agent Management"):
                agent_builder = Lambda("Agent\\nBuilder")
                code_generator = Lambda("Code\\nGenerator")
                validator = Lambda("Validator")
                deploy_router = Lambda("Deployment\\nRouter")
            
            with Cluster("Model Registry (49 Models)"):
                bedrock_models_reg = Lambda("AWS Bedrock\\n(Claude, Titan, etc.)")
                ollama_models_reg = Lambda("Ollama\\n(llama, mistral, etc.)")
            
            with Cluster("Tool Registry (50+ Strands Tools)"):
                strands_tools = Lambda("Strands Tools\\n(Pre-configured)")
                tool_discovery = Lambda("Auto-Discovery\\nfrom toolRegistry.ts")
            
            with Cluster("MCP Servers (11+ Configured)"):
                mcp_bedrock_agentcore = Lambda("bedrock-agentcore\\n(Windows uv)")
                mcp_document_fetcher = Lambda("document-fetcher\\n(Doc Processing)")
                mcp_aws_diagram = Lambda("aws-diagram\\n(Infrastructure)")
                mcp_others = Lambda("Plus 8+ Others\\n(from mcpConfig.ts)")
            
            with Cluster("Rate-Limited External APIs"):
                tavily_api = Lambda("Tavily Web Search\\n(1000 req/month)")
                mem0_api = Lambda("Mem0 Memory\\n(1000 req/month)")
                agentops_api = Lambda("AgentOps Tracing\\n(1000 req/month)")

        # AWS Services Layer
        with Cluster("AWS Backend & AI Services (us-east-1)"):
            # Storage
            with Cluster("Storage Layer"):
                s3_ltm = S3("S3 LTM Storage\\n(>8KB)\\nCost-effective")
                s3_artifacts = S3("Agent\\nArtifacts")
                s3_packages = S3("Deployment\\nPackages")
            
            # AI Services
            with Cluster("AI Services"):
                bedrock_agentcore = Bedrock("Bedrock\\nAgentCore")
                bedrock_models = Bedrock("Bedrock\\nModels")
                strands_agents = Lambda("Strands\\nAgents SDK")
            
            # Testing vs Deployment Separation
            with Cluster("Testing vs Deployment Separation"):
                agentcore_setup = Lambda("agentcoreSetup.ts\\n(Testing via MCP)")
                agentcore_deployment = Lambda("agentcoreDeployment.ts\\n(Sandbox Deploy)")
                aws_deployment = Lambda("awsDeployment.ts\\n(User AWS Deploy)")
            
            # Deployment Tiers
            with Cluster("Tier 1 - AgentCore (Testing + Freemium)"):
                tier1_testing = Bedrock("Testing\\n(MCP Server)")
                tier1_freemium = Bedrock("Freemium Deploy\\n(Sandbox)")
                tier1_memory = Lambda("AgentCore\\nMemory")
                tier1_gateway = Lambda("AgentCore\\nGateway")
                tier1_limit = Lambda("10 tests/month\\n$0 cost")
            
            # Deployment Infrastructure (Tier 2)
            with Cluster("Tier 2 - Personal AWS (User Fargate)\\nCross-Account IAM Role"):
                with Cluster("VPC Infrastructure"):
                    vpc = VPC("VPC")
                    igw = InternetGateway("Internet\\nGateway")
                    alb = ELB("Application\\nLoad Balancer")
                
                with Cluster("ECS Fargate"):
                    ecs_cluster = ECS("ECS\\nCluster")
                    fargate_task = Fargate("Fargate\\nTask")
                    ecr_repo = ECR("ECR\\nRepository")
                
                tier2_limit = Lambda("Unlimited\\n$40-110/mo")
            
            # Tier 3 - Enterprise
            with Cluster("Tier 3 - Enterprise (SSO + Multi-tenant)"):
                tier3_sso = IAM("AWS SSO\\nIdentity Center")
                tier3_org = SystemsManager("AWS\\nOrganizations")
                tier3_multi = Lambda("Multi-user\\nManagement")
                tier3_limit = Lambda("Unlimited\\nCustom pricing")
            
            # Monitoring & Observability
            with Cluster("Monitoring & Observability"):
                cloudwatch = Cloudwatch("CloudWatch\\nMetrics")
                cloudwatch_logs = CloudwatchLogs("CloudWatch\\nLogs")
                xray = XRay("AWS X-Ray\\nTracing")
                otel = Lambda("OpenTelemetry\\nOTEL")
                audit_logs = CloudwatchLogs("Audit\\nLogs")

        # DNS & Domains (Cloudflare, NOT Route53)
        with Cluster("DNS & Domains (Cloudflare, NOT Route53)"):
            dns_frontend = Cloudflare("ai-forge.mikepfunk.com\\n→ Cloudflare Pages")
            dns_api = Cloudflare("api.mikepfunk.com\\n→ Convex Backend")

        # Data Flows
        users >> cloudflare_cdn >> frontend_app
        
        # Three Chat System to Frontend
        [chat_ui, agent_builder_input, test_chat] >> frontend_app
        [monitor_ui, audit_ui] >> frontend_app
        
        # DNS Resolution
        dns_frontend >> cloudflare_cdn
        dns_api >> convex_api
        
        # Authentication Flow
        frontend_app >> cognito
        cognito >> [github_oauth, google_oauth]
        cognito >> sts_assume
        
        # Frontend to Convex
        frontend_app >> convex_api
        convex_api >> convex_functions
        convex_functions >> convex_db
        convex_functions >> convex_realtime
        
        # Memory Architecture (STM/LTM Hybrid)
        convex_db >> stm_memory
        stm_memory >> Edge(label="<8KB\\nReal-time") >> convex_db
        stm_memory >> Edge(label=">8KB\\nPersistent") >> s3_ltm
        convex_db >> dynamodb_index
        dynamodb_index >> s3_ltm
        
        # Agent Building Flow
        convex_functions >> agent_builder
        agent_builder >> code_generator
        code_generator >> validator
        validator >> deploy_router
        
        # Model & Tool Registries
        convex_functions >> [bedrock_models_reg, ollama_models_reg]
        convex_functions >> [strands_tools, tool_discovery]
        
        # MCP Integration
        convex_functions >> [mcp_bedrock_agentcore, mcp_document_fetcher, mcp_aws_diagram, mcp_others]
        
        # Rate-Limited APIs
        convex_functions >> [tavily_api, mem0_api, agentops_api]
        
        # Testing vs Deployment Separation
        deploy_router >> agentcore_setup
        deploy_router >> agentcore_deployment
        deploy_router >> aws_deployment
        
        # Deployment Tiers
        agentcore_setup >> tier1_testing
        agentcore_deployment >> tier1_freemium
        aws_deployment >> ecs_cluster
        
        # Tier 1 - AgentCore Integration
        tier1_testing >> bedrock_models
        tier1_freemium >> bedrock_models
        [tier1_testing, tier1_freemium] >> tier1_memory
        [tier1_testing, tier1_freemium] >> tier1_gateway
        [tier1_testing, tier1_freemium] >> strands_agents
        
        # Tier 2 - Fargate Deployment
        ecs_cluster >> fargate_task
        ecs_cluster >> ecr_repo
        fargate_task >> [s3_artifacts, s3_packages]
        
        # Tier 3 - Enterprise
        tier3_sso >> tier3_org
        tier3_org >> [tier1_freemium, ecs_cluster]
        tier3_multi >> [tier1_freemium, ecs_cluster]
        
        # AWS Authentication
        sts_assume >> [ecs_cluster, s3_ltm, tier1_freemium, tier3_sso]
        
        # Monitoring
        [fargate_task, tier1_testing, tier1_freemium, convex_functions] >> cloudwatch_logs
        cloudwatch_logs >> cloudwatch
        convex_functions >> audit_logs
        audit_logs >> monitor_ui
        audit_logs >> audit_ui
        
        # OTEL & X-Ray Tracing
        [fargate_task, tier1_testing, tier1_freemium] >> otel
        otel >> xray
        xray >> cloudwatch
        xray >> monitor_ui


def generate_three_chat_system():
    """Generate detailed Three Chat System diagram"""

    with Diagram(
        "Agent Builder - Three Chat System",
        show=False,
        direction="TB",
        filename="agent_builder_three_chat_system",
        outformat="png"
    ):

        user = User("User")

        with Cluster("Three Chat System"):
            with Cluster("1. Chat UI Panel"):
                chat_ui = Client("Chat UI Panel")
                interleaved_reasoning = Lambda("Interleaved\\nReasoning")
                agent_building = Lambda("Agent Building\\nProcess")

            with Cluster("2. Agent Builder Input"):
                builder_input = Client("Agent Builder\\nInput")
                automated_processing = Lambda("Automated\\nProcessing")
                claude_haiku = Lambda("Claude Haiku 4.5\\nProcessing")

            with Cluster("3. Test Chat"):
                test_chat = Client("Test Chat")
                agent_testing = Lambda("Agent\\nTesting")
                conversation_mgr = Lambda("Conversation\\nManager")

        with Cluster("Backend Processing"):
            convex_backend = Lambda("Convex\\nBackend")
            agent_executor = Lambda("Agent\\nExecutor")
            test_queue = Lambda("Test\\nQueue")

        # Flow
        user >> chat_ui
        chat_ui >> interleaved_reasoning >> agent_building
        
        user >> builder_input
        builder_input >> automated_processing >> claude_haiku
        
        user >> test_chat
        test_chat >> agent_testing >> conversation_mgr
        
        [agent_building, claude_haiku, conversation_mgr] >> convex_backend
        convex_backend >> agent_executor >> test_queue


def generate_mcp_servers_diagram():
    """Generate MCP Servers integration diagram"""

    with Diagram(
        "Agent Builder - MCP Servers (11+ Configured)",
        show=False,
        direction="TB",
        filename="agent_builder_mcp_servers",
        outformat="png"
    ):

        with Cluster("MCP Server Management"):
            mcp_config = Lambda("mcpConfig.ts\\nConfiguration")
            mcp_client = Lambda("mcpClient.ts\\nTool Invocation")

        with Cluster("Built-in MCP Servers (System)"):
            bedrock_agentcore = Lambda("bedrock-agentcore\\n(Windows uv tool)")
            document_fetcher = Lambda("document-fetcher\\n(Doc retrieval)")
            aws_diagram = Lambda("aws-diagram\\n(Infrastructure)")

        with Cluster("Additional MCP Servers (8+)"):
            ollama_server = Lambda("Ollama\\n(Local LLM)")
            notion_server = Lambda("Notion\\n(Productivity)")
            linear_server = Lambda("Linear\\n(Issue tracking)")
            github_server = Lambda("GitHub\\n(Code repos)")
            supabase_server = Lambda("Supabase\\n(Vector DB)")
            pinecone_server = Lambda("Pinecone\\n(Vector DB)")
            filesystem_server = Lambda("Filesystem\\n(File ops)")
            sequential_server = Lambda("Sequential\\nThinking")

        with Cluster("Agent Integration"):
            agent_executor = Lambda("Agent\\nExecutor")
            tool_discovery = Lambda("Tool\\nDiscovery")
            agent_as_tool = Lambda("Agent as\\nMCP Tool")

        # Connections
        mcp_config >> [bedrock_agentcore, document_fetcher, aws_diagram]
        mcp_config >> [ollama_server, notion_server, linear_server, github_server]
        mcp_config >> [supabase_server, pinecone_server, filesystem_server, sequential_server]
        
        mcp_client >> [bedrock_agentcore, document_fetcher, aws_diagram]
        mcp_client >> [ollama_server, notion_server, linear_server, github_server]
        
        [bedrock_agentcore, document_fetcher, aws_diagram] >> tool_discovery
        [ollama_server, notion_server, linear_server, github_server] >> tool_discovery
        
        tool_discovery >> agent_executor
        agent_executor >> agent_as_tool


def generate_model_tool_registries():
    """Generate Model and Tool Registries diagram"""

    with Diagram(
        "Agent Builder - Model & Tool Registries",
        show=False,
        direction="LR",
        filename="agent_builder_registries",
        outformat="png"
    ):

        with Cluster("Model Registry (49 Models)"):
            with Cluster("AWS Bedrock Models"):
                claude_models = Lambda("Claude Series\\n(4.5, 4.1, 4.0, 3.7, 3.5, 3)")
                nova_models = Lambda("Nova Series\\n(Pro, Lite, Micro, Premier)")
                titan_models = Lambda("Titan Series\\n(Text, Image, Embeddings)")
                llama_bedrock = Lambda("Llama Series\\n(3.3, 3.2, 3.1, 3.0)")
                mistral_bedrock = Lambda("Mistral\\n(Large 2, Small)")
                other_bedrock = Lambda("AI21, Cohere\\nJamba, Command")

            with Cluster("Ollama Models"):
                qwen_models = Lambda("Qwen3 Series\\n(4B, 8B, 14B, 30B, Coder)")
                llama_ollama = Lambda("Llama Series\\n(3.3, 3.2, 3.1)")
                phi_models = Lambda("Phi-4 Series\\n(14B, Mini, Reasoning)")
                gemma_models = Lambda("Gemma Series\\n(4B, 12B, 27B, Code)")
                deepseek_models = Lambda("DeepSeek\\n(R1, Coder, V3)")
                mistral_ollama = Lambda("Mistral\\n(Nemo, Devstral)")

        with Cluster("Tool Registry (50+ Strands Tools)"):
            with Cluster("RAG & Memory (4)"):
                rag_tools = Lambda("retrieve, memory\\nagent_core_memory\\nmem0_memory")

            with Cluster("File Operations (3)"):
                file_tools = Lambda("editor, file_read\\nfile_write")

            with Cluster("Shell & System (4)"):
                shell_tools = Lambda("environment, shell\\ncron, use_computer")

            with Cluster("Code Interpretation (2)"):
                code_tools = Lambda("python_repl\\ncode_interpreter")

            with Cluster("Web & Network (5)"):
                web_tools = Lambda("http_request, slack\\nbrowser, agent_core_browser\\nrss")

            with Cluster("Multi-Modal (6)"):
                multimodal_tools = Lambda("generate_image_stability\\nimage_reader, generate_image\\nnova_reels, speak, diagram")

            with Cluster("AWS Services (1)"):
                aws_tools = Lambda("use_aws")

            with Cluster("Utilities (5)"):
                utility_tools = Lambda("calculator, current_time\\nload_tool, sleep")

            with Cluster("Agents & Workflows (15)"):
                agent_tools = Lambda("graph, agent_graph, journal\\nswarm, stop, handoff_to_user\\nuse_agent, think, use_llm\\nworkflow, batch, a2a_client")

        with Cluster("Integration"):
            model_config = Lambda("Model\\nConfiguration")
            tool_discovery = Lambda("Tool\\nDiscovery")
            agent_builder = Lambda("Agent\\nBuilder")

        # Connections
        [claude_models, nova_models, titan_models, llama_bedrock, mistral_bedrock, other_bedrock] >> model_config
        [qwen_models, llama_ollama, phi_models, gemma_models, deepseek_models, mistral_ollama] >> model_config
        
        [rag_tools, file_tools, shell_tools, code_tools, web_tools] >> tool_discovery
        [multimodal_tools, aws_tools, utility_tools, agent_tools] >> tool_discovery
        
        model_config >> agent_builder
        tool_discovery >> agent_builder


def generate_memory_architecture():
    """Generate detailed Memory Architecture diagram"""

    with Diagram(
        "Agent Builder - Memory Architecture (STM/LTM Hybrid)",
        show=False,
        direction="TB",
        filename="agent_builder_memory_architecture",
        outformat="png"
    ):

        with Cluster("Memory Input"):
            agent_data = Lambda("Agent\\nData")
            size_check = Lambda("Size\\nCheck")

        with Cluster("Short-Term Memory (STM)"):
            convex_stm = Lambda("Convex Tables\\n(<8KB)\\nReal-time Access")
            stm_benefits = Lambda("Benefits:\\n• Fast access\\n• Real-time sync\\n• WebSocket updates")

        with Cluster("Long-Term Memory (LTM)"):
            s3_ltm = S3("S3 Storage\\n(>8KB)\\nCost-effective")
            ltm_benefits = Lambda("Benefits:\\n• Cost-effective\\n• Unlimited size\\n• Durable storage")

        with Cluster("Memory Indexing"):
            dynamodb_index = Dynamodb("DynamoDB\\nMemory Index\\nSemantic Search")
            index_benefits = Lambda("Benefits:\\n• Fast lookups\\n• Semantic search\\n• Query optimization")

        with Cluster("Memory Access"):
            memory_router = Lambda("Memory\\nRouter")
            hybrid_strategy = Lambda("Hybrid\\nStrategy")

        # Flow
        agent_data >> size_check
        size_check >> Edge(label="<8KB") >> convex_stm
        size_check >> Edge(label=">8KB") >> s3_ltm
        
        convex_stm >> stm_benefits
        s3_ltm >> ltm_benefits
        
        [convex_stm, s3_ltm] >> dynamodb_index
        dynamodb_index >> index_benefits
        
        dynamodb_index >> memory_router >> hybrid_strategy


if __name__ == "__main__":
    print("Generating Agent Builder infrastructure diagrams (UPDATED)...")
    print()
    print("⚠️  Note: Make sure Graphviz is installed and in your PATH")
    print("   Install: choco install graphviz")
    print("   Or download from: https://graphviz.org/download/")
    print("   Add to PATH: C:\\Program Files\\Graphviz\\bin")
    print()
    
    try:
        print("1. Complete Infrastructure Diagram (Updated)...")
        generate_complete_infrastructure_updated()
        print("   ✓ Generated: agent_builder_complete_infrastructure_updated.png")
        
        print("2. Three Chat System Diagram...")
        generate_three_chat_system()
        print("   ✓ Generated: agent_builder_three_chat_system.png")
        
        print("3. MCP Servers Diagram...")
        generate_mcp_servers_diagram()
        print("   ✓ Generated: agent_builder_mcp_servers.png")
        
        print("4. Model & Tool Registries Diagram...")
        generate_model_tool_registries()
        print("   ✓ Generated: agent_builder_registries.png")
        
        print("5. Memory Architecture Diagram...")
        generate_memory_architecture()
        print("   ✓ Generated: agent_builder_memory_architecture.png")
        
        print()
        print("✅ All updated diagrams generated successfully!")
        print("📁 Diagrams saved in current directory")
        print()
        print("🔍 Key Updates:")
        print("• Three Chat System (Chat UI, Agent Builder Input, Test Chat)")
        print("• MCP Servers (11+ configured from mcpConfig.ts)")
        print("• Rate-Limited APIs (Tavily, Mem0, AgentOps)")
        print("• Model Registry (49 models: Bedrock + Ollama)")
        print("• Tool Registry (50+ Strands tools)")
        print("• Memory Architecture (STM/LTM hybrid)")
        print("• Testing vs Deployment separation")
        print("• DNS clarification (Cloudflare, NOT Route53)")
        print("• Web Identity Federation (no static keys)")
        
    except Exception as e:
        print(f"\n❌ Error generating diagrams: {e}")
        print("\nTroubleshooting:")
        print("1. Install Graphviz: choco install graphviz")
        print("2. Add to PATH: C:\\Program Files\\Graphviz\\bin")
        print("3. Restart PowerShell/Terminal")
        print("4. Try again: python generate_infrastructure_diagram_updated.py")