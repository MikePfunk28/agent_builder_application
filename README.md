# AI Agent Builder Application

A comprehensive platform for building, testing, and deploying AI agents with support for multiple LLM providers (AWS Bedrock, Ollama/LMStudio), tier-based access (Freemium, Personal), and MCP (Model Context Protocol) integration.

## Try it out

**Live**: [https://ai-forge.mikepfunk.com](https://ai-forge.mikepfunk.com)

## What It Does

AI Agent Builder lets you create, test, and deploy AI agents without writing code. You describe what you want your agent to do, the platform generates the agent code, and you can deploy it to AWS.

**Three ways to build agents**:
1. **Chat Builder** - Describe your agent in natural language, get asked clarifying questions, agent is generated automatically
2. **Manual Builder** - Select models, tools, and system prompts yourself with full control
3. **Visual Workflow Builder** - Drag-and-drop visual scripting for multi-step agent workflows

**What you get**:
- Complete Python agent code using Strands Agents SDK
- 60+ AI models to choose from (Claude, DeepSeek, Llama, Mistral, etc.)
- 50+ pre-built tools (web search, code execution, file operations, etc.)
- MCP server integration for extended capabilities
- One-click deployment to AWS AgentCore or downloadable agent ZIP
- Token-based billing with usage tracking

## How to Use It

### Getting Started (User)

1. Go to [ai-forge.mikepfunk.com](https://ai-forge.mikepfunk.com)
2. Sign in with GitHub, Google, or email/password
3. Choose your builder:
   - **Dashboard** - See your agents and usage
   - **AI Builder** - Chat-based agent creation
   - **Builder** - Manual agent configuration
   - **Visual Scripting** - Drag-and-drop workflows
   - **Chat** - Interleaved reasoning chat
   - **MCP Servers** - Manage MCP integrations

### Building an Agent

**Chat Builder (Recommended)**:
1. Click "AI Builder" in the nav
2. Describe what you want your agent to do
3. Answer the clarifying questions
4. Click "Generate Agent" when ready
5. Test your agent in the Test Chat

**Manual Builder**:
1. Click "Builder" in the nav
2. Enter agent name and description
3. Select an AI model (Claude Haiku 4.5 for fast, Sonnet 4.5 for smart, Opus 4.6 for best)
4. Write a system prompt
5. Select tools your agent needs
6. Click "Generate Code"

**Visual Workflow Builder**:
1. Click "Visual Scripting" in the nav
2. Choose a template or start blank
3. Add nodes: Prompt, LLM, Router, Output
4. Connect nodes to define the flow
5. Configure each node's settings
6. Execute the workflow

### Deployment Tiers

| Tier | Cost | Models | Limits |
|------|------|--------|--------|
| Freemium | $0 | Ollama/LMStudio (local) | 50 units/month |
| Personal | $5/mo + $0.05/unit | All Bedrock + local models | 100 units/month + overage |
| Enterprise | Coming soon | All + SSO (WorkOS) | Unlimited |

### Commands & Scripts

```bash
# Development
npm run dev              # Start frontend + backend
npm run dev:frontend     # Frontend only (port 4000)
npm run dev:backend      # Convex backend only
npm run build            # Production build

# Testing
npm run test             # Run all tests
npm run test:watch       # Watch mode
npm run test:skills      # Agent skills tests only

# Backend
npx convex dev           # Convex dev server
npx convex deploy --prod # Deploy to production
npx convex logs          # View backend logs

# MCP Diagrams
npm run setup-diagram-mcp    # Setup AWS diagram MCP server
npm run generate-diagram     # Generate architecture diagram
```

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
│  │  - Model Registry (60+ models: Bedrock + Ollama)         │   │
│  │  - Tool Registry (50+ Strands tools)                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ MCP & Strands Integration                                │   │
│  │  - MCP Servers (5 built-in + user-custom)                │   │
│  │    • bedrock-agentcore-mcp-server (Windows uv)           │   │
│  │    • document-fetcher-mcp-server                         │   │
│  │    • aws-diagram-mcp-server                              │   │
│  │    • ollama-mcp-server                                   │   │
│  │    • task-master-ai                                      │   │
│  │  - Strands Tools SDK (50+ tools)                         │   │
│  │  - Agent as MCP Tool                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Rate-Limited External APIs                               │   │
│  │  - Tavily Web Search (1000 req/month)                    │   │
│  │  - Mem0 Memory (1000 req/month)                          │   │
│  │  - AgentOps Tracing (planned — API key set, no code)     │   │
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
│  │  - Bedrock AgentCore (Test execution runtime)            │   │
│  │  - Bedrock Models (Claude, etc.)                         │   │
│  │  - Strands Agents SDK                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Agent Delivery (Personal Tier)                          │   │
│  │  - One-click deploy to AgentCore sandbox                │   │
│  │  - Downloadable ZIP (agent.py, Dockerfile, deploy.sh)   │   │
│  │  - CloudFormation templates for user AWS deployment     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Monitoring & Observability                               │   │
│  │  - CloudWatch Logs (AgentCore, Convex)                  │   │
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
- **Bedrock AgentCore**: Agent test execution & deployment runtime
- **Bedrock Models**: Claude, Titan, and other foundation models
- **Strands Agents**: SDK for agent creation and tool integration
- **MCP Integration**: 5 built-in MCP servers + user-custom

**AWS Services**:
- **Bedrock AgentCore**: Test sandbox (Direct Bedrock API → Lambda backup)
- **S3**: Long-term memory, deployment packages, artifacts
- **DynamoDB**: Memory indexing, semantic search
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
- **Model Selection**: Choose from 60+ AI models across AWS Bedrock and Ollama
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

#### Tier 1: Freemium ($0/month)
- **Models**: Ollama/LMStudio (user runs locally)
- **Testing**: Via AgentCore test runner (local Ollama/LMStudio models)
- **Limits**: 50 units/month, max 10 agents
- No AWS account required
- Cost-effective for experimentation

#### Tier 2: Personal ($5/month + $0.05/unit overage)
- **Models**: All Bedrock models + local models
- **Testing**: Via AgentCore (Direct Bedrock API → Lambda backup)
- **Deployment**: AgentCore sandbox or downloadable ZIP package
- **Limits**: 100 units/month + metered overage
- Full Stripe billing integration
- Token-based billing: `awsCost x 2 / $0.05 = units`

#### Tier 3: Enterprise (Coming Soon)
- SSO via WorkOS
- Multi-user support
- AWS Organizations integration
- Advanced monitoring & analytics
- SLA guarantees

### MCP Integration
- **5 Built-in MCP Servers**:
  - `bedrock-agentcore-mcp-server` — AgentCore testing (Windows uv)
  - `document-fetcher-mcp-server` — Document retrieval and processing
  - `aws-diagram-mcp-server` — Infrastructure diagram generation
  - `ollama-mcp-server` — Local model integration
  - `task-master-ai` — Task management
- **User-Custom Servers**: Users can add their own MCP servers via the UI
- **Tool Discovery**: Automatic tool detection from MCP servers
- **Agent as Tool**: Expose agents as MCP tools for agent-to-agent communication

### Rate-Limited External APIs
- **Tavily Web Search**: 1000 requests/month for comprehensive web search
- **Mem0 Memory**: 1000 requests/month for advanced memory operations
- **AgentOps Tracing**: Planned (API key configured, code integration pending)

### Chat Interfaces
- **ConversationChat**: General-purpose chat with conversation manager
- **InterleavedChat**: Agent building with interleaved reasoning (thinking blocks)
- **AgentBuilder Input**: Automated agent processing with Claude Haiku 4.5
- **AgentTester**: Testing built agents against AgentCore

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
│   ├── modelRegistry.ts          # 60+ AI models catalog
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

**GitHub**: https://{{convex-site-url}}.convex.site/api/auth/callback/github
**Google**: https://{{convex-site-url}}.convex.site/api/auth/callback/google
**Cognito**: https://{{convex-site-url}}.convex.site/api/auth/callback/cognito

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
- Agent testing and deployment uses AWS Bedrock AgentCore
- Agent delivery: one-click AgentCore deploy or downloadable ZIP package
- MCP integration enables agent-to-agent communication
- Meta-tooling allows agents to create their own tools
- Token-based billing with Stripe metered pricing
- Payment gating via bedrockGate.ts (subscription status, tier, limits)

## Security
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/13bcb475933b44fca1e7f27dcdbb9078)](https://app.codacy.com?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)