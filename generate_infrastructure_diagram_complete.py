"""
Agent Builder Application - Infrastructure Diagram Generator
Complete AWS infrastructure visualization

Run this script to generate a comprehensive architecture diagram:
    python generate_infrastructure_diagram_complete.py

Requirements:
    pip install diagrams
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.aws.compute import ECS, Lambda, Fargate, ECR
from diagrams.aws.database import Dynamodb
from diagrams.aws.network import ELB, Route53, VPC, PrivateSubnet, PublicSubnet, InternetGateway, NATGateway, CloudFront
from diagrams.aws.storage import S3
from diagrams.aws.integration import SQS
from diagrams.aws.management import Cloudwatch, Cloudformation, SystemsManager, CloudwatchLogs
from diagrams.aws.devtools import Codebuild
from diagrams.aws.security import IAM, SecretsManager, Cognito
from diagrams.aws.ml import Bedrock
from diagrams.aws.general import User
from diagrams.saas.cdn import Cloudflare


def generate_complete_infrastructure():
    """Generate complete Agent Builder infrastructure diagram"""

    with Diagram(
        "Agent Builder Application - Complete AWS Infrastructure",
        show=False,
        direction="TB",
        filename="agent_builder_complete_infrastructure",
        outformat="png"
    ):

        # Users
        users = User("Platform Users")
        
        # Frontend
        with Cluster("Frontend Layer (Cloudflare)"):
            cloudflare = Cloudflare("Cloudflare\nPages")
            cdn = CloudFront("CDN +\nDDoS Protection")
            frontend = Lambda("React + Vite\nSPA")
            dns = Route53("Route53\nDNS")        # Authentication
        with Cluster("Authentication"):
            auth = Cognito("AWS Cognito\nOAuth 2.0")
            fed_identity = IAM("Federated\nIdentity")

        # Backend
        with Cluster("Backend Services (Convex Serverless)"):
            api = Lambda("API\nGateway")
            convex_backend = Lambda("Convex\nBackend")
            convex_db = Dynamodb("Convex\nDatabase")

        # Agent Management
        with Cluster("Agent Builder System"):
            agent_builder = Lambda("Agent\nBuilder")
            code_gen = Lambda("Code\nGenerator")
            validator = Lambda("Agent\nValidator")
            mcp_integration = Lambda("MCP\nIntegration")

        # Deployment Tiers
        with Cluster("Deployment Orchestration"):
            deploy_router = Lambda("Deployment\nRouter")

            # Tier 1 - Freemium
            with Cluster("Tier 1 - Freemium (Platform)"):
                platform_agent = Bedrock("Bedrock\nAgentCore")
                platform_logs = CloudwatchLogs("Platform\nLogs")
                platform_metrics = Cloudwatch("Platform\nMetrics")

            # Tier 2 - Personal AWS
            with Cluster("Tier 2 - Personal AWS Account"):
                cfn = Cloudformation("CloudFormation\nStack")

                with Cluster("VPC Infrastructure"):
                    vpc = VPC("VPC\n10.0.0.0/16")
                    igw = InternetGateway("Internet\nGateway")

                    with Cluster("Public Subnets"):
                        pub_sub1 = PublicSubnet("Public\nSubnet 1")
                        pub_sub2 = PublicSubnet("Public\nSubnet 2")
                    
                    with Cluster("NAT Gateways"):
                        nat1 = NATGateway("NAT\nGateway 1")
                        nat2 = NATGateway("NAT\nGateway 2")
                    
                    with Cluster("Private Subnets"):
                        priv_sub1 = PrivateSubnet("Private\nSubnet 1")
                        priv_sub2 = PrivateSubnet("Private\nSubnet 2")
                    
                    alb = ELB("Application\nLoad Balancer")

                with Cluster("ECS Fargate Cluster"):
                    ecs_cluster = ECS("ECS\nCluster")
                    fargate1 = Fargate("Fargate\nTask 1")
                    fargate2 = Fargate("Fargate\nTask 2")
                    fargate3 = Fargate("Fargate\nTask 3")

                ecr_repo = ECR("ECR\nRepository")
                user_logs = CloudwatchLogs("User\nLogs")
                user_metrics = Cloudwatch("User\nMetrics")

            # Tier 3 - Enterprise
            with Cluster("Tier 3 - Enterprise SSO"):
                sso = IAM("AWS SSO\nIdentity Center")
                org = SystemsManager("AWS\nOrganizations")

        # Infrastructure as Code
        with Cluster("Infrastructure as Code"):
            cdk_gen = Codebuild("CDK\nGenerator")
            cfn_template = Cloudformation("CloudFormation\nTemplates")

        # Storage
        with Cluster("Storage Layer"):
            s3_artifacts = S3("Agent\nArtifacts")
            s3_packages = S3("Deployment\nPackages")
            s3_diagrams = S3("Architecture\nDiagrams")

        # Monitoring
        with Cluster("Monitoring & Observability"):
            cw_logs = CloudwatchLogs("Centralized\nLogs")
            cw_metrics = Cloudwatch("Metrics &\nDashboards")
            cw_alarms = Cloudwatch("Alarms &\nNotifications")

        # Security
        with Cluster("Security & Secrets"):
            secrets = SecretsManager("Secrets\nManager")
            params = SystemsManager("Parameter\nStore")
            iam_roles = IAM("IAM\nRoles")

        # Testing System
        with Cluster("Testing Infrastructure"):
            test_queue = SQS("Test\nQueue")
            test_executor = Lambda("Test\nExecutor")
            test_results = Dynamodb("Test\nResults")

        # User flow
        users >> cloudflare >> cdn >> dns >> frontend
        frontend >> auth >> fed_identity
        frontend >> convex_backend >> api
        convex_backend >> convex_db
        
        # Agent building flow
        api >> agent_builder >> code_gen
        code_gen >> mcp_integration
        mcp_integration >> validator
        validator >> deploy_router
        
        # Tier 1 deployment
        deploy_router >> Edge(label="Freemium\n(10 tests/mo)") >> platform_agent
        platform_agent >> platform_logs >> platform_metrics
        
        # Tier 2 deployment
        deploy_router >> Edge(label="Personal AWS\n(Unlimited)") >> cfn
        cfn >> ecr_repo
        cfn >> vpc
        vpc >> igw
        vpc >> pub_sub1
        vpc >> pub_sub2
        vpc >> priv_sub1
        vpc >> priv_sub2
        pub_sub1 >> nat1
        pub_sub2 >> nat2
        nat1 >> priv_sub1
        nat2 >> priv_sub2
        igw >> alb
        alb >> ecs_cluster
        ecr_repo >> ecs_cluster
        ecs_cluster >> fargate1
        ecs_cluster >> fargate2
        ecs_cluster >> fargate3
        fargate1 >> user_logs
        fargate2 >> user_logs
        fargate3 >> user_logs
        user_logs >> user_metrics

        # Tier 3 deployment
        deploy_router >> Edge(label="Enterprise\n(SSO)") >> sso
        sso >> org >> cfn

        # Storage connections
        code_gen >> s3_artifacts
        deploy_router >> s3_packages
        cfn >> s3_diagrams

        # Monitoring connections
        platform_agent >> cw_logs
        fargate1 >> cw_logs
        fargate2 >> cw_logs
        fargate3 >> cw_logs
        cw_logs >> cw_metrics >> cw_alarms
        
        # Security connections
        convex_backend >> secrets
        api >> secrets
        deploy_router >> secrets
        platform_agent >> params
        ecs_cluster >> params
        ecs_cluster >> iam_roles
        platform_agent >> iam_roles        # Testing flow
        validator >> test_queue >> test_executor
        test_executor >> test_results
        test_executor >> cw_logs

        # IaC flow
        agent_builder >> cdk_gen >> cfn_template >> cfn


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


if __name__ == "__main__":
    print("Generating Agent Builder infrastructure diagrams...")
    print()
    print("⚠️  Note: Make sure Graphviz is installed and in your PATH")
    print("   Install: choco install graphviz")
    print("   Or download from: https://graphviz.org/download/")
    print("   Add to PATH: C:\\Program Files\\Graphviz\\bin")
    print()
    
    try:
        print("1. Complete Infrastructure Diagram...")
        generate_complete_infrastructure()
        print("   ✓ Generated: agent_builder_complete_infrastructure.png")
        
        print("2. Tier Comparison Diagram...")
        generate_tier_comparison()
        print("   ✓ Generated: agent_builder_tier_comparison.png")
        
        print("3. Deployment Flow Diagram...")
        generate_deployment_flow()
        print("   ✓ Generated: agent_builder_deployment_flow.png")
        
        print("4. Security Architecture Diagram...")
        generate_security_architecture()
        print("   ✓ Generated: agent_builder_security.png")
        
        print()
        print("✅ All diagrams generated successfully!")
        print("📁 Diagrams saved in current directory")
    except Exception as e:
        print(f"\n❌ Error generating diagrams: {e}")
        print("\nTroubleshooting:")
        print("1. Install Graphviz: choco install graphviz")
        print("2. Add to PATH: C:\\Program Files\\Graphviz\\bin")
        print("3. Restart PowerShell/Terminal")
        print("4. Try again: python generate_infrastructure_diagram_complete.py")