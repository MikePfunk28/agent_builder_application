"""
Generate Full Agent Builder Architecture Diagram with API Gateway Integration
Based on GENERATED_ARCHITECTURE.md specification
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.aws.compute import ECS, Fargate, Lambda, ECR
from diagrams.aws.network import VPC, ELB, APIGateway, InternetGateway
from diagrams.aws.database import Dynamodb
from diagrams.aws.storage import S3
from diagrams.aws.security import IAM, SecretsManager, KMS, Cognito
from diagrams.aws.management import Organizations, Cloudwatch, CloudwatchLogs
from diagrams.custom import Custom
from diagrams.onprem.vcs import Github

print("Generating Full Agent Builder Architecture Diagram with API Gateway...")
print("=" * 80)

# Create diagram with enhanced styling
with Diagram(
    "Agent Builder - Full Architecture with API Gateway",
    filename="agent_builder_full_architecture_with_api_gateway",
    show=False,
    direction="LR",
    graph_attr={
        "fontsize": "22",
        "fontname": "Arial Bold",
        "splines": "ortho",
        "nodesep": "1.8",
        "ranksep": "2.5",
        "pad": "1.2",
        "bgcolor": "white"
    },
    node_attr={
        "fontsize": "14",
        "fontname": "Arial Bold",
        "height": "1.2",
        "width": "2.2"
    },
    edge_attr={
        "fontsize": "12",
        "fontname": "Arial"
    }
):
    
    # ==========================================
    # Frontend Layer - Cloudflare
    # ==========================================
    with Cluster("Frontend Layer\n(Cloudflare Pages)", graph_attr={
        "bgcolor": "#E3F2FD",
        "penwidth": "4",
        "fontsize": "18",
        "fontname": "Arial Bold"
    }):
        frontend = Custom("React + Vite\nTypeScript\n\nai-forge.mikepfunk.com", "")
    
    # ==========================================
    # Backend Layer - Convex
    # ==========================================
    with Cluster("Backend Layer\n(Convex Serverless)", graph_attr={
        "bgcolor": "#FFF9C4",
        "penwidth": "4",
        "fontsize": "18",
        "fontname": "Arial Bold"
    }):
        convex_backend = Custom("Convex Backend\nresolute-kudu-325.convex.site", "")
        
        with Cluster("Core Services", graph_attr={"bgcolor": "#FFFDE7"}):
            convex_auth = Custom("Convex Auth\nSession Management", "")
            code_gen = Custom("Code Generator\nAgent Templates", "")
            package_gen = Custom("Package Generator\n4-File Bundle", "")
            deploy_router = Custom("Deployment Router\nTier Selection", "")
    
    # ==========================================
    # API Gateway Layer (NEW)
    # ==========================================
    with Cluster("API Gateway Layer\n(AWS Integration)", graph_attr={
        "bgcolor": "#C8E6C9",
        "penwidth": "4",
        "fontsize": "18",
        "fontname": "Arial Bold"
    }):
        api_gateway = APIGateway("API Gateway\nREST API\n/deploy endpoint")
        api_lambda = Lambda("Routing Lambda\nTier Selection\nConvex → AWS Bridge")
        api_authorizer = Lambda("Authorizer\nJWT Validation")
    
    # ==========================================
    # Authentication Providers
    # ==========================================
    with Cluster("Authentication Providers", graph_attr={
        "bgcolor": "#FFEBEE",
        "penwidth": "4",
        "fontsize": "18",
        "fontname": "Arial Bold"
    }):
        github_oauth = Github("GitHub OAuth\nauth.github.com")
        google_oauth = Custom("Google OAuth\naccounts.google.com", "")
        cognito = Cognito("AWS Cognito\nFederated Identity\nus-east-1_hMFTc7CNL")
        anonymous = Custom("Anonymous\nGuest Access", "")
    
    # ==========================================
    # AWS Tier 1: Freemium (Bedrock AgentCore)
    # ==========================================
    with Cluster("Tier 1: Freemium\n(Platform Managed - Bedrock AgentCore)", graph_attr={
        "bgcolor": "#E8F5E9",
        "penwidth": "4",
        "fontsize": "18",
        "fontname": "Arial Bold"
    }):
        agentcore = Custom("Bedrock AgentCore\nServerless Runtime\n10 tests/month", "")
        
        with Cluster("AgentCore Services", graph_attr={"bgcolor": "#F1F8E9"}):
            agentcore_memory = Custom("AgentCore Memory\nEvent + Semantic", "")
            agentcore_sandbox = Custom("Code Interpreter\nIsolated Sandbox", "")
            agentcore_browser = Custom("AgentCore Browser\nWeb Interaction", "")
        
        with Cluster("Platform Resources", graph_attr={"bgcolor": "#F1F8E9"}):
            platform_ecr = ECR("Platform ECR\nShared Images")
            platform_logs = CloudwatchLogs("AgentCore Logs\nCloudWatch")
            platform_dynamodb = Dynamodb("Agent State\nDynamoDB")
    
    # ==========================================
    # AWS Tier 2: Personal (User AWS Account)
    # ==========================================
    with Cluster("Tier 2: Personal\n(User AWS Account - Cross-Account)", graph_attr={
        "bgcolor": "#E1BEE7",
        "penwidth": "4",
        "fontsize": "18",
        "fontname": "Arial Bold"
    }):
        sts_role = IAM("STS AssumeRole\nCross-Account\nExternal ID")
        
        with Cluster("User VPC\n10.0.0.0/16", graph_attr={"bgcolor": "#F3E5F5"}):
            user_igw = InternetGateway("Internet Gateway")
            user_vpc = VPC("User VPC\n3 AZs")
            user_alb = ELB("Application LB\nHTTPS")
            
            with Cluster("ECS Cluster", graph_attr={"bgcolor": "#FCE4EC"}):
                user_cluster = ECS("User ECS Cluster")
                user_fargate = Fargate("Fargate Tasks\n512 CPU / 1024 MB\nAgent Runtime")
        
        with Cluster("User Storage & Logs", graph_attr={"bgcolor": "#F3E5F5"}):
            user_ecr = ECR("User ECR\nPrivate Registry")
            user_logs = CloudwatchLogs("CloudWatch Logs\n30-day retention")
            user_s3 = S3("S3 Storage\nEncrypted at Rest")
            user_dynamodb = Dynamodb("DynamoDB\nAgent State & Metrics")
    
    # ==========================================
    # AWS Tier 3: Enterprise (Coming Soon)
    # ==========================================
    with Cluster("Tier 3: Enterprise\n(Coming Soon - SSO)", graph_attr={
        "bgcolor": "#FFCCBC",
        "penwidth": "4",
        "fontsize": "18",
        "fontname": "Arial Bold",
        "style": "dashed"
    }):
        sso = IAM("AWS SSO\nIdentity Center")
        orgs = Organizations("AWS Organizations\nMulti-Account")
        secrets = SecretsManager("Secrets Manager\nAPI Keys & Config")
        kms = KMS("KMS Encryption\nData Keys")
    
    # ==========================================
    # MCP Integration Layer
    # ==========================================
    with Cluster("MCP Integration Layer\n(Model Context Protocol)", graph_attr={
        "bgcolor": "#B2EBF2",
        "penwidth": "4",
        "fontsize": "18",
        "fontname": "Arial Bold"
    }):
        diagram_mcp = Custom("AWS Diagram MCP\nArchitecture Visualization\nawslabs.aws-diagram-mcp-server", "")
        agentcore_mcp = Custom("Bedrock AgentCore MCP\nDeployment & Testing\nControl Plane API", "")
        terraform_mcp = Custom("Terraform MCP\nInfrastructure as Code", "")
    
    # ==========================================
    # External Services
    # ==========================================
    with Cluster("External Services", graph_attr={
        "bgcolor": "#F5F5F5",
        "penwidth": "3",
        "fontsize": "18",
        "fontname": "Arial Bold"
    }):
        github_repo = Github("GitHub Repository\nAgent Code Storage\nVersion Control")
        cloudflare_cdn = Custom("Cloudflare CDN\nGlobal Edge Network", "")
    
    
    # ==========================================
    # CONNECTION FLOWS
    # ==========================================
    
    # Frontend to CDN to Backend
    frontend >> Edge(label="Static Assets", color="#1976D2", style="bold", penwidth="3") >> cloudflare_cdn
    frontend >> Edge(label="Real-time\nWebSocket", color="#0288D1", style="bold", penwidth="3") >> convex_backend
    
    # Convex Internal Connections
    # pylint: disable=pointless-statement
    convex_backend >> Edge(color="#FFA000", penwidth="2") >> convex_auth
    convex_backend >> Edge(color="#FFA000", penwidth="2") >> code_gen
    convex_backend >> Edge(color="#FFA000", penwidth="2") >> package_gen
    convex_backend >> Edge(color="#FFA000", penwidth="2") >> deploy_router
    
    # Code Generation Pipeline
    code_gen >> Edge(label="Templates", color="#388E3C", penwidth="2") >> package_gen
    package_gen >> Edge(label="4-File Bundle:\n• agent.py\n• mcp.json\n• Dockerfile\n• cloudformation.yaml", 
                        color="#2E7D32", style="bold", penwidth="3") >> github_repo
    
    # Authentication Flows
    convex_auth >> Edge(label="OAuth 2.0", color="#D32F2F", penwidth="2") >> github_oauth
    convex_auth >> Edge(label="OAuth 2.0", color="#D32F2F", penwidth="2") >> google_oauth
    convex_auth >> Edge(label="OAuth 2.0", color="#D32F2F", penwidth="2") >> cognito
    convex_auth >> Edge(label="Guest", color="#757575", style="dashed", penwidth="2") >> anonymous
    
    # Deployment Router to API Gateway
    deploy_router >> Edge(label="Deploy Request", color="#43A047", style="bold", penwidth="3") >> api_gateway
    api_gateway >> Edge(color="#43A047", penwidth="2") >> api_authorizer
    api_gateway >> Edge(color="#43A047", penwidth="2") >> api_lambda
    
    # Tier 1 Deployment Flow
    api_lambda >> Edge(label="Tier 1\nFreemium", color="#66BB6A", style="bold", penwidth="3") >> agentcore
    agentcore >> Edge(color="#81C784", penwidth="2") >> agentcore_memory
    agentcore >> Edge(color="#81C784", penwidth="2") >> agentcore_sandbox
    agentcore >> Edge(color="#81C784", penwidth="2") >> agentcore_browser
    agentcore >> Edge(color="#A5D6A7", penwidth="2") >> platform_ecr
    agentcore >> Edge(color="#A5D6A7", penwidth="2") >> platform_logs
    agentcore >> Edge(color="#A5D6A7", penwidth="2") >> platform_dynamodb
    
    # Tier 2 Deployment Flow
    api_lambda >> Edge(label="Tier 2\nPersonal", color="#AB47BC", style="bold", penwidth="3") >> sts_role
    sts_role >> Edge(label="AssumeRole\nExternal ID", color="#BA68C8", penwidth="2") >> user_vpc
    user_igw >> Edge(color="#CE93D8", penwidth="2") >> user_alb
    user_alb >> Edge(color="#CE93D8", penwidth="2") >> user_cluster
    user_cluster >> Edge(color="#E1BEE7", penwidth="2") >> user_fargate
    user_fargate >> Edge(color="#F3E5F5", penwidth="2") >> user_ecr
    user_fargate >> Edge(color="#F3E5F5", penwidth="2") >> user_logs
    user_fargate >> Edge(color="#F3E5F5", penwidth="2") >> user_s3
    user_fargate >> Edge(color="#F3E5F5", penwidth="2") >> user_dynamodb
    
    # Tier 3 Deployment Flow (Future)
    api_lambda >> Edge(label="Tier 3\nEnterprise\n(Future)", color="#FF7043", style="dashed", penwidth="2") >> sso
    sso >> Edge(color="#FFAB91", style="dashed", penwidth="2") >> orgs
    orgs >> Edge(color="#FFCCBC", style="dashed", penwidth="2") >> secrets
    secrets >> Edge(color="#FFCCBC", style="dashed", penwidth="2") >> kms
    
    # MCP Integration
    deploy_router >> Edge(label="MCP Tools", color="#00ACC1", penwidth="2") >> diagram_mcp
    deploy_router >> Edge(label="MCP Tools", color="#00ACC1", penwidth="2") >> agentcore_mcp
    deploy_router >> Edge(label="MCP Tools", color="#00ACC1", penwidth="2") >> terraform_mcp
    agentcore_mcp >> Edge(label="Control Plane", color="#26C6DA", penwidth="2") >> agentcore
    
    # Monitoring Flows
    platform_logs >> Edge(label="Metrics", color="#FFA726", style="dotted", penwidth="1.5") >> Cloudwatch("CloudWatch\nMetrics")
    user_logs >> Edge(label="Metrics", color="#FFA726", style="dotted", penwidth="1.5") >> Cloudwatch("CloudWatch\nMetrics")

print("\n" + "=" * 80)
print("✅ Full Architecture Diagram Generated Successfully!")
print("=" * 80)
print(f"📁 Location: agent_builder_full_architecture_with_api_gateway.png")
print("\n✨ Architecture Features:")
print("  • Frontend: Cloudflare Pages (React + Vite)")
print("  • Backend: Convex Serverless (Real-time)")
print("  • API Gateway: AWS API Gateway + Lambda (Convex → AWS Bridge)")
print("  • Auth: GitHub, Google, AWS Cognito, Anonymous")
print("  • Tier 1: Bedrock AgentCore (Freemium)")
print("  • Tier 2: User AWS Account (Personal)")
print("  • Tier 3: AWS SSO (Enterprise - Coming Soon)")
print("  • MCP: Diagram, AgentCore, Terraform")
print("\n🔄 Key Integration:")
print("  Convex Backend → API Gateway → Lambda → Tier Selection → AgentCore/ECS")
print("\n🎨 Visual Enhancements:")
print("  • Bold, large text (14-22pt)")
print("  • Color-coded environments (8 distinct clusters)")
print("  • Thick connection lines (2-4pt)")
print("  • Labeled data flows")
print("=" * 80)
