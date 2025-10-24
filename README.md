# AI Agent Builder Application

A comprehensive platform for building, testing, and deploying AI agents with support for multiple LLM providers (AWS Bedrock, Ollama), deployment tiers (AgentCore, Fargate), and MCP (Model Context Protocol) integration.

## Try it out:
https://ai-forge.mikepfunk.com


## ✅ Infrastructure Verified & Updated

**Three Chat System**:
- ✅ **Chat UI Panel** - Agent building with interleaved reasoning
- ✅ **Agent Builder Input** - Automated processing with Claude Haiku 4.5
- ✅ **Test Chat** - Testing built agents with conversation manager

**MCP Servers (11+ configured)**:
- ✅ **bedrock-agentcore-mcp-server** - Windows uv tool setup for AgentCore integration
- ✅ **document-fetcher-mcp-server** - Document retrieval and processing
- ✅ **aws-diagram-mcp-server** - Infrastructure diagram generation
- ✅ **Plus 8+ others** - Configured in mcpConfig.ts

**Rate-Limited External APIs**:
- ✅ **Tavily Web Search** - 1000 requests/month for web search
- ✅ **Mem0 Memory** - 1000 requests/month for memory operations
- ✅ **AgentOps Tracing** - 1000 requests/month for agent observability

**Model Registry (49 models)**:
- ✅ **AWS Bedrock** - Claude, Titan, and other foundation models
- ✅ **Ollama** - Local model execution (llama, mistral, etc.)

**Tool Registry (50+ Strands tools)**:
- ✅ **Pre-configured tools** - From toolRegistry.ts with auto-discovery

**DNS & Hosting**:
- ✅ **Cloudflare DNS** (NOT Route53) - manages all domain resolution
- ✅ **Cloudflare Pages** - frontend hosting at `ai-forge.mikepfunk.com`
- ✅ **Custom API Domain** - `api.mikepfunk.com` points to Convex (via Cloudflare DNS)

**Memory Architecture**:
- ✅ **STM (Short-Term)**: Convex tables (<8KB) for real-time access
- ✅ **LTM (Long-Term)**: S3 storage (>8KB) for persistence
- ✅ **DynamoDB**: Memory indexing for fast lookups and semantic search

**Authentication**:
- ✅ **Web Identity Federation**: STS AssumeRoleWithWebIdentity
- ✅ **NO static AWS keys**: All credentials are temporary via STS
- ✅ **Cognito + OAuth**: GitHub, Google integration

**Testing vs Deployment Separation**:
- ✅ **agentcoreSetup.ts** - Testing via MCP server
- ✅ **agentcoreDeployment.ts** - Deployment to AgentCore sandbox
- ✅ **awsDeployment.ts** - User AWS Fargate deployment

**Backend**:
- ✅ **Convex Serverless**: Primary database and real-time backend
- ✅ **Built-in Indexes**: Convex table indexes (NOT external database)
- ✅ **14+ Tables**: users, agents, deployments, agentMemories, etc.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│         Frontend - Cloudflare Pages (ai-forge.mikepfunk.com)    │
│                   Cloudflare CDN + DNS + DDoS + SSL              │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Chat Panel   │  │ Agent Builder│  │ Test Chat    │          │
│  │ - Interleaved│  │ - Walkthrough│  │ - Agent      │          │
│  │   Reasoning  │  │ - Automated  │  │   Testing    │          │
│  │              │  │   (Haiku 4.5)│  │ - Conv Mgr   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐                             │
│  │ Monitoring   │  │ Auditing     │                             │
│  │ - CloudWatch │  │ - Audit Logs │                             │
│  │ - X-Ray      │  │ - Events     │                             │
│  └──────────────┘  └──────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│           Authentication (Web Identity Federation)               │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ AWS Cognito User Pool                                    │   │
│  │  - GitHub OAuth → JWT ID Token                           │   │
│  │  - Google OAuth → JWT ID Token                           │   │
│  │  - STS AssumeRoleWithWebIdentity → Temp AWS Credentials │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│      Backend - Convex Serverless (resolute-kudu-325.convex)     │
│              Custom API Domain: api.mikepfunk.com                │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Core Services                                            │   │
│  │  - Real-time API (WebSocket subscriptions)              │   │
│  │  - Convex Functions (TypeScript-safe APIs)              │   │
│  │  - HTTP Routes (OAuth callbacks, MCP endpoints)         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Database (14+ Tables)                                    │   │
│  │  - users, agents, deployments                            │   │
│  │  - agentMemories (STM/LTM hybrid)                        │   │
│  │  - conversations, testExecutions                         │   │
│  │  - mcpServers, diagrams                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Memory Architecture                                      │   │
│  │  - STM: Convex storage (<8KB) → Real-time access        │   │
│  │  - LTM: S3 storage (>8KB) → Cost-effective              │   │
│  │  - DynamoDB: Memory indexing → Fast lookups             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Agent Management                                         │   │
│  │  - Agent Builder (Code Generation)                       │   │
│  │  - Validator (Schema & Syntax)                           │   │
│  │  - Deployment Router (Tier Selection)                    │   │
│  │  - Model Registry (49 models: Bedrock + Ollama)         │   │
│  │  - Tool Registry (50+ Strands tools)                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ MCP & Strands Integration                                │   │
│  │  - MCP Servers (11+ configured)                          │   │
│  │    • bedrock-agentcore-mcp-server (Windows uv)           │   │
│  │    • document-fetcher-mcp-server                         │   │
│  │    • aws-diagram-mcp-server                              │   │
│  │    • Plus 8+ others                                      │   │
│  │  - Strands Tools SDK (50+ tools)                         │   │
│  │  - Agent as MCP Tool                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Rate-Limited External APIs                               │   │
│  │  - Tavily Web Search (1000 req/month)                    │   │
│  │  - Mem0 Memory (1000 req/month)                          │   │
│  │  - AgentOps Tracing (1000 req/month)                     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              AWS Backend & AI Services (us-east-1)               │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Storage Layer                                            │   │
│  │  - S3: LTM (>8KB), Artifacts, Deployment Packages       │   │
│  │  - DynamoDB: Memory indexing & semantic search          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ AI Services                                              │   │
│  │  - Bedrock AgentCore (Tier 1 runtime)                   │   │
│  │  - Bedrock Models (Claude, etc.)                         │   │
│  │  - Strands Agents SDK                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Tier 2 - User AWS Account (ECS Fargate)                 │   │
│  │  - VPC with public/private subnets                       │   │
│  │  - Application Load Balancer                             │   │
│  │  - ECS Fargate Cluster                                   │   │
│  │  - ECR Container Registry                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Monitoring & Observability                               │   │
│  │  - CloudWatch Logs (Fargate, AgentCore, Convex)         │   │
│  │  - CloudWatch Metrics & Dashboards                       │   │
│  │  - AWS X-Ray (Distributed tracing)                       │   │
│  │  - OpenTelemetry (OTEL instrumentation)                  │   │
│  │  - Audit Logs (User actions, deployments)               │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Infrastructure Components

**Frontend**:
- **Hosting**: Cloudflare Pages (`ai-forge.mikepfunk.com`)
- **CDN**: Global edge network with HTTP/2, Brotli compression
- **DNS**: Cloudflare DNS (NOT Route53)
- **Security**: DDoS protection, automatic SSL/TLS certificates
- **Tech**: React 19, Vite, TypeScript, TailwindCSS

**Backend**:
- **Platform**: Convex serverless (`{{convex-cloud-url}}.convex.cloud`)
- **API Domain**: Custom domain `api.mikepfunk.com` (via Cloudflare DNS)
- **Database**: Convex with 14+ tables and built-in indexes
- **Real-time**: WebSocket subscriptions for live updates

**Authentication**:
- **Primary**: AWS Cognito User Pool (`us-east-1_{{hash}}`)
- **OAuth Providers**: GitHub, Google
- **Federation**: STS AssumeRoleWithWebIdentity for temporary AWS credentials
- **NO static AWS access keys** - all credentials are temporary

**Memory Architecture**:
- **STM (Short-Term Memory)**: Convex storage for recent data (<8KB)
- **LTM (Long-Term Memory)**: S3 storage for persistent data (>8KB)
- **Indexing**: DynamoDB for fast memory lookups and semantic search
- **Hybrid Strategy**: Automatic routing based on data size

**AI & Agents**:
- **Bedrock AgentCore**: Tier 1 freemium runtime (platform-managed)
- **Bedrock Models**: Claude, Titan, and other foundation models
- **Strands Agents**: SDK for agent creation and tool integration
- **MCP Integration**: 11+ MCP servers for extended capabilities

**AWS Services**:
- **S3**: Long-term memory, deployment packages, artifacts
- **DynamoDB**: Memory indexing, semantic search
- **ECS Fargate**: Tier 2 containerized agent execution
- **ECR**: Container registry for agent images
- **CloudWatch**: Logs and metrics for all services
- **X-Ray**: Distributed tracing and performance insights
- **Cognito**: User authentication and OAuth
- **STS**: Temporary credential generation

**Observability**:
- **OpenTelemetry (OTEL)**: Instrumentation for traces, metrics, and logs
- **AWS X-Ray**: Distributed tracing across AWS services
- **CloudWatch**: Centralized logging and metrics
- **Integration**: OTEL exports traces to X-Ray for end-to-end visibility

**DNS & Domains**:
- **Provider**: Cloudflare DNS (NOT AWS Route53)
- **Frontend**: `ai-forge.mikepfunk.com` → Cloudflare Pages
- **API**: `api.mikepfunk.com` → Convex backend
- **All DNS managed through Cloudflare**

## 🚀 Features

### Agent Creation
- **Model Selection**: Choose from 49 AI models across AWS Bedrock and Ollama
- **Tool Selection**: Browse 50+ pre-configured Strands tools
- **Custom System Prompts**: Define agent behavior and context
- **Code Generation**: One-click generation of complete agent packages
- **@agent Decorator**: Preprocessing and postprocessing hooks
- **@tool Decorator**: Create custom tools with automatic MCP integration

### Authentication
- **OAuth 2.0**: GitHub, Google, AWS Cognito
- **Password Authentication**: Email/password sign-up
- **Anonymous Access**: Guest mode for quick testing
- **Custom Profile Handlers**: Extended user data (GitHub username, Google locale)

### Deployment Tiers

#### Tier 1: AgentCore (Freemium + Testing)
- **Testing**: Via bedrock-agentcore-mcp-server (agentcoreSetup.ts)
- **Deployment**: AWS Bedrock AgentCore sandbox (agentcoreDeployment.ts)
- Bedrock models only
- Limited test executions (10/month for freemium)
- No AWS account required
- Cost-effective for experimentation
- Platform-managed runtime

#### Tier 2: Fargate (Personal)
- **Deployment**: User's AWS account via cross-account IAM role (awsDeployment.ts)
- Full Docker container support
- Ollama + Bedrock models
- Unlimited executions
- Cross-account IAM role setup with External ID
- VPC, ECS Fargate, ECR infrastructure

#### Tier 3: Enterprise (Future)
- Multi-user support
- AWS SSO + Organizations
- Advanced monitoring
- Custom integrations
- SLA guarantees

### MCP Integration
- **MCP Server Management**: Configure and manage 11+ MCP servers
- **bedrock-agentcore-mcp-server**: Windows uv tool setup for AgentCore testing
- **document-fetcher-mcp-server**: Document retrieval and processing
- **aws-diagram-mcp-server**: Infrastructure diagram generation
- **Tool Discovery**: Automatic tool detection from MCP servers
- **Agent as Tool**: Expose agents as MCP tools for agent-to-agent communication

### Rate-Limited External APIs
- **Tavily Web Search**: 1000 requests/month for comprehensive web search
- **Mem0 Memory**: 1000 requests/month for advanced memory operations
- **AgentOps Tracing**: 1000 requests/month for agent observability and debugging

### Three Chat System
- **Chat UI Panel**: Agent building process with interleaved reasoning
- **Agent Builder Input**: Automated agent processing with Claude Haiku 4.5
- **Test Chat**: Testing built agents with conversation manager

### Meta-Tooling
- **Dynamic Tool Creation**: Agents can create tools they need
- **@tool Decorator**: Automatic tool registration
- **Tool Persistence**: Save and reuse generated tools

## 📁 Project Structure

```
agent_builder_application/
├── src/                          # Frontend (React + Vite)
│   ├── components/               # UI components
│   ├── App.tsx                   # Main application
│   ├── SignInForm.tsx            # Authentication UI
│   └── main.tsx                  # Entry point
│
├── convex/                       # Backend (Convex)
│   ├── auth.ts                   # Authentication configuration
│   ├── auth.config.ts            # OAuth provider config
│   ├── schema.ts                 # Database schema
│   ├── agents.ts                 # Agent CRUD operations
│   ├── codeGenerator.ts          # Agent code generation
│   ├── modelRegistry.ts          # 49 AI models catalog
│   ├── toolRegistry.ts           # 50+ tools catalog
│   ├── mcpConfig.ts              # MCP server management
│   ├── mcpClient.ts              # MCP tool invocation
│   ├── awsDiagramGenerator.ts    # Architecture diagrams
│   ├── agentcoreDeployment.ts    # Tier 1 deployment
│   ├── deploymentRouter.ts       # Tier routing logic
│   ├── awsCrossAccount.ts        # Cross-account IAM
│   ├── testExecution.ts          # Agent testing
│   ├── queueProcessor.ts         # Test queue management
│   └── integration.test.ts       # Integration tests
│
├── cloudformation/               # AWS CloudFormation templates
│   ├── user-cross-account-role.yaml    # User IAM role
│   └── user-onboarding-template.yaml   # User setup
│
├── requirements.txt              # Python dependencies (for agents)
├── package.json                  # Node.js dependencies
├── vite.config.ts                # Vite configuration
└── README.md                     # This file
```

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+ and npm
- Convex account (free tier available)
- AWS account (for Tier 2 deployments)
- OAuth provider credentials (GitHub, Google, or Cognito)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd agent_builder_application
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up Convex**
```bash
npx convex dev
```

4. **Configure environment variables**

Create `.env.local`:
```bash
# Convex Configuration
VITE_CONVEX_URL=https://{{convex-cloud-url}}.convex.cloud
CONVEX_SITE_URL=https://{{convex-site-url}}.convex.site

# OAuth - GitHub
AUTH_GITHUB_ID=your_github_client_id
AUTH_GITHUB_SECRET=your_github_client_secret

# OAuth - Google
AUTH_GOOGLE_ID=your_google_client_id
AUTH_GOOGLE_SECRET=your_google_client_secret

# OAuth - Cognito (optional)
COGNITO_ISSUER_URL=your_cognito_issuer_url
COGNITO_CLIENT_ID=your_cognito_client_id
COGNITO_CLIENT_SECRET=your_cognito_client_secret
```

5. **Start development server**
```bash
npm run dev
```

Visit `http://localhost:5173` to see the application.

## 🧪 Testing

### Run Integration Tests
```bash
npm test
```

### Test Coverage
- OAuth authentication flows (GitHub, Google, Cognito)
- Agent creation and code generation
- MCP server integration
- AWS diagram generation
- AgentCore deployment
- Cross-account IAM role validation

## 🚢 Deployment

### Frontend (Cloudflare Pages)

1. **Connect to Cloudflare Pages**
   - Link your GitHub repository
   - Set build command: `npm run build`
   - Set output directory: `dist`

2. **Configure environment variables**
   ```
   VITE_CONVEX_URL=https://{{convex-cloud-url}}.convex.cloud
   ```

3. **Deploy**
   - Push to main branch
   - Cloudflare automatically builds and deploys

### Backend (Convex)

1. **Deploy to production**
```bash
npx convex deploy --prod
```

2. **Set production environment variables**
```bash
npx convex env set AUTH_GITHUB_ID "your_value"
npx convex env set AUTH_GITHUB_SECRET "your_value"
npx convex env set AUTH_GOOGLE_ID "your_value"
npx convex env set AUTH_GOOGLE_SECRET "your_value"
```

### OAuth Callback URLs

Configure these callback URLs in your OAuth providers:

**GitHub**: https://resolute-kudu-325.convex.site/api/auth/callback/github
**Google**: https://resolute-kudu-325.convex.site/api/auth/callback/google
**Cognito**: https://resolute-kudu-325.convex.site/api/auth/callback/cognito

## 🔐 Security

- OAuth 2.0 with PKCE (Proof Key for Code Exchange)
- Cross-account IAM roles with External ID
- No hardcoded credentials in code
- Environment variables for all secrets
- Session-based authentication
- Rate limiting per tier

## 📊 Monitoring & Observability

### Distributed Tracing
- **OpenTelemetry (OTEL)**: Auto-instrumentation for all agent code
  - Trace context propagation
  - Custom spans for agent operations
  - Export to AWS X-Ray and CloudWatch
- **AWS X-Ray**: End-to-end request tracing
  - Service maps showing dependencies
  - Latency analysis per operation
  - Error and fault detection

### Logging
- **Convex Logs**: `npx convex logs` for backend function execution
- **CloudWatch Logs**: Centralized logs for AWS services
  - Fargate container logs
  - AgentCore runtime logs
  - Lambda function logs
- **Structured Logging**: JSON format with trace IDs for correlation

### Metrics & Dashboards
- **CloudWatch Metrics**: System and custom metrics
- **CloudWatch Dashboards**: Real-time monitoring
- **Error Tracking**: `errorLogs` table in Convex
- **Audit Trail**: `auditLogs` table for compliance

### Observability Stack
```
Agent Code (Python)
    ↓ (OpenTelemetry SDK)
OTEL Traces + Metrics
    ↓ (OTLP Exporter)
AWS X-Ray → Service Map
    ↓
CloudWatch Logs + Metrics
    ↓
Monitoring Panel (Frontend)
```

## 🤝 Contributing

This is a private project. For questions or issues, contact the development team.

## 📄 License

Proprietary - All rights reserved

## 🔗 Links

- **Production**: https://ai-forge.mikepfunk.com
- **Strands-Agents**: https://strandsagents.com/latest/
- **Convex Docs**: https://docs.convex.dev
- **Convex Auth**: https://auth.convex.dev
- **Bedrock Agent-Core**: https://docs.aws.amazon.com/bedrock-agentcore/

## 📝 Notes

- This project uses Convex for backend and database
- Frontend is deployed on Cloudflare Pages
- Agent deployments use AWS (AgentCore or Fargate)
- MCP integration enables agent-to-agent communication
- Meta-tooling allows agents to create their own tools
