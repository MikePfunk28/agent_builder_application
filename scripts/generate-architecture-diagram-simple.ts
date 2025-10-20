/**
 * Generate Architecture Diagram (Simple Version)
 *
 * This version generates a Mermaid diagram directly without calling external MCP servers.
 * This works better on Windows and doesn't require npx to be in PATH.
 */

import * as fs from "fs";
import * as path from "path";

interface AWSResource {
  type: string;
  name: string;
  id?: string;
  properties?: Record<string, any>;
}

/**
 * Build our application architecture resources
 */
function buildApplicationArchitecture(): AWSResource[] {
  const resources: AWSResource[] = [];

  // Frontend - Cloudflare Pages
  resources.push({
    type: "cloudflare-pages",
    name: "Agent Builder Frontend",
    properties: {
      url: "https://633051e6.agent-builder-application.pages.dev",
      customDomain: "https://ai-forge.mikepfunk.com",
      framework: "React + Vite",
    },
  });

  // Backend - Convex
  resources.push({
    type: "convex-backend",
    name: "Convex Backend",
    properties: {
      url: "https://resolute-kudu-325.convex.site",
      features: ["Authentication", "Real-time Sync", "Serverless Functions"],
    },
  });

  // Authentication Services
  resources.push({
    type: "auth-provider",
    name: "GitHub OAuth",
    properties: {
      provider: "github",
      callbackUrl: "https://resolute-kudu-325.convex.site/api/auth/callback/github",
    },
  });

  resources.push({
    type: "auth-provider",
    name: "Google OAuth",
    properties: {
      provider: "google",
      callbackUrl: "https://resolute-kudu-325.convex.site/api/auth/callback/google",
    },
  });

  resources.push({
    type: "cognito-user-pool",
    name: "AWS Cognito Auth",
    id: "us-east-1_hMFTc7CNL",
    properties: {
      region: "us-east-1",
      clientId: "fk09hmkpbk7sral3cj9ofh5vc",
      callbackUrl: "https://resolute-kudu-325.convex.site/api/auth/callback/cognito",
    },
  });

  // AWS Tier 1: Platform Fargate (Freemium)
  resources.push({
    type: "ecs-cluster",
    name: "Platform ECS Cluster",
    properties: {
      region: "us-east-1",
      tier: "freemium",
    },
  });

  resources.push({
    type: "ecs-fargate",
    name: "Agent Runtime (Tier 1)",
    properties: {
      region: "us-east-1",
      cpu: "256",
      memory: "512",
      tier: "freemium",
    },
  });

  resources.push({
    type: "ecr",
    name: "Platform ECR Repository",
    properties: {
      region: "us-east-1",
      tier: "freemium",
    },
  });

  resources.push({
    type: "bedrock-agentcore",
    name: "AWS Bedrock AgentCore",
    properties: {
      region: "us-east-1",
      tier: "freemium",
    },
  });

  // AWS Tier 2: User AWS Account (Personal)
  resources.push({
    type: "iam-role",
    name: "Cross-Account Role",
    properties: {
      assumeRolePolicy: "STS AssumeRole",
    },
  });

  resources.push({
    type: "vpc",
    name: "User VPC (Tier 2)",
    properties: {
      cidr: "10.0.0.0/16",
      tier: "personal",
    },
  });

  resources.push({
    type: "ecs-cluster",
    name: "User ECS Cluster",
    properties: {
      tier: "personal",
    },
  });

  resources.push({
    type: "ecs-fargate",
    name: "Agent Runtime (Tier 2)",
    properties: {
      cpu: "512",
      memory: "1024",
      tier: "personal",
    },
  });

  resources.push({
    type: "cloudwatch-logs",
    name: "Agent Logs",
    properties: {
      retentionDays: 30,
      tier: "personal",
    },
  });

  resources.push({
    type: "s3",
    name: "Deployment Artifacts",
    properties: {
      tier: "personal",
      encryption: "AES256",
    },
  });

  // AWS Tier 3: Enterprise (SSO)
  resources.push({
    type: "sso",
    name: "AWS SSO",
    properties: {
      tier: "enterprise",
    },
  });

  resources.push({
    type: "organizations",
    name: "AWS Organizations",
    properties: {
      tier: "enterprise",
    },
  });

  resources.push({
    type: "secrets-manager",
    name: "Enterprise Secrets",
    properties: {
      tier: "enterprise",
    },
  });

  // MCP Integration
  resources.push({
    type: "mcp-server",
    name: "AWS Diagram MCP",
    properties: {
      command: "npx",
      args: ["-y", "@strandsagents/aws-diagram-mcp"],
    },
  });

  resources.push({
    type: "mcp-server",
    name: "Bedrock AgentCore MCP",
    properties: {
      purpose: "Agent deployment and testing",
    },
  });

  return resources;
}

/**
 * Generate Mermaid diagram directly
 */
function generateMermaidDiagram(resources: AWSResource[]): string {
  return `\`\`\`mermaid
graph TB
    subgraph "Frontend Layer"
        CloudflarePages["Cloudflare Pages<br/>React + Vite<br/>ai-forge.mikepfunk.com"]
    end

    subgraph "Backend Layer - Convex"
        ConvexBackend["Convex Backend<br/>resolute-kudu-325.convex.site"]
        ConvexAuth["Convex Auth"]
        CodeGen["Code Generator"]
        PackageGen["Package Generator<br/>4-file bundle"]
        DeployRouter["Deployment Router"]
    end

    subgraph "Authentication Providers"
        GitHub["GitHub OAuth"]
        Google["Google OAuth"]
        Cognito["AWS Cognito<br/>Federated Identity<br/>us-east-1_hMFTc7CNL"]
    end

    subgraph "AWS Tier 1: Freemium"
        Tier1Cluster["Platform ECS Cluster"]
        Tier1Fargate["Fargate Tasks<br/>256 CPU / 512 MB"]
        Tier1ECR["Platform ECR"]
        AgentCore["Bedrock AgentCore<br/>Serverless Runtime"]
    end

    subgraph "AWS Tier 2: Personal"
        STSRole["STS AssumeRole<br/>Cross-Account"]
        UserVPC["User VPC<br/>10.0.0.0/16"]
        UserCluster["User ECS Cluster"]
        UserFargate["Fargate Tasks<br/>512 CPU / 1024 MB"]
        UserLogs["CloudWatch Logs<br/>30-day retention"]
        UserS3["S3 Storage<br/>Encrypted"]
    end

    subgraph "AWS Tier 3: Enterprise"
        SSO["AWS SSO /<br/>Identity Center"]
        Orgs["AWS Organizations"]
        Secrets["Secrets Manager"]
    end

    subgraph "MCP Integration"
        DiagramMCP["AWS Diagram MCP<br/>Architecture Visualization"]
        AgentCoreMCP["Bedrock AgentCore MCP<br/>Agent Deployment"]
    end

    %% Frontend connections
    CloudflarePages --> ConvexBackend

    %% Backend internal connections
    ConvexBackend --> ConvexAuth
    ConvexBackend --> CodeGen
    ConvexBackend --> PackageGen
    ConvexBackend --> DeployRouter

    %% Authentication
    ConvexAuth --> GitHub
    ConvexAuth --> Google
    ConvexAuth --> Cognito

    %% Deployment routing
    DeployRouter --> |Tier 1<br/>Freemium| Tier1Cluster
    DeployRouter --> |Tier 2<br/>Personal| STSRole
    DeployRouter --> |Tier 3<br/>Enterprise| SSO

    %% Tier 1 flow
    Tier1Cluster --> Tier1Fargate
    Tier1ECR --> Tier1Fargate
    Tier1Fargate --> AgentCore

    %% Tier 2 flow
    STSRole --> UserVPC
    UserVPC --> UserCluster
    UserCluster --> UserFargate
    UserFargate --> UserLogs
    UserFargate --> UserS3

    %% Tier 3 flow
    SSO --> Orgs
    Orgs --> Secrets

    %% MCP connections
    ConvexBackend --> DiagramMCP
    ConvexBackend --> AgentCoreMCP

    %% Styling
    style CloudflarePages fill:#f96
    style ConvexBackend fill:#4a9eff
    style ConvexAuth fill:#4a9eff
    style Tier1Fargate fill:#ff9900
    style UserFargate fill:#ff9900
    style AgentCore fill:#00d4aa
    style STSRole fill:#ff6b6b
    style Cognito fill:#ff6b6b
\`\`\``;
}

/**
 * Main execution
 */
function main() {
  console.log("🏗️  Agent Builder Application - Architecture Diagram Generator\n");
  console.log("═══════════════════════════════════════════════════════════════\n");

  try {
    // Build architecture resources
    console.log("📦 Building architecture resources...");
    const resources = buildApplicationArchitecture();
    console.log(`✅ Built ${resources.length} resources\n`);

    // Generate diagram
    console.log("🎨 Generating Mermaid diagram...");
    const diagram = generateMermaidDiagram(resources);

    // Save to file
    const outputPath = path.join(process.cwd(), "docs", "GENERATED_ARCHITECTURE.md");
    const content = `# Agent Builder Application - Generated Architecture Diagram

**Generated**: ${new Date().toISOString()}
**Resources**: ${resources.length}

## System Architecture

${diagram}

## Architecture Overview

### Frontend
- **Platform**: Cloudflare Pages
- **Framework**: React + Vite + TypeScript
- **Production URL**: https://ai-forge.mikepfunk.com
- **Deployment URL**: https://633051e6.agent-builder-application.pages.dev

### Backend
- **Platform**: Convex (Serverless)
- **URL**: https://resolute-kudu-325.convex.site
- **Features**:
  - Real-time data synchronization
  - Serverless functions
  - Built-in authentication
  - Code generation pipeline
  - Deployment routing

### Authentication
1. **GitHub OAuth** - GitHub authentication
2. **Google OAuth** - Google authentication
3. **AWS Cognito** - Federated identity with STS AssumeRole
   - User Pool: us-east-1_hMFTc7CNL
   - Client ID: fk09hmkpbk7sral3cj9ofh5vc

### Deployment Tiers

#### Tier 1: Freemium (Platform Fargate)
- **Target**: Free tier users
- **Limit**: 10 tests/month
- **Infrastructure**:
  - Platform-managed ECS cluster
  - Fargate tasks (256 CPU, 512 MB memory)
  - Shared ECR repository
  - AWS Bedrock AgentCore runtime

#### Tier 2: Personal (User AWS Account)
- **Target**: Personal tier users
- **Features**:
  - Cross-account deployment via STS AssumeRole
  - User-owned VPC (10.0.0.0/16)
  - User ECS cluster
  - Fargate tasks (512 CPU, 1024 MB memory)
  - CloudWatch Logs (30-day retention)
  - S3 storage (encrypted)

#### Tier 3: Enterprise (SSO)
- **Target**: Enterprise customers
- **Features**:
  - AWS SSO / Identity Center integration
  - AWS Organizations management
  - Secrets Manager for sensitive data
  - Enhanced security and compliance

### MCP Integration
- **AWS Diagram MCP**: Architecture visualization tool
- **Bedrock AgentCore MCP**: Agent deployment and testing

## Resource List

${resources.map((r, i) => `${i + 1}. **${r.type}**: ${r.name}${r.id ? ` (${r.id})` : ''}`).join('\n')}

## Key Features

### 4-File Deployment Bundle
Every agent deployment generates:
1. **agent.py** - Agent code with @agent decorator
2. **mcp.json** - MCP server configuration
3. **Dockerfile** - Container configuration
4. **cloudformation.yaml** - AWS infrastructure template

### Security
- ✅ Proper access control using Convex user document IDs
- ✅ STS temporary credentials for cross-account deployment
- ✅ External ID validation for AssumeRole
- ✅ Encrypted S3 storage
- ✅ Secrets Manager for sensitive data

### Agent Capabilities
- Preprocessing and postprocessing hooks
- MCP tool integration
- Meta-tooling for dynamic tool creation
- Memory and interleaved reasoning
- AWS Bedrock AgentCore runtime

---

**Note**: This diagram was generated using a simplified Mermaid generator.
For deployment-specific diagrams, use the built-in \`awsDiagramGenerator\` module.
`;

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, content, "utf-8");

    console.log("\n✅ Diagram generated successfully!\n");
    console.log("📄 Saved to:", outputPath);
    console.log("\n🎉 Done!\n");
    console.log("View the diagram:");
    console.log("  - Open in VS Code with Mermaid preview extension");
    console.log("  - Push to GitHub (renders automatically)");
    console.log("  - Copy to https://mermaid.live\n");

  } catch (error: any) {
    console.error("\n❌ Error generating diagram:", error.message);
    process.exit(1);
  }
}

main();
