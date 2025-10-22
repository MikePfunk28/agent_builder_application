#!/usr/bin/env python3
"""
Agent Builder Application Infrastructure Diagram Generator
Generates a comprehensive diagram showing the complete architecture
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.aws.compute import ECS, Fargate, Lambda, EC2ContainerRegistry
from diagrams.aws.database import Dynamodb
from diagrams.aws.network import APIGateway, CloudFront, Route53
from diagrams.aws.storage import S3
from diagrams.aws.security import IAM, Cognito
from diagrams.aws.management import Cloudformation, CloudwatchLogs
from diagrams.aws.ml import Bedrock
from diagrams.aws.integration import SQS
from diagrams.onprem.client import Users
from diagrams.onprem.vcs import Github
from diagrams.programming.framework import React
from diagrams.programming.language import Python, Nodejs, TypeScript
from diagrams.generic.database import SQL
from diagrams.generic.network import Firewall
from diagrams.generic.compute import Rack
from diagrams.onprem.network import Internet

def generate_agent_builder_diagram():
    """Generate comprehensive Agent Builder Application infrastructure diagram"""
    
    with Diagram("Agent Builder Application - Complete Infrastructure", 
                 show=False, 
                 filename="agent_builder_infrastructure",
                 direction="TB"):
        
        # Users and External Services
        with Cluster("Users & External Auth"):
            users = Users("Users")
            github_oauth = Github("GitHub OAuth")
            google_oauth = Rack("Google OAuth")
            
        # Frontend Layer (Cloudflare Pages)
        with Cluster("Frontend - Cloudflare Pages"):
            cloudflare = Internet("Cloudflare Pages\nai-forge.mikepfunk.com")
            react_app = React("React + Vite\nAgent Builder UI")
            
        # Backend Layer (Convex)
        with Cluster("Backend - Convex Cloud"):
            convex_db = SQL("Convex Database\nresolute-kudu-325")
            convex_functions = Nodejs("Convex Functions\nAuth, Agents, MCP")
            convex_auth = IAM("Convex Auth\nOAuth + Password")
            
        # AI/ML Services
        with Cluster("AI/ML Services"):
            bedrock = Bedrock("AWS Bedrock\n49 Models")
            ollama = Rack("Ollama\nLocal Models")
            claude = Rack("Claude Haiku 4.5\nInterleaved Reasoning")
            
        # External APIs (Rate Limited)
        with Cluster("External APIs (1000/month)"):
            tavily = Rack("Tavily\nWeb Search")
            mem0 = Rack("Mem0\nMemory")
            agentops = Rack("AgentOps\nTracing")
            
        # MCP Integration Layer
        with Cluster("MCP Integration"):
            mcp_servers = Python("MCP Servers\nAWS Diagram, Tools")
            strands_tools = Python("Strands Tools\n50+ Tools")
            
        # Deployment Tiers
        with Cluster("Tier 1: AgentCore (Freemium)"):
            agentcore = Bedrock("Bedrock AgentCore\nManaged Runtime")
            agentcore_lambda = Lambda("AgentCore Invoker")
            
        with Cluster("Tier 2: Personal AWS (Cross-Account)"):
            # User AWS Account Resources
            with Cluster("User AWS Account"):
                cross_account_role = IAM("Cross-Account Role\nExternal ID")
                user_vpc = Firewall("VPC\n10.0.0.0/16")
                
                with Cluster("ECS Fargate"):
                    ecs_cluster = ECS("ECS Cluster")
                    fargate_service = Fargate("Fargate Service\nAgent Container")
                    
                ecr_repo = EC2ContainerRegistry("ECR Repository\nAgent Images")
                s3_bucket = S3("S3 Bucket\nDeployment Packages")
                cloudwatch = CloudwatchLogs("CloudWatch Logs")
                cloudformation = Cloudformation("CloudFormation\nInfrastructure")
                
        # Chat System Architecture
        with Cluster("Chat System (3 Chats)"):
            chat_ui = React("Chat UI Panel\nAgent Building Process")
            agent_builder_input = TypeScript("Agent Builder Input\nAutomated Processing")
            test_chat = React("Test Chat\nAgent Testing")
            conversation_manager = Python("Conversation Manager\nStrands Agents")
            
        # Code Generation & Meta-tooling
        with Cluster("Code Generation & Meta-tooling"):
            code_generator = Python("Code Generator\n@agent/@tool decorators")
            meta_tooling = Python("Meta-tooling\nDynamic Tool Creation")
            docker_generator = Python("Docker Generator\nContainer Images")
            
        # Connections - Frontend to Backend
        users >> Edge(label="HTTPS") >> cloudflare
        cloudflare >> react_app
        react_app >> Edge(label="WebSocket/HTTP") >> convex_functions
        
        # Authentication Flow
        users >> github_oauth >> convex_auth
        users >> google_oauth >> convex_auth
        convex_auth >> convex_functions
        
        # Backend to Database
        convex_functions >> convex_db
        
        # AI/ML Connections
        convex_functions >> bedrock
        convex_functions >> ollama
        convex_functions >> claude
        
        # External API Connections (Rate Limited)
        convex_functions >> Edge(label="1000/month") >> tavily
        convex_functions >> Edge(label="1000/month") >> mem0
        convex_functions >> Edge(label="1000/month") >> agentops
        
        # MCP Integration
        convex_functions >> mcp_servers
        mcp_servers >> strands_tools
        
        # Chat System Flow
        users >> chat_ui >> agent_builder_input
        agent_builder_input >> Edge(label="Interleaved Reasoning") >> claude
        claude >> code_generator >> meta_tooling
        meta_tooling >> test_chat
        test_chat >> conversation_manager
        
        # Deployment Flows
        # Tier 1 (AgentCore)
        code_generator >> agentcore
        agentcore >> agentcore_lambda
        
        # Tier 2 (Personal AWS)
        code_generator >> docker_generator
        docker_generator >> ecr_repo
        convex_functions >> Edge(label="AssumeRole") >> cross_account_role
        cross_account_role >> cloudformation
        cloudformation >> [ecs_cluster, fargate_service, s3_bucket, cloudwatch]
        ecr_repo >> fargate_service
        fargate_service >> user_vpc
        
        # Code Generation Pipeline
        code_generator >> Edge(label="Python + Decorators") >> [
            docker_generator,
            meta_tooling,
            cloudformation
        ]

if __name__ == "__main__":
    generate_agent_builder_diagram()
    print("✅ Agent Builder Infrastructure diagram generated: agent_builder_infrastructure.png")