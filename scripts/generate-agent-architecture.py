#!/usr/bin/env python3
"""
Generate Agent Builder Architecture Diagram

This script uses the Python diagrams library to generate a visual architecture
diagram showing the complete agent deployment flow across all three tiers.

Usage:
    python scripts/generate-agent-architecture.py

Output:
    generated-diagrams/agent_builder_architecture.png
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.aws.compute import ECS, Fargate, Lambda
from diagrams.aws.network import VPC
from diagrams.aws.database import Dynamodb
from diagrams.aws.storage import S3
from diagrams.aws.security import IAM, Cognito
from diagrams.aws.management import Cloudformation, Cloudwatch
from diagrams.aws.ml import Bedrock
from diagrams.onprem.client import User, Client
from diagrams.onprem.vcs import Github


def generate_architecture():
    """Generate the complete Agent Builder architecture diagram"""

    with Diagram(
        "Agent Builder - Multi-Tier Deployment Architecture",
        show=False,
        direction="TB",
        filename="generated-diagrams/agent_builder_architecture",
        outformat="png"
    ):
        # Users
        user = User("Developer")

        # Frontend
        with Cluster("Frontend (Cloudflare Pages)"):
            frontend = Client("React + Vite\nai-forge.mikepfunk.com")

        # Backend
        with Cluster("Backend (Convex)"):
            convex = Lambda("Convex Functions\nresolute-kudu-325")
            convex_db = Dynamodb("Convex DB")
            _ = convex >> convex_db

        # Authentication
        with Cluster("Authentication"):
            github_oauth = Github("GitHub OAuth")
            google_oauth = Client("Google OAuth")
            cognito = Cognito("AWS Cognito")

            auth_group = [github_oauth, google_oauth, cognito]

        # Tier 1: Freemium (Platform Fargate)
        with Cluster("Tier 1: Freemium (Platform AWS Account)"):
            with Cluster("Shared Platform"):
                platform_ecs = ECS("Platform ECS Cluster")
                platform_fargate = Fargate("Agent Runtime\n256 CPU / 512 MB")
                platform_bedrock = Bedrock("Bedrock AgentCore\nServerless Runtime")

                _ = platform_ecs >> platform_fargate

            tier1_limit = Lambda("10 tests/month limit")

        # Tier 2: Personal (User AWS Account)
        with Cluster("Tier 2: Personal (User AWS Account)"):
            cross_account_role = IAM("Cross-Account\nDeployment Role")

            with Cluster("User VPC"):
                user_vpc = VPC("10.0.0.0/16")
                user_ecs = ECS("User ECS Cluster")
                user_fargate = Fargate("Agent Runtime\n512 CPU / 1024 MB")
                user_logs = Cloudwatch("CloudWatch Logs")
                user_s3 = S3("Deployment Artifacts")

                _ = user_ecs >> user_fargate
                _ = user_fargate >> user_logs

            user_cfn = Cloudformation("Infrastructure Stack")

        # Tier 3: Enterprise (SSO)
        with Cluster("Tier 3: Enterprise (AWS Organizations)"):
            sso = IAM("AWS SSO /\nIdentity Center")
            org = IAM("AWS Organizations")
            secrets = IAM("Secrets Manager")

        # User flow
        _ = user >> frontend
        _ = frontend >> convex

        # Authentication flow
        _ = frontend >> Edge(label="OAuth") >> auth_group
        _ = auth_group >> convex

        # Tier 1 deployment
        _ = convex >> Edge(label="Deploy (Freemium)") >> platform_ecs
        _ = convex >> Edge(label="Deploy (Freemium)") >> platform_bedrock
        _ = platform_ecs >> tier1_limit

        # Tier 2 deployment
        _ = convex >> Edge(label="Deploy (Personal)") >> cross_account_role
        _ = cross_account_role >> user_cfn
        _ = user_cfn >> user_vpc
        _ = user_vpc >> user_ecs
        _ = user_ecs >> user_s3

        # Tier 3 deployment
        _ = convex >> Edge(label="Deploy (Enterprise)") >> sso
        _ = sso >> org
        _ = org >> secrets


if __name__ == "__main__":
    print("🎨 Generating Agent Builder Architecture Diagram...")
    generate_architecture()
    print("✅ Diagram generated: generated-diagrams/agent_builder_architecture.png")
