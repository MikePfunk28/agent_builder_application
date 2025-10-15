# Quickstart Guide: Containerized Agent Testing

**Feature**: Containerized Agent Testing System
**Target Audience**: Developers setting up the testing infrastructure
**Estimated Setup Time**: 30-45 minutes

---

## Prerequisites

Before starting, ensure you have:

- **AWS Account** with programmatic access (IAM user or SSO)
- **AWS CLI** v2 installed and configured (`aws configure`)
- **Node.js** 18+ and npm
- **Convex account** (free tier acceptable)
- **Git** for repository access
- **Docker** installed locally (for testing deployment packages)
- **Python** 3.11+ (for AWS CDK if using Python templates)

---

## Step 1: AWS Infrastructure Setup

### 1.1 Install AWS CDK

```bash
npm install -g aws-cdk@latest
cdk --version  # Should be 2.x
```

### 1.2 Bootstrap CDK (one-time per AWS account/region)

```bash
cdk bootstrap aws://ACCOUNT-ID/us-east-1
```

Replace `ACCOUNT-ID` with your AWS account ID (find via `aws sts get-caller-identity`).

### 1.3 Deploy ECS Infrastructure

```bash
cd infrastructure/aws/cdk
npm install
cdk deploy --all
```

This creates:
- **VPC** with public and private subnets
- **ECS Fargate cluster** (`agent-testing-cluster`)
- **S3 bucket** for deployment packages (`agent-deployments-{account-id}`)
- **S3 bucket** for container logs backup
- **IAM roles** for ECS tasks and Convex access
- **Secrets Manager** entries for model provider credentials
- **CloudWatch log group** (`/ecs/agent-tests`)

**Expected output**:

```
✅  AgentTestingStorageStack
✅  AgentTestingEcsStack

Outputs:
AgentTestingEcsStack.ClusterArn = arn:aws:ecs:us-east-1:123456789012:cluster/agent-testing-cluster
AgentTestingEcsStack.TaskDefinitionArn = arn:aws:ecs:us-east-1:123456789012:task-definition/agent-test-task:1
AgentTestingStorageStack.DeploymentBucketName = agent-deployments-123456789012
```

**Save these ARN values** - you'll need them for Convex environment variables.

---

## Step 2: Configure Model Provider Credentials

### 2.1 For AWS Bedrock

```bash
# No action needed - ECS task role already has bedrock:InvokeModel permission
# Verify access:
aws bedrock list-foundation-models --region us-east-1
```

### 2.2 For Ollama (Local Development)

```bash
# Start Ollama on host machine (accessible from Docker)
docker run -d -p 11434:11434 --name ollama ollama/ollama
docker exec ollama ollama pull llama2
```

Verify:
```bash
curl http://localhost:11434/api/generate -d '{"model": "llama2", "prompt": "test"}'
```

### 2.3 For OpenAI/Anthropic (Future)

Store API keys in AWS Secrets Manager:

```bash
aws secretsmanager create-secret \
  --name agent-testing/openai-api-key \
  --secret-string "sk-..."
```

---

## Step 3: Convex Environment Setup

### 3.1 Configure Convex Environment Variables

In your Convex dashboard (https://dashboard.convex.dev):

1. Navigate to **Settings → Environment Variables**
2. Add the following variables:

```bash
# AWS ECS Configuration (from CDK outputs)
AWS_ECS_CLUSTER_ARN=arn:aws:ecs:us-east-1:123456789012:cluster/agent-testing-cluster
AWS_ECS_TASK_DEFINITION=agent-test-task:1
AWS_ECS_SUBNETS=subnet-abc123,subnet-def456  # Private subnets from CDK
AWS_ECS_SECURITY_GROUP=sg-xyz789              # From CDK

# AWS S3 Storage (from CDK outputs)
AWS_S3_DEPLOYMENT_BUCKET=agent-deployments-123456789012
AWS_S3_REGION=us-east-1

# AWS Credentials (for Convex actions to call ECS API)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
# OR use IAM role ARN if Convex supports role assumption

# CloudWatch Logs
CLOUDWATCH_LOG_GROUP=/ecs/agent-tests

# Queue Configuration
MAX_CONCURRENT_TESTS=10
DEFAULT_TEST_TIMEOUT=180000  # 3 minutes in milliseconds
```

### 3.2 Verify Convex Deployment

```bash
cd /mnt/m/agent_builder_application
npm install
npx convex dev  # Test local development
npx convex deploy  # Deploy to production
```

Expected output:
```
✔ Deployed Convex functions to https://resolute-kudu-325.convex.cloud
```

---

## Step 4: Deploy Updated Convex Schema

### 4.1 Update Database Schema

Add the new tables to `convex/schema.ts`:

```typescript
// Add to existing schema
testExecutions: defineTable({
  agentId: v.id("agents"),
  userId: v.id("users"),
  testQuery: v.string(),
  // ... (see data-model.md for full schema)
})
  .index("by_user", ["userId", "submittedAt"])
  .index("by_agent", ["agentId", "submittedAt"])
  .index("by_status", ["status", "submittedAt"]),

testQueue: defineTable({
  testId: v.id("testExecutions"),
  priority: v.number(),
  status: v.string(),
  // ... (see data-model.md)
})
  .index("by_status_priority", ["status", "priority", "createdAt"])
  .index("by_test", ["testId"]),

deploymentPackages: defineTable({
  testId: v.id("testExecutions"),
  agentId: v.id("agents"),
  userId: v.id("users"),
  // ... (see data-model.md)
})
  .index("by_test", ["testId"])
  .index("by_user", ["userId", "generatedAt"])
  .index("by_expiry", ["urlExpiresAt"]),
```

### 4.2 Deploy Schema Changes

```bash
npx convex dev --once  # Verify schema compiles
npx convex deploy      # Deploy to production
```

Convex automatically applies schema migrations.

---

## Step 5: Local Development Setup

### 5.1 Enable Mock Mode (Optional)

For local development without AWS costs, enable mock mode:

```typescript
// convex/containerOrchestrator.ts
const MOCK_MODE = process.env.MOCK_ECS === "true";
```

Set in `.env.local`:
```bash
MOCK_ECS=true
```

Mock mode simulates ECS tasks without actually creating containers.

### 5.2 Test with Real Ollama

```bash
# Ensure Ollama is running
docker ps | grep ollama

# Create test agent in UI
# Submit test with query: "What is 2+2?"
# View logs in real-time
```

---

## Step 6: Test the Integration

### 6.1 End-to-End Test via UI

1. **Open application**: http://localhost:5173 (dev) or your production URL
2. **Sign in** with GitHub OAuth or email
3. **Create test agent**:
   - Name: "Math Helper"
   - Model: Ollama llama2
   - System Prompt: "You are a helpful math assistant"
   - Tools: python_repl
4. **Submit test**:
   - Query: "Calculate the square root of 144"
   - Click "Execute Real Docker Test"
5. **Monitor execution**:
   - Watch queue position decrease
   - View real-time logs streaming
   - Status changes: QUEUED → BUILDING → RUNNING → COMPLETED
6. **Download deployment package**:
   - Click "Download Deployment Package" button
   - Extract ZIP and review contents
7. **Test locally**:
   ```bash
   cd ~/Downloads/agent-deployment-*/
   docker-compose up
   # In another terminal:
   docker exec -it agent-test python -c "from agent import *; print(agent.process_message('test'))"
   ```

### 6.2 Verify Queue Behavior

Submit 15 tests simultaneously:
- First 10 should start immediately (parallel execution)
- Remaining 5 should queue
- Queue status should show position and wait time
- All tests should complete within 5 minutes

### 6.3 Verify Cancellation

1. Submit long-running test (e.g., "Count to 1000 slowly")
2. Click "Cancel Test" button while RUNNING
3. Verify ECS task stops within 30 seconds
4. Test status changes to FAILED
5. Logs show "Test cancelled by user"

---

## Step 7: Production Deployment Checklist

Before going live:

- [ ] **Security Review**:
  - [ ] S3 bucket has server-side encryption enabled
  - [ ] ECS tasks run as non-root user
  - [ ] Secrets Manager has rotation policy enabled
  - [ ] Security group only allows HTTPS egress
  - [ ] CloudWatch Logs retention set to 7 days

- [ ] **Cost Optimization**:
  - [ ] Enable Fargate Spot capacity provider (70% savings)
  - [ ] Set S3 lifecycle policy to delete packages after 24 hours
  - [ ] Configure CloudWatch log expiration (7 days)
  - [ ] Monitor ECS task count vs budget

- [ ] **Monitoring**:
  - [ ] CloudWatch dashboard created for queue metrics
  - [ ] Alarms set for queue length >20
  - [ ] Alarms set for test failure rate >10%
  - [ ] ECS task failure notifications to Slack/email

- [ ] **Testing**:
  - [ ] Unit tests pass (`npm test`)
  - [ ] Integration tests pass (see `tests/integration/`)
  - [ ] Load test with 50 concurrent submissions
  - [ ] Security audit (input validation, container escape attempts)

---

## Step 8: Troubleshooting

### Issue: Tests stuck in QUEUED status

**Cause**: Queue processor not running or AWS credentials invalid

**Fix**:
```bash
# Check Convex logs for errors
npx convex logs --tail

# Verify AWS credentials
aws ecs list-clusters --region us-east-1

# Manually trigger queue processor
npx convex run testExecution:processQueue
```

---

### Issue: ECS task fails immediately

**Cause**: Docker image build failure or insufficient task memory

**Fix**:
```bash
# Check CloudWatch logs
aws logs tail /ecs/agent-tests --follow

# Increase task memory in CDK:
# infrastructure/aws/cdk/lib/ecs-stack.ts
memory: "8192",  // 8GB instead of 4GB

cdk deploy
```

---

### Issue: Logs not streaming in real-time

**Cause**: CloudWatch polling action not running or permissions issue

**Fix**:
```bash
# Verify ECS task has CloudWatch Logs write permission
aws iam get-role --role-name ecsTaskExecutionRole

# Check Convex action logs
npx convex logs --tail | grep pollTestLogs

# Manually poll logs
npx convex run testExecution:pollTestLogs '{"testId": "k08ei3l4..."}'
```

---

### Issue: Deployment package download fails (404)

**Cause**: S3 pre-signed URL expired (24h limit)

**Fix**:
```typescript
// Refresh URL via API
await convex.mutation(api.deploymentPackage.refreshDownloadUrl, {
  packageId: "m20gk5n6..."
});
```

---

### Issue: "Docker spawn ENOENT" error persists

**Cause**: Still using old `dockerService.ts` instead of new `containerOrchestrator.ts`

**Fix**:
```bash
# Verify code is using new implementation
grep -r "spawn('docker'" convex/
# Should return no results

# Ensure realAgentTesting.ts imports containerOrchestrator
cat convex/realAgentTesting.ts | grep containerOrchestrator
```

---

## Next Steps

After successful setup:

1. **Run `/speckit.tasks`** to generate implementation task breakdown
2. **Implement core features**:
   - Phase 1: ECS orchestration and queue processing
   - Phase 2: Real-time log streaming
   - Phase 3: Deployment package generation
3. **Add monitoring and alerting**
4. **Conduct security audit**
5. **Load testing** with 100+ concurrent tests
6. **Document user-facing features** for end users

---

## Resources

- **AWS ECS Documentation**: https://docs.aws.amazon.com/ecs/
- **Convex Actions Guide**: https://docs.convex.dev/functions/actions
- **Strands Agents Tools**: `docs/strandsagents_tools.md`
- **API Contracts**: `contracts/testExecution.yaml`, `contracts/deploymentPackage.yaml`
- **Data Model**: `data-model.md`
- **Research Decisions**: `research.md`

---

## Support

- **Issues**: File GitHub issue with `[docker-testing]` prefix
- **Questions**: Check `docs/` directory or Convex Discord
- **AWS Costs**: Monitor via AWS Cost Explorer (estimate $30-50/month for hackathon load)

---

**Status**: ✅ Quickstart guide complete. System ready for implementation.
