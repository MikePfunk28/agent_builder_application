"""
Agent Builder Application - Infrastructure Diagram Generator
Complete infrastructure visualization with Cloudflare, Convex, AWS, and AgentCore

Run this script to generate a comprehensive architecture diagram:
    python generate_infrastructure_diagram_complete.py

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


def generate_complete_infrastructure():
    """Generate complete Agent Builder infrastructure diagram with all panels"""

    with Diagram(
        "Agent Builder Application - Complete Infrastructure",
        show=False,
        direction="TB",
        filename="agent_builder_complete_infrastructure",
        outformat="png",
        graph_attr={"splines": "ortho", "nodesep": "1.0", "ranksep": "1.0"}
    ):

        # Users
        users = Users("Platform\nUsers")
        
        # Frontend Layer (Cloudflare Pages)
        with Cluster("Frontend - Cloudflare Pages\n(ai-forge.mikepfunk.com)"):
            with Cluster("UI Panels"):
                chat_ui = Client("Chat\nPanel")
                builder_ui = Client("Agent Builder\nWalkthrough")
                automated_ui = Client("Agent Builder\nAutomated")
                monitor_ui = Client("Monitoring\nPanel")
                audit_ui = Client("Auditing\nPanel")
                mcp_panel = Client("MCP Server\nManagement")

            with Cluster("Three Chat Systems"):
                regular_chat = Client("Regular Chat\n(Standard UI)")
                interleaved_chat = Client("Interleaved Chat\n(Reasoning Visible)")
                conversation_chat = Client("Conversation Chat\n(Multi-turn)")

            cloudflare_cdn = Cloudflare("Cloudflare CDN\n+ DDoS + DNS + SSL")
            frontend_app = Client("React + Vite\nSPA")
            dns = Cloudflare("DNS\nai-forge.mikepfunk.com")
        
        # Authentication Layer
        with Cluster("Authentication (Web Identity Federation)"):
            with Cluster("OAuth Providers"):
                cognito = Cognito("AWS Cognito\nUser Pool")
                github_oauth = IAM("GitHub OAuth\n(3 callback URLs)")
                google_oauth = IAM("Google OAuth\n(3 callback URLs)")

            with Cluster("Identity Federation"):
                convex_auth = Lambda("Convex Auth\n(getAuthUserId)")
                sts_assume = IAM("STS AssumeRole\nWebIdentity")
                temp_creds = IAM("Temporary\nCredentials (1hr)")

            with Cluster("Access Control"):
                user_check = Lambda("User ID\nValidation")
                role_check = Lambda("Role-Based\nAccess")

        # Convex Backend
        with Cluster("Backend - Convex Serverless\n(resolute-kudu-325.convex.cloud)"):
            with Cluster("Core Services"):
                convex_api = Lambda("Convex\nAPI Gateway")
                convex_functions = Lambda("Convex\nFunctions")
                convex_realtime = Lambda("Real-time\nSubscriptions")
            
            with Cluster("Database & Memory Architecture"):
                convex_db = Lambda("Convex DB\n(14+ Tables)")

                with Cluster("Memory Tiers"):
                    stm_memory = Lambda("STM (<8KB)\nShort-term")
                    ltm_memory = Lambda("LTM (>8KB)\nLong-term")
                    memory_router = Lambda("Memory\nRouter")

                with Cluster("Core Tables"):
                    agents_table = Dynamodb("agents")
                    conversations_table = Dynamodb("conversations")
                    interleaved_table = Dynamodb("interleavedMessages")
                    deployments_table = Dynamodb("deployments")
                    mcp_config_table = Dynamodb("mcpServerConfigs")
            
            with Cluster("Agent Management"):
                agent_builder = Lambda("Agent\nBuilder")
                code_generator = Lambda("Code\nGenerator")
                validator = Lambda("Validator")
                deploy_router = Lambda("Deployment\nRouter")

                with Cluster("Deployment Package (4 Files)"):
                    agent_py = Lambda("agent.py\n(@agent decorator)")
                    requirements_txt = Lambda("requirements.txt\n(pip deps)")
                    dockerfile = Lambda("Dockerfile\n(container)")
                    cloudformation_yaml = Lambda("cloudformation.yaml\n(IaC)")
                    mcp_json = Lambda("mcp.json\n(MCP config)")
                    diagram_png = Lambda("diagram.png\n(architecture)")
            
            with Cluster("MCP Servers (11 Configured)"):
                mcp_aws_diagram = Lambda("aws-diagram\n(Architecture)")
                mcp_aws_cognito = Lambda("aws-cognito\n(Auth)")
                mcp_strands_docs = Lambda("strands-docs\n(SDK Docs)")
                mcp_bedrock_docs = Lambda("bedrock-agentcore-docs\n(AgentCore)")
                mcp_document = Lambda("document-fetcher\n(Web Scraping)")
                mcp_s3 = Lambda("s3\n(Storage)")
                mcp_dynamodb = Lambda("dynamodb\n(Database)")
                mcp_knowledge = Lambda("knowledge-bases\n(RAG)")
                mcp_cloudformation = Lambda("cloudformation\n(IaC)")
                mcp_ecs = Lambda("ecs\n(Containers)")
                mcp_iam = Lambda("iam\n(Security)")

            with Cluster("Tool Registry (50+ Strands Tools)"):
                tool_registry = Lambda("Tool Registry\n(toolRegistry.ts)")

                with Cluster("Tool Categories"):
                    rag_tools = Lambda("RAG & Memory\n(5 tools)")
                    file_tools = Lambda("File Operations\n(3 tools)")
                    shell_tools = Lambda("Shell & System\n(4 tools)")
                    code_tools = Lambda("Code Interpretation\n(2 tools)")
                    web_tools = Lambda("Web & Network\n(5 tools)")
                    multimodal_tools = Lambda("Multi-modal\n(6 tools)")
                    aws_tools = Lambda("AWS Services\n(1 tool)")
                    agent_tools = Lambda("Agents & Workflows\n(12 tools)")

            with Cluster("Model Registry (49 Models)"):
                model_registry = Lambda("Model Registry\n(modelRegistry.ts)")

                with Cluster("Model Providers"):
                    bedrock_provider = Bedrock("AWS Bedrock\n(29 models)")
                    anthropic_provider = Lambda("Anthropic\n(8 models)")
                    openai_provider = Lambda("OpenAI\n(6 models)")
                    other_providers = Lambda("Others\n(6 models)")

        # Rate-Limited External APIs
        with Cluster("Rate-Limited External APIs"):
            anthropic_api = Lambda("Anthropic API\n(Rate Limited)")
            openai_api = Lambda("OpenAI API\n(Rate Limited)")
            bedrock_api = Bedrock("Bedrock API\n(Throttled)")

            with Cluster("API Quotas"):
                anthropic_quota = Lambda("200 req/min\n2000 req/day")
                openai_quota = Lambda("500 req/min\n10K req/day")
                bedrock_quota = Lambda("100 TPS\nPer model")

        # AWS Services Layer
        with Cluster("AWS Backend & AI Services"):
            # Storage
            with Cluster("Storage (S3)"):
                s3_ltm = S3("LTM Storage\n(>8KB)")
                s3_artifacts = S3("Agent\nArtifacts")
                s3_packages = S3("Deployment\nPackages")
            
            # AI Services
            with Cluster("AI Services"):
                bedrock_agentcore = Bedrock("Bedrock\nAgentCore")
                bedrock_models = Bedrock("Bedrock\nModels")
                strands_agents = Lambda("Strands\nAgents SDK")
            
            # Deployment Tiers (Testing vs Deployment)
            with Cluster("TESTING ENVIRONMENT (Tier 1)"):
                with Cluster("Tier 1 - Freemium (Platform AgentCore)"):
                    tier1_runtime = Bedrock("AgentCore\nRuntime")
                    tier1_memory = Lambda("AgentCore\nMemory")
                    tier1_gateway = Lambda("AgentCore\nGateway")
                    tier1_limit = Lambda("10 tests/month\n$0 cost")
                    tier1_label = Lambda("⚠️ TESTING ONLY\nNot for production")

                    with Cluster("Testing Features"):
                        test_sandbox = Lambda("Isolated\nSandbox")
                        test_metrics = Lambda("Test\nMetrics")
                        test_quota = Lambda("Quota\nTracking")
            
            # Deployment Infrastructure (Tier 2)
            with Cluster("DEPLOYMENT ENVIRONMENT (Tier 2 & 3)"):
                with Cluster("Tier 2 - Personal AWS (User Fargate)"):
                    with Cluster("VPC Infrastructure"):
                        vpc = VPC("VPC")
                        igw = InternetGateway("Internet\nGateway")
                        alb = ELB("Application\nLoad Balancer")

                    with Cluster("ECS Fargate"):
                        ecs_cluster = ECS("ECS\nCluster")
                        fargate_task = Fargate("Fargate\nTask")
                        ecr_repo = ECR("ECR\nRepository")

                    tier2_limit = Lambda("Unlimited\n$40-110/mo")
                    tier2_label = Lambda("✅ PRODUCTION\nUser AWS Account")

                # Tier 3 - Enterprise
                with Cluster("Tier 3 - Enterprise (SSO + Multi-tenant)"):
                    tier3_sso = IAM("AWS SSO\nIdentity Center")
                    tier3_org = SystemsManager("AWS\nOrganizations")
                    tier3_multi = Lambda("Multi-user\nManagement")
                    tier3_limit = Lambda("Unlimited\nCustom pricing")
                    tier3_label = Lambda("✅ PRODUCTION\nEnterprise SSO")
            
            # Monitoring & Logging
            with Cluster("Monitoring & Observability"):
                cloudwatch = Cloudwatch("CloudWatch\nMetrics")
                cloudwatch_logs = CloudwatchLogs("CloudWatch\nLogs")
                xray = XRay("AWS X-Ray\nTracing")
                otel = Lambda("OpenTelemetry\nOTEL")
                audit_logs = CloudwatchLogs("Audit\nLogs")

                with Cluster("Convex Quota Monitoring"):
                    write_quota = Lambda("Write Ops\n1/turn (optimized)")
                    read_quota = Lambda("Read Ops\nEvent-driven")
                    quota_alerts = Lambda("Quota\nAlerts")

        # Data Flows
        users >> dns >> cloudflare_cdn >> frontend_app

        # UI Panels to Frontend
        [chat_ui, builder_ui, automated_ui, monitor_ui, audit_ui, mcp_panel] >> frontend_app

        # Three Chat Systems
        [regular_chat, interleaved_chat, conversation_chat] >> frontend_app
        
        # Authentication Flow
        frontend_app >> convex_auth
        convex_auth >> cognito
        cognito >> [github_oauth, google_oauth]
        cognito >> sts_assume >> temp_creds
        temp_creds >> [user_check, role_check]
        [user_check, role_check] >> convex_functions
        
        # Frontend to Convex
        frontend_app >> convex_api
        convex_api >> convex_functions
        convex_functions >> convex_db
        convex_functions >> convex_realtime
        
        # Memory Architecture
        convex_db >> memory_router
        memory_router >> Edge(label="<8KB") >> stm_memory
        memory_router >> Edge(label=">8KB") >> ltm_memory
        stm_memory >> convex_db
        ltm_memory >> s3_ltm

        # Core Tables
        convex_db >> [agents_table, conversations_table, interleaved_table,
                     deployments_table, mcp_config_table]
        
        # Agent Building Flow
        convex_functions >> agent_builder
        agent_builder >> code_generator
        code_generator >> validator
        validator >> [agent_py, requirements_txt, dockerfile, cloudformation_yaml, mcp_json, diagram_png]
        [agent_py, requirements_txt, dockerfile, cloudformation_yaml, mcp_json, diagram_png] >> deploy_router
        
        # MCP Servers Integration
        convex_functions >> [mcp_aws_diagram, mcp_aws_cognito, mcp_strands_docs,
                            mcp_bedrock_docs, mcp_document, mcp_s3, mcp_dynamodb,
                            mcp_knowledge, mcp_cloudformation, mcp_ecs, mcp_iam]

        # Tool Registry & Model Registry
        convex_functions >> tool_registry
        tool_registry >> [rag_tools, file_tools, shell_tools, code_tools,
                         web_tools, multimodal_tools, aws_tools, agent_tools]

        convex_functions >> model_registry
        model_registry >> [bedrock_provider, anthropic_provider, openai_provider, other_providers]

        # Rate-Limited API Calls
        model_registry >> Edge(label="Route calls") >> [anthropic_api, openai_api, bedrock_api]

        anthropic_api >> anthropic_quota
        openai_api >> openai_quota
        bedrock_api >> bedrock_quota

        # Quota monitoring feedback
        [anthropic_quota, openai_quota, bedrock_quota] >> quota_alerts
        
        # Deployment Tiers
        deploy_router >> Edge(label="Tier 1\nFreemium") >> tier1_runtime
        deploy_router >> Edge(label="Tier 2\nPersonal") >> ecs_cluster
        deploy_router >> Edge(label="Tier 3\nEnterprise") >> tier3_sso
        
        # Tier 1 - AgentCore Integration
        tier1_runtime >> bedrock_models
        tier1_runtime >> tier1_memory
        tier1_runtime >> tier1_gateway
        tier1_runtime >> strands_agents

        # Testing workflow
        tier1_runtime >> [test_sandbox, test_metrics, test_quota]
        test_quota >> Edge(label="10/month limit") >> tier1_limit
        
        # Tier 2 - Fargate Deployment
        ecs_cluster >> fargate_task
        ecs_cluster >> ecr_repo
        fargate_task >> [s3_artifacts, s3_packages]
        
        # Tier 3 - Enterprise
        tier3_sso >> tier3_org
        tier3_org >> [tier1_runtime, ecs_cluster]
        tier3_multi >> [tier1_runtime, ecs_cluster]
        
        # AWS Authentication
        temp_creds >> [ecs_cluster, s3_ltm, tier1_runtime, tier3_sso, s3_artifacts, s3_packages]
        
        # Monitoring
        [fargate_task, tier1_runtime, convex_functions] >> cloudwatch_logs
        cloudwatch_logs >> cloudwatch
        convex_functions >> audit_logs
        audit_logs >> monitor_ui
        audit_logs >> audit_ui

        # OTEL & X-Ray Tracing
        [fargate_task, tier1_runtime] >> otel
        otel >> xray
        xray >> cloudwatch
        xray >> monitor_ui

        # Convex Quota Monitoring
        convex_functions >> write_quota
        convex_functions >> read_quota
        [write_quota, read_quota] >> quota_alerts
        quota_alerts >> monitor_ui

        # Event-Driven Architecture (No Polling)
        convex_realtime >> Edge(label="WebSocket\nLive Queries") >> frontend_app
        [regular_chat, interleaved_chat, conversation_chat] >> Edge(label="Event-driven\n1 write/turn") >> convex_db


def generate_tier_comparison():
    """Generate tier comparison diagram"""

    with Diagram(
        "Agent Builder - Deployment Tier Comparison",
        show=False,
        direction="LR",
        filename="agent_builder_tier_comparison",
        outformat="png"
    ):

        user = User("User")

        with Cluster("Tier 1: Freemium"):
            t1_platform = Bedrock("Platform\nAgentCore")
            t1_limit = Lambda("10 tests/month")
            t1_cost = Lambda("$0")

        with Cluster("Tier 2: Personal"):
            t2_fargate = Fargate("User's\nFargate")
            t2_limit = Lambda("Unlimited")
            t2_cost = Lambda("$40-110/mo")

        with Cluster("Tier 3: Enterprise"):
            t3_sso = IAM("Enterprise\nSSO")
            t3_limit = Lambda("Unlimited")
            t3_cost = Lambda("Custom")

        user >> [t1_platform, t2_fargate, t3_sso]


def generate_deployment_flow():
    """Generate deployment flow diagram"""

    with Diagram(
        "Agent Builder - Deployment Flow (Tier 2)",
        show=False,
        direction="TB",
        filename="agent_builder_deployment_flow",
        outformat="png"
    ):

        with Cluster("1. Initialization"):
            start = User("User\nConfigures AWS")
            validate = IAM("Validate\nCredentials")

        with Cluster("2. Package Generation"):
            gen_code = Lambda("Generate\nAgent Code")
            gen_docker = Lambda("Generate\nDockerfile")
            gen_cfn = Cloudformation("Generate\nCloudFormation")

        with Cluster("3. Upload Artifacts"):
            s3_upload = S3("Upload to\nS3 Bucket")
            presign = Lambda("Generate\nPresigned URL")

        with Cluster("4. Container Registry"):
            ecr_create = ECR("Create/Verify\nECR Repo")
            ecr_auth = Lambda("Get ECR\nCredentials")

        with Cluster("5. Infrastructure"):
            cfn_deploy = Cloudformation("Deploy\nCloudFormation")
            vpc_create = VPC("Create\nVPC")
            ecs_create = ECS("Create ECS\nCluster")
            alb_create = ELB("Create\nLoad Balancer")

        with Cluster("6. Container Build"):
            build = Codebuild("Build\nDocker Image")
            push = ECR("Push to\nECR")

        with Cluster("7. Service Launch"):
            task_def = ECS("Create Task\nDefinition")
            service = Fargate("Launch\nFargate Service")

        with Cluster("8. Verification"):
            health = Cloudwatch("Health\nCheck")
            logs = CloudwatchLogs("Verify\nLogs")
            complete = Lambda("Deployment\nComplete")

        # Flow
        start >> validate >> gen_code
        gen_code >> gen_docker >> gen_cfn
        gen_cfn >> s3_upload >> presign
        presign >> ecr_create >> ecr_auth
        ecr_auth >> cfn_deploy
        cfn_deploy >> vpc_create >> ecs_create >> alb_create
        alb_create >> build >> push
        push >> task_def >> service
        service >> health >> logs >> complete


def generate_security_architecture():
    """Generate security architecture diagram"""

    with Diagram(
        "Agent Builder - Security Architecture",
        show=False,
        direction="TB",
        filename="agent_builder_security",
        outformat="png"
    ):

        user = User("User")

        with Cluster("Authentication Layer"):
            cognito = Cognito("Cognito\nUser Pool")
            oauth = IAM("OAuth 2.0\nGitHub/Google")
            fed_pool = IAM("Federated\nIdentity Pool")

        with Cluster("Authorization Layer"):
            iam_roles = IAM("IAM\nRoles")
            web_identity = IAM("AssumeRole\nWebIdentity")
            temp_creds = IAM("Temporary\nCredentials")

        with Cluster("Secrets Management"):
            secrets_mgr = SecretsManager("Secrets\nManager")
            param_store = SystemsManager("Parameter\nStore")
            kms = IAM("KMS\nEncryption")

        with Cluster("Network Security"):
            sg_alb = IAM("Security Group\nALB")
            sg_ecs = IAM("Security Group\nECS")
            nacl = IAM("Network\nACL")

        with Cluster("Audit & Compliance"):
            cloudtrail = CloudwatchLogs("CloudTrail\nAudit Logs")
            audit_logs = CloudwatchLogs("Application\nAudit Logs")

        # Flow
        user >> cognito >> oauth >> fed_pool
        fed_pool >> web_identity >> temp_creds >> iam_roles

        iam_roles >> secrets_mgr
        iam_roles >> param_store
        secrets_mgr >> kms
        param_store >> kms

        iam_roles >> [sg_alb, sg_ecs, nacl]

        [cognito, iam_roles, secrets_mgr] >> cloudtrail
        [cognito, iam_roles] >> audit_logs


def generate_comprehensive_features():
    """Generate comprehensive features diagram showing all components"""

    with Diagram(
        "Agent Builder - Comprehensive Features & Components",
        show=False,
        direction="TB",
        filename="agent_builder_comprehensive_features",
        outformat="png"
    ):

        with Cluster("Frontend Features"):
            three_chats = Client("3 Chat Systems\n(Regular/Interleaved/Conversation)")
            six_panels = Client("6 UI Panels\n(Chat/Builder/Auto/Monitor/Audit/MCP)")

        with Cluster("MCP Integration"):
            eleven_servers = Lambda("11 MCP Servers\n(AWS/Docs/Tools)")

        with Cluster("Registries"):
            model_reg = Bedrock("49 Models\n(Bedrock/Anthropic/OpenAI)")
            tool_reg = Lambda("50+ Tools\n(8 Categories)")

        with Cluster("Memory System"):
            stm = Lambda("STM <8KB\nConvex")
            ltm = S3("LTM >8KB\nS3")

        with Cluster("Deployment Options"):
            test_tier = Bedrock("Testing\n10 tests/mo")
            personal_tier = Fargate("Personal\n$40-110/mo")
            enterprise_tier = IAM("Enterprise\nCustom")

        with Cluster("Package Contents"):
            six_files = Lambda("6 Files\nagent.py/requirements.txt\nDockerfile/CFN\nmcp.json/diagram.png")

        # Connections
        three_chats >> eleven_servers
        six_panels >> eleven_servers
        eleven_servers >> model_reg
        eleven_servers >> tool_reg
        model_reg >> stm
        model_reg >> ltm
        tool_reg >> stm
        tool_reg >> ltm
        stm >> six_files
        ltm >> six_files
        six_files >> test_tier
        six_files >> personal_tier
        six_files >> enterprise_tier


if __name__ == "__main__":
    print("Generating Agent Builder infrastructure diagrams...")
    print()
    print("NOTE: Make sure Graphviz is installed and in your PATH")
    print("   Install: choco install graphviz")
    print("   Or download from: https://graphviz.org/download/")
    print("   Add to PATH: C:\\Program Files\\Graphviz\\bin")
    print()

    try:
        print("1. Complete Infrastructure Diagram...")
        generate_complete_infrastructure()
        print("   [OK] Generated: agent_builder_complete_infrastructure.png")

        print("2. Tier Comparison Diagram...")
        generate_tier_comparison()
        print("   [OK] Generated: agent_builder_tier_comparison.png")

        print("3. Deployment Flow Diagram...")
        generate_deployment_flow()
        print("   [OK] Generated: agent_builder_deployment_flow.png")

        print("4. Security Architecture Diagram...")
        generate_security_architecture()
        print("   [OK] Generated: agent_builder_security.png")

        print("5. Comprehensive Features Diagram...")
        generate_comprehensive_features()
        print("   [OK] Generated: agent_builder_comprehensive_features.png")

        print()
        print("SUCCESS: All diagrams generated successfully!")
        print("LOCATION: Diagrams saved in current directory")
        print()
        print("Diagram Summary:")
        print("   - Complete Infrastructure: Full system architecture")
        print("   - Tier Comparison: 3 deployment tiers (Testing/Personal/Enterprise)")
        print("   - Deployment Flow: Step-by-step Tier 2 deployment")
        print("   - Security Architecture: Auth, access control, secrets")
        print("   - Comprehensive Features: All components at a glance")
        print()
        print("Key Features Included:")
        print("   [x] Three Chat Systems (Regular/Interleaved/Conversation)")
        print("   [x] 11 MCP Servers (AWS services + documentation)")
        print("   [x] 49 Models across 4 providers")
        print("   [x] 50+ Strands Tools in 8 categories")
        print("   [x] Rate-limited external APIs with quota tracking")
        print("   [x] Memory architecture (STM <8KB / LTM >8KB)")
        print("   [x] Testing vs Deployment environment separation")
        print("   [x] 6-file deployment packages")
        print("   [x] Event-driven architecture (1 write/turn)")
    except Exception as e:
        print(f"\nERROR: Failed to generate diagrams: {e}")
        print("\nTroubleshooting:")
        print("1. Install Graphviz: choco install graphviz")
        print("2. Add to PATH: C:\\Program Files\\Graphviz\\bin")
        print("3. Restart PowerShell/Terminal")
        print("4. Try again: python generate_infrastructure_diagram_complete.py")