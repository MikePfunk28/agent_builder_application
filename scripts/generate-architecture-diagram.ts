/*
 * Generate Architecture Diagram
 *
 * This script uses the AWS Diagram MCP server to generate an architecture
 * diagram of the Agent Builder Application.
 *
 * Prerequisites:
 * - AWS Diagram MCP server must be configured (run setup-aws-diagram-mcp.ts first)
 * - You must be authenticated
 *
 * Usage:
 *   npm run generate-diagram
 *   or
 *   npx tsx scripts/generate-architecture-diagram.ts
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import process from "node:process";

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
      description: "Shared platform for free tier users",
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
      description: "Serverless agent runtime",
    },
  });

  // AWS Tier 2: User AWS Account (Personal)
  resources.push({
    type: "iam-role",
    name: "Cross-Account Deployment Role",
    properties: {
      assumeRolePolicy: "STS AssumeRole",
      description: "Enables deployment to user AWS accounts",
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
      description: "User-owned ECS cluster",
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

  resources.push({
    type: "cloudformation",
    name: "Infrastructure Stack",
    properties: {
      tier: "personal",
      resources: ["VPC", "ECS", "Fargate", "CloudWatch", "S3"],
    },
  });

  // AWS Tier 3: Enterprise (SSO)
  resources.push({
    type: "sso",
    name: "AWS SSO / Identity Center",
    properties: {
      tier: "enterprise",
      region: "us-east-1",
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
      purpose: "Architecture diagram generation",
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
 * Call the AWS Diagram MCP server to generate diagram
 */
async function generateDiagram(resources: AWSResource[], format: string = "mermaid"): Promise<string> {
  console.log("🎨 Generating architecture diagram...");
  console.log(`📊 Resources: ${resources.length}`);
  console.log(`📐 Format: ${format}\n`);

  return new Promise((resolve, reject) => {
    // Spawn the MCP server
    const mcp = spawn("npx", ["-y", "@strandsagents/aws-diagram-mcp"]);

    let output = "";
    let errorOutput = "";

    // Build the MCP request
    const request = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "generate_diagram",
        arguments: {
          resources: resources,
          format: format,
          title: "Agent Builder Application - Full Architecture",
          description: "Complete system architecture including Cloudflare frontend, Convex backend, AWS deployments (3 tiers), and OAuth providers",
        },
      },
    };

    mcp.stdout.on("data", (data: Buffer) => {
      output += data.toString();
    });

    mcp.stderr.on("data", (data: Buffer) => {
      errorOutput += data.toString();
    });

    mcp.on("close", (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`MCP server exited with code ${code}\n${errorOutput}`));
        return;
      }

      try {
        // Parse the MCP response
        const lines = output.split("\n").filter(line => line.trim());
        let diagramContent = "";

        for (const line of lines) {
          try {
            const response = JSON.parse(line);
            if (response.result && response.result.content) {
              diagramContent = response.result.content[0]?.text || "";
              break;
            }
          } catch (e) {
            // Skip non-JSON lines
          }
        }

        if (!diagramContent) {
          reject(new Error("No diagram content received from MCP server"));
          return;
        }

        resolve(diagramContent);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });

    // Send the request
    mcp.stdin.write(JSON.stringify(request) + "\n");
    mcp.stdin.end();
  });
}

/**
 * Main execution
 */
async function main() {
  console.log("🏗️  Agent Builder Application - Architecture Diagram Generator\n");
  console.log("═══════════════════════════════════════════════════════════════\n");

  try {
    // Build architecture resources
    console.log("📦 Building architecture resources...");
    const resources = buildApplicationArchitecture();
    console.log(`✅ Built ${resources.length} resources\n`);

    // Generate diagram
    const diagram = await generateDiagram(resources, "mermaid");

    // Save to file
    const outputPath = path.join(process.cwd(), "docs", "GENERATED_ARCHITECTURE.md");
    const content = `# Agent Builder Application - Generated Architecture Diagram

**Generated**: ${new Date().toISOString()}
**Tool**: AWS Diagram MCP Server (@strandsagents/aws-diagram-mcp)
**Resources**: ${resources.length}

## System Architecture

${diagram}

## Architecture Components

### Frontend
- **Cloudflare Pages**: React + Vite application
- **Custom Domain**: https://ai-forge.mikepfunk.com
- **Deployment**: https://633051e6.agent-builder-application.pages.dev

### Backend
- **Convex**: Serverless backend with real-time sync
- **URL**: https://resolute-kudu-325.convex.site

### Authentication
- **GitHub OAuth**: OAuth 2.0 authentication
- **Google OAuth**: OAuth 2.0 authentication
- **AWS Cognito**: Federated identity with STS AssumeRole

### Deployment Tiers

#### Tier 1: Freemium (Platform Fargate)
- Shared platform infrastructure
- 10 tests/month limit
- AWS Bedrock AgentCore runtime

#### Tier 2: Personal (User AWS Account)
- Cross-account deployment via STS AssumeRole
- User-owned VPC, ECS, Fargate
- CloudWatch logging and S3 storage

#### Tier 3: Enterprise (SSO)
- AWS SSO / Identity Center
- AWS Organizations
- Enhanced security with Secrets Manager

### MCP Integration
- **AWS Diagram MCP**: Architecture visualization
- **Bedrock AgentCore MCP**: Agent deployment and testing

---

**Resource Summary**:
${resources.map((r, i) => `${i + 1}. ${r.type}: ${r.name}`).join("\n")}
`;

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, content, "utf-8");

    console.log("\n✅ Diagram generated successfully!\n");
    console.log("📄 Saved to:", outputPath);
    console.log("\n🎉 Done!\n");

  } catch (error: any) {
    console.error("\n❌ Error generating diagram:", error.message);
    console.error("\nTroubleshooting:");
    console.error("1. Make sure the AWS Diagram MCP server is installed:");
    console.error("   npm install -g @strandsagents/aws-diagram-mcp");
    console.error("2. Or let npx download it automatically");
    console.error("3. Check that you have internet connection");
    console.error("4. Verify the MCP server is working: npx -y @strandsagents/aws-diagram-mcp\n");
    process.exit(1);
  }
}

void main();
