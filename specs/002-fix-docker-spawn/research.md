# Research & Technology Decisions

**Feature**: Containerized Agent Testing System
**Date**: 2025-10-14
**Status**: Phase 0 Complete

## Executive Summary

This document resolves all technical unknowns from the implementation plan and justifies technology choices for the containerized agent testing system. All decisions prioritize rapid hackathon delivery, pay-per-use pricing for unpredictable load, and compatibility with the existing Convex + React architecture.

---

## Decision 1: Container Execution Service

**Decision**: AWS ECS Fargate with Fargate Spot pricing

**Rationale**:
- **Fast cold starts**: Fargate tasks start in 20-30 seconds vs Lambda containers (10s limit) or Batch (minutes)
- **Timeout support**: 10-minute test timeout requirement → Fargate supports unlimited runtime, Lambda max 15 minutes
- **Pay-per-use**: Billed per-second, ideal for unpredictable hackathon load (~100 tests/day)
- **No infrastructure management**: Serverless like Lambda, but for long-running containers
- **Spot pricing**: 70% cost reduction for non-time-critical tests (acceptable for hackathon demo)

**Alternatives Considered**:

| Service | Why Rejected |
|---------|--------------|
| **Lambda Containers** | 15-minute max timeout insufficient for complex agent tests; 10GB max memory may limit agent workloads; cold start ~10s but limited customization |
| **ECS EC2** | Requires managing EC2 instances and auto-scaling; overengineered for hackathon; fixed costs even when idle |
| **AWS Batch** | Cold start too slow (2-5 minutes to provision compute); optimized for batch jobs, not interactive testing |
| **Fargate without Spot** | 3x more expensive; Spot acceptable for prototype (test retry on interruption) |

**Implementation Details**:
- Use `@aws-sdk/client-ecs` v3 for task orchestration from Convex actions
- Task definition: 2 vCPU, 4GB memory (configurable per agent complexity)
- Network mode: `awsvpc` with NAT gateway for model provider API access
- Spot capacity provider for cost savings with on-demand fallback
- Task timeout: 10 minutes enforced, 30-second graceful shutdown

**Cost Estimate** (Fargate Spot):
- ~$0.012 per test (4GB memory, 2 vCPU, 3-minute average runtime)
- 100 tests/day = $1.20/day = $36/month during hackathon

---

## Decision 2: Container Security Patterns

**Decision**: Multi-layer security with resource limits, network isolation, and secrets management

**Security Checklist**:

1. **Resource Limits** (prevent DoS):
   - CPU: 2 vCPU max (Fargate task limit)
   - Memory: 4GB max with OOM kill
   - Network egress: Rate-limited via security group rules
   - Disk: 20GB ephemeral storage max (Fargate default)
   - Timeout: 10-minute hard limit

2. **Network Isolation**:
   - Private subnet with NAT gateway (no direct internet access)
   - Security group: Allow only HTTPS (443) egress to model provider IPs
   - Block SMTP, SSH, and other services
   - VPC flow logs enabled for audit

3. **Secrets Management**:
   - Store model provider credentials in AWS Secrets Manager
   - Inject via ECS task environment variables (encrypted in transit)
   - Never log credentials or include in deployment packages
   - Rotate secrets monthly

4. **Code Execution Safety**:
   - Read-only root filesystem (except /tmp and /app/output)
   - Non-root user (`USER appuser` in Dockerfile)
   - No privileged mode or host network access
   - Python sandbox: No `os.system()`, `subprocess` disabled via import hooks

5. **Input Validation**:
   - Sanitize agent code for malicious imports (e.g., `__import__('os').system('rm -rf /')`)
   - Validate requirements.txt package names against PyPI whitelist
   - Reject Dockerfiles with `RUN curl|wget|nc` or privilege escalation
   - Max file sizes: agent.py <100KB, requirements.txt <10KB, Dockerfile <5KB

**Audit & Monitoring**:
- CloudWatch Logs for all container stdout/stderr
- CloudTrail for ECS API calls
- Convex audit log for test submissions
- Alert on repeated test failures (potential abuse)

**Compliance**: Acceptable for hackathon/prototype; production would require pen testing and security review.

---

## Decision 3: Real-Time Log Streaming

**Decision**: CloudWatch Logs → Convex polling → Convex subscriptions → React UI

**Architecture**:

```
ECS Task → CloudWatch Logs Stream
              ↓ (poll every 2s)
        Convex Action (pollLogs)
              ↓ (update DB)
        Convex Table (testExecutions)
              ↓ (reactive subscription)
        React Component (useQuery)
```

**Rationale**:
- **CloudWatch Logs**: Native ECS integration, automatic log collection
- **Convex polling**: Action polls CloudWatch every 2 seconds while task running
- **Convex subscriptions**: Built-in reactive queries eliminate WebSocket boilerplate
- **No external WebSocket**: Convex's real-time subscriptions simpler than managing WS connections

**Alternatives Considered**:

| Approach | Why Rejected |
|----------|--------------|
| **CloudWatch Logs Insights API** | 1-2 minute latency, not real-time enough |
| **Kinesis Data Streams** | Overengineered; adds $0.015/hour shard cost |
| **WebSocket from Fargate** | Requires managing WS server in container; complicates architecture |
| **SSE from Convex HTTP** | Convex subscriptions already provide better DX |

**Implementation Details**:
- CloudWatch log group: `/ecs/agent-tests/{testId}`
- Convex action `pollTestLogs(testId)` runs every 2s via `setInterval` in background
- Logs written to `testExecutions` table field `logs: v.array(v.string())`
- React: `const { logs } = useQuery(api.testExecution.getTestById, { testId })`
- Auto-scroll to bottom when new log lines append

**Latency**: <2 seconds from container stdout to UI display (acceptable per success criteria)

---

## Decision 4: Deployment Package Format

**Decision**: ZIP archive with standardized structure + AWS CDK templates

**Package Contents**:

```
agent-deployment-{agentId}-{timestamp}.zip
├── agent.py                  # Generated agent code
├── requirements.txt          # Python dependencies
├── Dockerfile                # Container definition
├── README.md                 # Deployment instructions
├── .env.example              # Required environment variables
├── cdk/
│   ├── app.py                # AWS CDK app (Python)
│   ├── stack.py              # ECS service stack definition
│   ├── requirements.txt      # CDK dependencies
│   └── cdk.json              # CDK configuration
└── docker-compose.yml        # Local testing with Docker Compose
```

**Rationale**:
- **ZIP format**: Universal, easy to download/extract, <10MB typical size
- **AWS CDK (Python)**: Infrastructure-as-code for one-click AWS deployment (future feature)
- **Docker Compose**: Enables local testing without AWS
- **README**: Step-by-step instructions for non-technical users
- **.env.example**: Documents required secrets (API keys)

**Alternatives Considered**:

| Format | Why Rejected |
|--------|--------------|
| **Terraform** | HashiCorp language less familiar to Python developers |
| **CloudFormation YAML** | Verbose, harder to customize than CDK code |
| **Pulumi** | Less mature AWS support than CDK |
| **Bare files (no IaC)** | User must manually create AWS resources |

**Template Customization**:
- CDK stack parameterized: region, instance size, scaling settings
- Dockerfile templated: base image, system packages, Python version
- Requirements.txt includes model-specific SDKs (boto3 for Bedrock, ollama-python)

**Download Flow**:
1. Test completes successfully
2. Convex action generates package files
3. Upload ZIP to S3 bucket with 24-hour expiration
4. Return pre-signed S3 URL to frontend
5. User clicks "Download" → S3 serves ZIP file

**Size Limit**: 50MB (S3 max for pre-signed URLs with fast download)

---

## Decision 5: Queue Management Strategy

**Decision**: Convex-native queue with database table + scheduled actions

**Architecture**:

```typescript
// Convex table
testQueue: {
  testId: v.id("testExecutions"),
  priority: v.number(),     // 1 = high, 2 = normal
  status: v.string(),       // "pending" | "claimed" | "running"
  createdAt: v.number(),
  claimedAt: v.optional(v.number()),
}

// Scheduled action (runs every 5 seconds)
export const processQueue = internalAction(async (ctx) => {
  // 1. Query pending tests (ordered by priority, createdAt)
  // 2. Check ECS capacity (max 10 concurrent tasks)
  // 3. Claim next test, start ECS task
  // 4. Update status to "running"
});
```

**Rationale**:
- **Convex-native**: No external dependencies (SQS adds complexity + cost)
- **Simple FIFO**: Queue by timestamp, optional priority for future enhancement
- **Scheduled actions**: Convex's built-in cron-like system for queue processing
- **Capacity check**: Prevent overload by counting running ECS tasks before claiming
- **Atomic claims**: Convex transactions prevent double-processing

**Alternatives Considered**:

| Approach | Why Rejected |
|----------|--------------|
| **AWS SQS** | Adds $0.40/million requests cost; requires polling infrastructure; overkill for 100 tests/day |
| **Redis queue** | External service adds hosting cost and complexity |
| **In-memory queue** | Lost on Convex action restart; not durable |
| **Direct execution** | No queuing = overload ECS when >10 concurrent requests |

**Queue Behavior**:
- Max concurrent executions: 10 (configurable)
- Queue wait time: <1 minute at 80% capacity (per success criteria)
- Retry policy: 3 attempts on transient ECS failures (task stopped unexpectedly)
- Timeout: Tests stuck in "claimed" for >15 minutes auto-reset to "pending"

**Monitoring**:
- Convex dashboard: Query `testQueue` table for length and age
- Alert if queue length >20 (indicates capacity issue)
- Metrics: average wait time, claim-to-start latency

---

## Decision 6: Model Provider Integration

**Decision**: Multi-provider support via environment variable injection

**Supported Providers**:

1. **Ollama (Local)**:
   - Container networking: Connect to Ollama via Docker bridge network
   - Environment: `OLLAMA_BASE_URL=http://host.docker.internal:11434`
   - Local development: Assumes Ollama running on host machine
   - Production: Deploy Ollama in separate ECS service with service discovery

2. **AWS Bedrock**:
   - Credentials: IAM role attached to ECS task (no hardcoded keys)
   - Environment: `AWS_REGION=us-east-1`, `BEDROCK_MODEL_ID=anthropic.claude-3-sonnet`
   - SDK: `boto3` in requirements.txt
   - Permissions: ECS task role with `bedrock:InvokeModel` policy

3. **OpenAI/Anthropic (Future)**:
   - Credentials: Secrets Manager → ECS task environment
   - Environment: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
   - Not implemented in Phase 1, but architecture supports

**Agent Code Template**:

```python
import os
from strands_agents import Agent

class MyAgent(Agent):
    def __init__(self):
        model_provider = os.getenv("MODEL_PROVIDER")  # "ollama" | "bedrock"

        if model_provider == "ollama":
            model_config = {
                "base_url": os.getenv("OLLAMA_BASE_URL"),
                "model": os.getenv("OLLAMA_MODEL", "llama2"),
            }
        elif model_provider == "bedrock":
            model_config = {
                "region": os.getenv("AWS_REGION"),
                "model_id": os.getenv("BEDROCK_MODEL_ID"),
            }

        super().__init__(model=model_config, ...)
```

**Testing Strategy**:
- Unit tests: Mock model provider responses
- Integration tests: Use real Ollama in Docker Compose
- Contract tests: Validate Bedrock IAM permissions

---

## Decision 7: Strands Agents Tools Integration

**Decision**: Bundle all `strands-agents-tools` in container with optional enablement

**Tool Categories** (from docs/strandsagents_tools.md):

1. **Core Tools** (always included):
   - `bash_tool`: Execute shell commands in container
   - `python_repl`: Run Python code dynamically
   - `edit_file`: Modify files in container filesystem

2. **Optional Tools** (enabled via agent config):
   - `use_computer`: GUI automation (requires X11 display server in container)
   - `web_search`: Brave search API (requires API key)
   - `code_interpreter`: Safe Python sandbox

**Container Setup**:

```dockerfile
FROM python:3.11-slim

# System dependencies for use_computer tool
RUN apt-get update && apt-get install -y \
    xvfb \
    x11vnc \
    fluxbox \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# Install Strands Agents + tools
RUN pip install strands-agents-tools[all]

# Agent code
COPY agent.py /app/
WORKDIR /app
CMD ["python", "agent.py"]
```

**Tool Security**:
- `bash_tool`: Restricted to /app directory (chroot-like)
- `python_repl`: AST validation to block dangerous imports
- `use_computer`: Runs in Xvfb (virtual framebuffer), isolated from host

**Test Validation**:
- Test runner imports agent and invokes `process_message(test_query)`
- Checks that tools are accessible: `assert agent.tools`
- Validates tool execution: `agent.tools['bash_tool'].execute('echo test')`

**Performance**:
- Cold start with all tools: ~30 seconds (acceptable)
- Cached Docker layers reduce rebuild time to ~5 seconds

---

## Open Questions & Future Research

1. **ECS Fargate Spot Interruptions**: Monitor interruption rate; if >5%, switch to on-demand
2. **CloudWatch Logs Cost**: ~$0.50/GB ingested; estimate 10MB/test = $5/1000 tests
3. **S3 Lifecycle**: Delete deployment packages after 24 hours to save storage cost
4. **Ollama in ECS**: Requires GPU instance (Fargate doesn't support GPU); use EC2 for Ollama service
5. **CDK Bootstrap**: User must run `cdk bootstrap` once per AWS account; document in README

---

## References

- [AWS ECS Fargate Pricing](https://aws.amazon.com/fargate/pricing/)
- [Fargate Spot Capacity Providers](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-capacity-providers.html)
- [Convex Actions Best Practices](https://docs.convex.dev/functions/actions)
- [Strands Agents Documentation](../../../docs/strandsagents_tools.md)
- [AWS Secrets Manager Pricing](https://aws.amazon.com/secrets-manager/pricing/)
- [CloudWatch Logs Insights](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/AnalyzingLogData.html)

---

**Status**: ✅ All research complete. Ready for Phase 1 (Design & Contracts).
