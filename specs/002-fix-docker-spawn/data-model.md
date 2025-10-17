# Data Model

**Feature**: Containerized Agent Testing System
**Date**: 2025-10-14
**Status**: Phase 1 Design

## Overview

This document defines the Convex database schema, entity relationships, state machines, and validation rules for the containerized agent testing system.

---

## Database Schema (Convex)

### Table: `testExecutions`

**Purpose**: Track the complete lifecycle of an agent test from submission to completion

```typescript
testExecutions: defineTable({
  // Identity
  agentId: v.id("agents"),              // Reference to agent being tested
  userId: v.id("users"),                 // User who submitted test

  // Test Configuration
  testQuery: v.string(),                 // User's test query/prompt
  agentCode: v.string(),                 // Snapshot of agent.py at test time
  requirements: v.string(),              // requirements.txt content
  dockerfile: v.string(),                // Dockerfile content
  modelProvider: v.string(),             // "ollama" | "bedrock"
  modelConfig: v.object({                // Provider-specific config
    baseUrl: v.optional(v.string()),     // Ollama URL
    modelId: v.optional(v.string()),     // Model identifier
    region: v.optional(v.string()),      // AWS region
  }),
  timeout: v.number(),                   // Max execution time (ms)

  // Execution State
  status: v.string(),                    // State machine (see below)
  phase: v.string(),                     // "queued" | "building" | "running" | "completed"

  // Infrastructure
  ecsTaskArn: v.optional(v.string()),    // AWS ECS task ARN
  ecsTaskId: v.optional(v.string()),     // Short task ID for logs
  cloudwatchLogGroup: v.optional(v.string()),
  cloudwatchLogStream: v.optional(v.string()),

  // Execution Logs
  logs: v.array(v.string()),             // Real-time log lines
  lastLogFetchedAt: v.optional(v.number()), // Timestamp of last CloudWatch poll

  // Results
  success: v.optional(v.boolean()),      // Test outcome
  response: v.optional(v.string()),      // Agent response to test query
  error: v.optional(v.string()),         // Error message if failed
  errorStage: v.optional(v.string()),    // "build" | "runtime" | "service"

  // Metrics
  submittedAt: v.number(),               // Test submission timestamp
  startedAt: v.optional(v.number()),     // Container start timestamp
  completedAt: v.optional(v.number()),   // Test completion timestamp
  executionTime: v.optional(v.number()), // Runtime in milliseconds
  buildTime: v.optional(v.number()),     // Docker build time (ms)
  queueWaitTime: v.optional(v.number()), // Time in queue (ms)
  memoryUsed: v.optional(v.number()),    // MB of memory consumed
  cpuUsed: v.optional(v.number()),       // vCPU utilization (%)

  // Deployment Package
  deploymentPackageUrl: v.optional(v.string()), // S3 pre-signed URL
  deploymentPackageExpiry: v.optional(v.number()), // URL expiration time
})
  .index("by_user", ["userId", "submittedAt"])
  .index("by_agent", ["agentId", "submittedAt"])
  .index("by_status", ["status", "submittedAt"])
```

**Validation Rules** (enforced in Convex mutations):

- `testQuery`: 1-2000 characters, no null bytes
- `agentCode`: <100KB, valid Python syntax check
- `requirements`: <10KB, each line matches `^[a-zA-Z0-9_-]+(\[[\w,]+\])?(==|>=|<=|>|<)?[\d.]*$`
- `dockerfile`: <5KB, no `RUN curl|wget|nc`, no `--privileged`
- `timeout`: 10,000-600,000 ms (10s - 10min)
- `status`: Must follow state machine transitions (see below)

**Indexes**:
- `by_user`: List user's test history (ordered by time)
- `by_agent`: List all tests for an agent (analytics)
- `by_status`: Query tests by status for queue processing

---

### Table: `testQueue`

**Purpose**: FIFO queue for pending test executions with priority support

```typescript
testQueue: defineTable({
  testId: v.id("testExecutions"),        // Reference to test execution
  priority: v.number(),                  // 1 = high, 2 = normal, 3 = low
  status: v.string(),                    // "pending" | "claimed" | "abandoned"

  // Timestamps
  createdAt: v.number(),                 // Queue entry creation time
  claimedAt: v.optional(v.number()),     // When queue processor claimed this
  claimedBy: v.optional(v.string()),     // Action instance ID (for debugging)

  // Retry Tracking
  attempts: v.number(),                  // Number of execution attempts
  lastError: v.optional(v.string()),     // Last failure reason
})
  .index("by_status_priority", ["status", "priority", "createdAt"])
  .index("by_test", ["testId"])
```

**Validation Rules**:

- `priority`: 1-3 only
- `status`: "pending" | "claimed" | "abandoned"
- `attempts`: 0-3 (max 3 retries)

**Queue Processing Logic**:

```typescript
// Query next test to process
const nextTest = await ctx.db
  .query("testQueue")
  .withIndex("by_status_priority", (q) =>
    q.eq("status", "pending")
  )
  .order("asc") // FIFO by createdAt within same priority
  .first();

// Atomic claim
await ctx.db.patch(nextTest._id, {
  status: "claimed",
  claimedAt: Date.now(),
  claimedBy: ctx.actionId,
});
```

**Abandonment Detection**:

- Scheduled action runs every 15 minutes
- Marks tests as "abandoned" if `claimedAt` >15 min ago and status still "claimed"
- Resets to "pending" if `attempts < 3`, else marks test as failed

---

### Table: `deploymentPackages`

**Purpose**: Track generated deployment artifacts and download metadata

```typescript
deploymentPackages: defineTable({
  testId: v.id("testExecutions"),        // Source test execution
  agentId: v.id("agents"),               // Agent being deployed
  userId: v.id("users"),                 // Package owner

  // Package Metadata
  packageName: v.string(),               // "agent-deployment-{agentId}-{timestamp}.zip"
  fileSize: v.number(),                  // Bytes

  // S3 Storage
  s3Bucket: v.string(),                  // Bucket name
  s3Key: v.string(),                     // Object key
  downloadUrl: v.string(),               // Pre-signed URL
  urlExpiresAt: v.number(),              // Expiration timestamp

  // Contents Manifest
  files: v.array(v.object({
    path: v.string(),                    // Relative path in ZIP
    size: v.number(),                    // Bytes
    checksum: v.string(),                // SHA256 hash
  })),

  // Download Tracking
  generatedAt: v.number(),               // Package creation time
  downloadCount: v.number(),             // Times downloaded
  lastDownloadedAt: v.optional(v.number()),
})
  .index("by_test", ["testId"])
  .index("by_user", ["userId", "generatedAt"])
  .index("by_expiry", ["urlExpiresAt"])
```

**Lifecycle**:

1. Test completes successfully → Generate package → Upload to S3 → Insert record
2. User downloads → Increment `downloadCount`, update `lastDownloadedAt`
3. Scheduled action deletes expired packages (runs daily):
   - Query `by_expiry` index for `urlExpiresAt < now()`
   - Delete from S3
   - Delete Convex record

**Validation Rules**:

- `packageName`: Matches `^agent-deployment-[a-z0-9]+-\d+\.zip$`
- `fileSize`: <50MB (S3 pre-signed URL limit)
- `urlExpiresAt`: 24 hours from `generatedAt`

---

## State Machine: Test Execution Lifecycle

```
                    ┌─────────────┐
                    │   CREATED   │ (testExecutions record inserted)
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   QUEUED    │ (testQueue entry created)
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │ (queue processor claims)        │ (timeout)
          ▼                                 ▼
   ┌─────────────┐                  ┌─────────────┐
   │  BUILDING   │                  │  ABANDONED  │
   └──────┬──────┘                  └─────────────┘
          │
          │ (ECS task created)
          ▼
   ┌─────────────┐
   │   RUNNING   │ (container executing)
   └──────┬──────┘
          │
          │
    ┌─────┴────────┐
    │              │
    ▼              ▼
┌──────────┐  ┌──────────┐
│ COMPLETED│  │  FAILED  │
└──────────┘  └──────────┘
    │              │
    │              │
    └─────┬────────┘
          ▼
   ┌─────────────┐
   │  ARCHIVED   │ (after 7 days, logs purged)
   └─────────────┘
```

**State Definitions**:

- **CREATED**: Test record exists, not yet queued
- **QUEUED**: Waiting in queue for available ECS capacity
- **BUILDING**: Docker image building (CloudWatch logs streaming)
- **RUNNING**: Container executing test (agent processing query)
- **COMPLETED**: Test finished successfully (response available)
- **FAILED**: Test failed (build error, runtime error, or timeout)
- **ABANDONED**: Claimed from queue but never started (ECS failure)
- **ARCHIVED**: Test completed >7 days ago, logs purged to save storage

**Transition Rules**:

```typescript
const validTransitions = {
  CREATED: ["QUEUED"],
  QUEUED: ["BUILDING", "ABANDONED"],
  BUILDING: ["RUNNING", "FAILED"],
  RUNNING: ["COMPLETED", "FAILED"],
  COMPLETED: ["ARCHIVED"],
  FAILED: ["ARCHIVED"],
  ABANDONED: ["QUEUED", "ARCHIVED"], // Can retry if attempts < 3
};
```

**Mutation Enforcement**:

```typescript
export const updateTestStatus = mutation({
  args: { testId: v.id("testExecutions"), newStatus: v.string() },
  handler: async (ctx, args) => {
    const test = await ctx.db.get(args.testId);
    if (!test) throw new Error("Test not found");

    const allowed = validTransitions[test.status];
    if (!allowed || !allowed.includes(args.newStatus)) {
      throw new Error(`Invalid transition: ${test.status} → ${args.newStatus}`);
    }

    await ctx.db.patch(args.testId, {
      status: args.newStatus,
      // Update metrics based on transition
      ...(args.newStatus === "BUILDING" && { startedAt: Date.now() }),
      ...(args.newStatus === "COMPLETED" && { completedAt: Date.now() }),
    });
  },
});
```

---

## Entity Relationships

```
users (from auth)
  │
  ├──< testExecutions (1:N)
  │     │
  │     ├──> agents (N:1)
  │     ├──< testQueue (1:1)
  │     └──< deploymentPackages (1:1)
  │
  └──< agents (1:N)
```

**Cascade Deletion**:

- Delete agent → Archive all `testExecutions` (status → ARCHIVED), remove from queue
- Delete user → Delete all `deploymentPackages`, archive `testExecutions`
- Delete test → Delete `testQueue` entry and `deploymentPackages`

---

## Indexes and Query Patterns

### Common Queries

**1. User Test History** (recent first):

```typescript
const userTests = await ctx.db
  .query("testExecutions")
  .withIndex("by_user", (q) => q.eq("userId", currentUserId))
  .order("desc")
  .take(20);
```

**2. Agent Analytics** (all tests for agent):

```typescript
const agentTests = await ctx.db
  .query("testExecutions")
  .withIndex("by_agent", (q) => q.eq("agentId", agentId))
  .collect();

const successRate = agentTests.filter(t => t.success).length / agentTests.length;
```

**3. Queue Processing** (next pending test):

```typescript
const nextTest = await ctx.db
  .query("testQueue")
  .withIndex("by_status_priority", (q) => q.eq("status", "pending"))
  .order("asc")
  .first();
```

**4. Active Tests** (currently running):

```typescript
const activeTests = await ctx.db
  .query("testExecutions")
  .withIndex("by_status", (q) => q.eq("status", "RUNNING"))
  .collect();

const activeCount = activeTests.length; // Check capacity (max 10)
```

**5. Expired Packages** (cleanup job):

```typescript
const expiredPackages = await ctx.db
  .query("deploymentPackages")
  .withIndex("by_expiry")
  .filter((q) => q.lt(q.field("urlExpiresAt"), Date.now()))
  .collect();
```

---

## Data Integrity Constraints

**Enforced in Convex Mutations**:

1. **Referential Integrity**:
   - `testExecutions.agentId` must exist in `agents` table
   - `testQueue.testId` must exist in `testExecutions` table
   - `deploymentPackages.testId` must exist in `testExecutions` table

2. **Business Rules**:
   - Only `COMPLETED` tests can generate deployment packages
   - Cannot retry test if `attempts >= 3`
   - Cannot download package if `urlExpiresAt < now()`
   - Cannot claim test from queue if active test count >= 10

3. **Immutability**:
   - Once test transitions to `COMPLETED` or `FAILED`, logs are immutable
   - `submittedAt` timestamp cannot be changed
   - `agentCode` snapshot cannot be modified (preserves test reproducibility)

---

## Audit Log (Future Enhancement)

**Table**: `testAuditLog` (not implemented in Phase 1)

```typescript
testAuditLog: defineTable({
  testId: v.id("testExecutions"),
  action: v.string(),              // "status_changed" | "retried" | "cancelled"
  actor: v.id("users"),
  before: v.optional(v.any()),
  after: v.optional(v.any()),
  timestamp: v.number(),
  metadata: v.optional(v.object({
    ip: v.string(),
    userAgent: v.string(),
  })),
});
```

**Purpose**: Track all test lifecycle changes for debugging and compliance

---

## Summary

**Tables Created**: 3
- `testExecutions` (46 fields, 3 indexes)
- `testQueue` (8 fields, 2 indexes)
- `deploymentPackages` (14 fields, 3 indexes)

**State Machine**: 8 states, 10 valid transitions

**Query Patterns**: 5 primary access patterns optimized with indexes

**Data Retention**:
- Test logs: 7 days
- Deployment packages: 24 hours
- Test metadata: Indefinite (archived after 7 days)

**Next Phase**: API contract generation (`contracts/`)
