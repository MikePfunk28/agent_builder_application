# AI Agent Builder Application

A comprehensive platform for building, testing, and deploying AI agents with support for multiple LLM providers (AWS Bedrock, Ollama), deployment tiers (AgentCore, Fargate), and MCP (Model Context Protocol) integration.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                       │
│                  Deployed on Cloudflare Pages                    │
│                https://ai-forge.mikepfunk.com                    │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Auth UI      │  │ Agent Builder│  │ MCP Panel    │          │
│  │ - GitHub     │  │ - Model      │  │ - Server     │          │
│  │ - Google     │  │   Selection  │  │   Config     │          │
│  │ - Cognito    │  │ - Tool       │  │ - Tool       │          │
│  │ - Password   │  │   Selection  │  │   Testing    │          │
│  │ - Anonymous  │  │ - Code Gen   │  │ - Diagram    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              Convex Backend (Database + Functions)               │
│                https://resolute-kudu-325.convex.cloud            │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Authentication (Convex Auth)                             │   │
│  │  - OAuth 2.0 (GitHub, Google, AWS Cognito)              │   │
│  │  - Password Authentication                               │   │
│  │  - Anonymous Guest Access                                │   │
│  │  - Custom Profile Handlers                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Agent Management                                         │   │
│  │  - Agent CRUD Operations                                 │   │
│  │  - Code Generation (Python + @agent/@tool decorators)   │   │
│  │  - Model Registry (49 models: Bedrock + Ollama)         │   │
│  │  - Tool Registry (50+ Strands tools)                    │   │
│  │  - Meta-tooling (Dynamic tool creation)                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ MCP Integration                                          │   │
│  │  - MCP Server Configuration                              │   │
│  │  - MCP Client (Tool Invocation)                          │   │
│  │  - AWS Diagram Generator                                 │   │
│  │  - Agent as MCP Tool                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Deployment Management                                    │   │
│  │  - Tier 1: AgentCore (Freemium)                         │   │
│  │  - Tier 2: Fargate (Personal - User AWS Account)        │   │
│  │  - Tier 3: Enterprise (Multi-user, Advanced)            │   │
│  │  - Cross-Account IAM Role Management                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              External Services & Providers                       │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐              │
│  │ GitHub   │  │ Google   │  │ AWS Cognito      │              │
│  │ OAuth    │  │ OAuth    │  │ (User Pool)      │              │
│  └──────────┘  └──────────┘  └──────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              User AWS Accounts (Cross-Account)                   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Cross-Account IAM Role (with External ID)                │   │
│  │  - Trust Policy (Application AWS Account)                │   │
│  │  - Permissions:                                           │   │
│  │    • ECS/Fargate (Agent execution)                       │   │
│  │    • ECR (Container registry)                            │   │
│  │    • S3 (Deployment packages)                            │   │
│  │    • Bedrock AgentCore (Managed runtime)                 │   │
│  │    • CloudWatch Logs (Monitoring)                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Deployment Environments                                  │   │
│  │                                                           │   │
│  │  Tier 1 (AgentCore):                                     │   │
│  │  ┌────────────────────────────────────────┐             │   │
│  │  │ AWS Bedrock AgentCore Sandbox          │             │   │
│  │  │  - Managed Python runtime              │             │   │
│  │  │  - Bedrock models only                 │             │   │
│  │  │  - Limited execution time              │             │   │
│  │  │  - Cost-effective for freemium         │             │   │
│  │  └────────────────────────────────────────┘             │   │
│  │                                                           │   │
│  │  Tier 2 (Fargate):                                       │   │
│  │  ┌────────────────────────────────────────┐             │   │
│  │  │ ECS Fargate Container                  │             │   │
│  │  │  - Full Docker support                 │             │   │
│  │  │  - Ollama + Bedrock models             │             │   │
│  │  │  - Custom dependencies                 │             │   │
│  │  │  - Production-ready                    │             │   │
│  │  └────────────────────────────────────────┘             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

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

#### Tier 1: AgentCore (Freemium)
- AWS Bedrock AgentCore managed runtime
- Bedrock models only
- Limited test executions per month
- No AWS account required
- Cost-effective for experimentation

#### Tier 2: Fargate (Personal)
- Deploy to your own AWS account
- Full Docker container support
- Ollama + Bedrock models
- Unlimited executions
- Cross-account IAM role setup

#### Tier 3: Enterprise (Future)
- Multi-user support
- Advanced monitoring
- Custom integrations
- SLA guarantees

### MCP Integration
- **MCP Server Management**: Configure and manage MCP servers
- **Tool Discovery**: Automatic tool detection from MCP servers
- **AWS Diagram Generator**: Visualize deployment architecture
- **Agent as Tool**: Expose agents as MCP tools for agent-to-agent communication

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
VITE_CONVEX_URL=https://resolute-kudu-325.convex.cloud
CONVEX_SITE_URL=https://resolute-kudu-325.convex.site

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
   VITE_CONVEX_URL=https://resolute-kudu-325.convex.cloud
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

## 📊 Monitoring

- Convex function logs: `npx convex logs`
- CloudWatch Logs (for AWS deployments)
- Error logging in `errorLogs` table
- Audit trail in `auditLogs` table

## 🤝 Contributing

This is a private project. For questions or issues, contact the development team.

## 📄 License

Proprietary - All rights reserved

## 🔗 Links

- **Production**: https://ai-forge.mikepfunk.com
- **Convex Dashboard**: https://dashboard.convex.dev/d/resolute-kudu-325
- **Convex Docs**: https://docs.convex.dev
- **Convex Auth**: https://auth.convex.dev

## 📝 Notes

- This project uses Convex for backend and database
- Frontend is deployed on Cloudflare Pages
- Agent deployments use AWS (AgentCore or Fargate)
- MCP integration enables agent-to-agent communication
- Meta-tooling allows agents to create their own tools
