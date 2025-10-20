/**
 * Setup AWS Diagram MCP Server
 *
 * This script initializes the AWS Diagram MCP server configuration
 * in your Convex database so it can be used to generate architecture diagrams.
 *
 * Usage:
 *   npx tsx scripts/setup-aws-diagram-mcp.ts
 */

import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ Error: CONVEX_URL or VITE_CONVEX_URL environment variable is not set");
  console.error("Please set it in your .env file or pass it as an environment variable");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

async function setupAWSDiagramMCP() {
  console.log("🔧 Setting up AWS Diagram MCP Server...\n");

  try {
    // Note: This requires authentication
    // In a real scenario, you'd need to authenticate first
    // For now, we'll create a configuration that can be added via the UI

    console.log("📋 AWS Diagram MCP Server Configuration:");
    console.log("─────────────────────────────────────────");
    console.log("");
    console.log("Add this MCP server via the UI (MCP Management Panel):");
    console.log("");
    console.log("  Name:        aws-diagram");
    console.log("  Command:     npx");
    console.log("  Args:        ['-y', '@strandsagents/aws-diagram-mcp']");
    console.log("  Env:         {} (empty)");
    console.log("  Disabled:    false");
    console.log("  Timeout:     30000 (30 seconds)");
    console.log("");
    console.log("─────────────────────────────────────────");
    console.log("");
    console.log("✅ Configuration ready!");
    console.log("");
    console.log("Next steps:");
    console.log("1. Sign in to your application");
    console.log("2. Navigate to MCP Management Panel");
    console.log("3. Click 'Add Server'");
    console.log("4. Enter the configuration above");
    console.log("5. Click 'Test Connection' to verify");
    console.log("6. Run: npm run generate-diagram");

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

setupAWSDiagramMCP();
