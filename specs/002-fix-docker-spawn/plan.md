# Implementation Plan: Containerized Agent Testing System

**Branch**: `002-fix-docker-spawn` | **Date**: 2025-10-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-fix-docker-spawn/spec.md`

## Summary

Replace the current simulated Docker testing service with a real containerized execution system that allows users to test Python agents with Ollama/Bedrock models in isolated Docker containers. The system will use AWS ECS Fargate for on-demand container execution, with Convex actions managing test queues and streaming real-time logs to users. Successfully tested agents will generate downloadable deployment packages containing agent.py, Dockerfile, requirements.txt, and AWS CDK deployment scripts.

## Technical Context

**Language/Version**: TypeScript 5.7.2 (Convex backend), Python 3.11 (agents), React 19.0.0 (frontend)
**Primary Dependencies**: Convex 1.24.2, AWS SDK v3 (ECS client), @convex-dev/auth 0.0.80, Strands Agents framework
**Storage**: Convex database for test metadata and results, S3 for deployment artifacts and container logs
**Testing**: Vitest for TypeScript, pytest for Python agent code
**Target Platform**: Cloudflare Pages (frontend), Convex Cloud (backend), AWS ECS Fargate (container execution)
**Project Type**: Web application (Convex backend + React frontend)
**Performance Goals**: 95% of tests complete within 3 minutes, support 10 concurrent executions, <2s real-time log update latency
**Constraints**: <200ms API response time (p95), test timeout max 10 minutes, deployment package <50MB, queue wait <1 min at 80% capacity
**Scale/Scope**: ~100 tests/day during hackathon, ~5-10 concurrent users, test history retention 7 days

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: No constitution file filled in yet - this is a prototype/hackathon project. Key principles to follow:
- ✅ **Security First**: Isolate user code in containers, validate inputs, prevent injection attacks
- ✅ **Observable**: Stream logs, track test status, provide clear error messages
- ✅ **Cost-Conscious**: Use Fargate Spot when possible, enforce timeouts, cleanup resources
- ✅ **Testable**: Unit tests for queue logic, integration tests for container execution, contract tests for API

No violations detected.

## Project Structure

### Documentation (this feature)

```
specs/002-fix-docker-spawn/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (AWS service selection, security patterns)
├── data-model.md        # Phase 1 output (test execution entities, state machines)
├── quickstart.md        # Phase 1 output (developer setup guide)
├── contracts/           # Phase 1 output (API specs for test execution)
│   ├── testExecution.yaml    # OpenAPI spec for test lifecycle
│   └── deploymentPackage.yaml # Download package generation
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created yet)
```

### Source Code (repository root)

```
# Web application structure (Convex backend + React frontend)
convex/
├── schema.ts                    # [MODIFY] Add testExecutions, testQueue tables
├── testExecution.ts             # [NEW] Test lifecycle management actions/queries
├── containerOrchestrator.ts     # [NEW] AWS ECS Fargate integration
├── deploymentPackageGenerator.ts # [NEW] Creates downloadable artifacts
├── realAgentTesting.ts          # [REPLACE] Remove Docker spawn, use queue
├── dockerService.ts             # [REPLACE] Remove simulation, use real AWS
└── _generated/                  # Convex generated types

src/
├── components/
│   ├── TestExecutionPanel.tsx   # [MODIFY] Add real-time log streaming
│   ├── TestQueueStatus.tsx      # [NEW] Show queue position
│   └── DeploymentDownload.tsx   # [NEW] Download button component
├── hooks/
│   └── useTestStream.ts         # [NEW] WebSocket/subscription for logs
└── lib/
    └── testClient.ts            # [NEW] API client for test operations

tests/
├── contract/
│   ├── testExecution.test.ts   # [NEW] Contract tests for test API
│   └── deploymentPackage.test.ts # [NEW] Artifact generation tests
├── integration/
│   ├── awsEcsIntegration.test.ts # [NEW] ECS task execution tests
│   └── endToEndTest.test.ts     # [NEW] Full test workflow
└── unit/
    ├── queueManager.test.ts     # [NEW] Queue logic tests
    └── packageGenerator.test.ts  # [NEW] Deployment artifact tests

infrastructure/
└── aws/
    ├── cdk/                     # [NEW] AWS CDK for ECS setup
    │   ├── lib/
    │   │   ├── ecs-stack.ts     # Fargate cluster, task definitions
    │   │   └── storage-stack.ts # S3 buckets for logs and artifacts
    │   └── bin/
    │       └── app.ts           # CDK app entry point
    └── templates/                # [NEW] User deployment templates
        ├── agent-dockerfile.template
        ├── requirements.template
        └── cdk-deploy.template
```

**Structure Decision**: Web application structure chosen because this is a Convex-based backend with React frontend. Container orchestration is externalized to AWS ECS, not run locally. Infrastructure code lives in `/infrastructure/aws/` for deployment automation.

## Complexity Tracking

*No Constitution violations - this section can remain empty for prototype/hackathon project*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Phase 0: Research & Decisions

**Objective**: Resolve all NEEDS CLARIFICATION items and document technology choices

### Research Tasks

1. **AWS Container Execution Service Selection**
   - Compare ECS Fargate vs Lambda containers vs Batch for on-demand agent testing
   - Evaluate cold start times, pricing, timeout limits
   - Decision criteria: <30s cold start, pay-per-use, 10min timeout support
   - **Output**: Service selection with cost/performance justification

2. **Container Security Patterns**
   - Research Docker/ECS security best practices for user-submitted code
   - Evaluate resource limits (CPU, memory, network egress)
   - Investigate secrets management for model provider credentials
   - **Output**: Security checklist and container configuration guidelines

3. **Real-Time Log Streaming**
   - Research AWS CloudWatch Logs streaming to Convex actions
   - Evaluate Convex subscriptions vs polling for log updates
   - Determine WebSocket vs SSE for frontend real-time updates
   - **Output**: Log streaming architecture decision

4. **Deployment Package Format**
   - Research standard formats for Python container deployment artifacts
   - Evaluate CDK vs CloudFormation vs Terraform for user templates
   - Determine package contents and structure
   - **Output**: Package format specification

5. **Queue Management Strategy**
   - Research Convex-native queuing vs external queue (SQS)
   - Evaluate FIFO vs priority queue requirements
   - Determine retry and failure handling patterns
   - **Output**: Queue architecture decision

**Deliverable**: `research.md` with decisions, rationale, and alternatives considered

## Phase 1: Design & Contracts

**Prerequisites**: `research.md` complete with all service selections made

### Data Model Design

**Extract from spec entities**:
- Test Request (user input, agent config, query)
- Test Execution (status, logs, results, metrics)
- Test Queue (pending requests, priority, timestamps)
- Deployment Package (artifact metadata, download URLs)
- Execution Environment (container config, credentials)
- Test Results (output, success status, performance)

**Output**: `data-model.md` with:
- Convex table schemas for testExecutions, testQueue, deploymentPackages
- State machine diagrams for test lifecycle (queued → building → running → completed/failed)
- Validation rules from functional requirements
- Relationships and indexes

### API Contract Generation

**From functional requirements**:

FR-001: Execute in isolated containers → `POST /api/tests/submit`
FR-003: Real-time logs → `GET /api/tests/:id/logs/stream` (WebSocket)
FR-005: Generate deployment package → `POST /api/tests/:id/package`
FR-006: Customize and retry → `POST /api/tests/:id/retry`
FR-011: Cancel running test → `DELETE /api/tests/:id`
FR-010: Retrieve results → `GET /api/tests/:id/results`

**Output**: `contracts/` directory with:
- `testExecution.yaml` - OpenAPI 3.0 spec for test lifecycle endpoints
- `deploymentPackage.yaml` - Artifact download and customization API

### Quickstart Guide

**Output**: `quickstart.md` with:
1. Prerequisites (AWS account, Convex project, environment variables)
2. AWS infrastructure setup (CDK deploy command)
3. Convex environment variables (AWS credentials, ECS cluster ARN)
4. Local development setup (mock mode vs real AWS)
5. Testing the integration (submit test, monitor logs, download package)

### Agent Context Update

Run `.specify/scripts/powershell/update-agent-context.ps1 -AgentType claude` to update Claude-specific context with:
- AWS ECS Fargate integration patterns
- Convex action queuing strategies
- Container security best practices
- Real-time log streaming architecture

**Deliverables**:
- `data-model.md`
- `contracts/testExecution.yaml`
- `contracts/deploymentPackage.yaml`
- `quickstart.md`
- Updated `.specify/memory/context-claude.md`

## Phase 2: Task Generation

**Not executed by `/speckit.plan` - run `/speckit.tasks` separately**

This phase will generate `tasks.md` with dependency-ordered implementation tasks based on the design artifacts created in Phase 0 and Phase 1.

## Next Steps

1. ✅ Review and approve this implementation plan
2. ⏳ Execute Phase 0 research (generate `research.md`)
3. ⏳ Execute Phase 1 design (generate `data-model.md`, `contracts/`, `quickstart.md`)
4. ⏳ Run `/speckit.tasks` to generate actionable task breakdown
5. ⏳ Run `/speckit.implement` to execute implementation

**Note**: User mentioned future AWS one-click deployment feature - out of scope for this plan, but deployment package templates will enable this future work.
