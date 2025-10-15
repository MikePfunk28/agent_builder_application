---
description: "Implementation tasks for containerized agent testing system"
---

# Tasks: Containerized Agent Testing System

**Input**: Design documents from `/specs/002-fix-docker-spawn/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not requested in specification - focusing on implementation tasks only

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions
- **Web app structure**: `convex/` (backend), `src/` (frontend)
- Convex backend uses TypeScript
- React frontend uses TypeScript + JSX

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: AWS infrastructure and project dependencies

- [ ] T001 Deploy AWS infrastructure using CDK (VPC, ECS cluster, S3 buckets, IAM roles) per quickstart.md Step 1
- [ ] T002 Configure AWS Secrets Manager for model provider credentials (Ollama URL, Bedrock access)
- [ ] T003 [P] Set up Convex environment variables (AWS credentials, ECS ARNs, S3 bucket names) per quickstart.md Step 3
- [ ] T004 [P] Install AWS SDK dependencies (@aws-sdk/client-ecs, @aws-sdk/client-s3, @aws-sdk/client-cloudwatch-logs) in package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core database schema and base infrastructure that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Update Convex schema.ts with testExecutions table (46 fields, 3 indexes) per data-model.md
- [ ] T006 [P] Update Convex schema.ts with testQueue table (8 fields, 2 indexes) per data-model.md
- [ ] T007 [P] Update Convex schema.ts with deploymentPackages table (14 fields, 3 indexes) per data-model.md
- [ ] T008 Deploy schema changes to Convex (npx convex dev --once && npx convex deploy)
- [ ] T009 Create convex/lib/aws/ecsClient.ts - AWS ECS client wrapper with credential management
- [ ] T010 [P] Create convex/lib/aws/s3Client.ts - S3 client wrapper for upload/download
- [ ] T011 [P] Create convex/lib/aws/cloudwatchClient.ts - CloudWatch Logs client for log streaming
- [ ] T012 Create convex/lib/stateValidation.ts - Test execution state machine validator per data-model.md (8 states, transition rules)
- [ ] T013 Create src/lib/convexClient.ts - Frontend Convex client configuration

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Test Agent in Isolated Environment (Priority: P1) 🎯 MVP

**Goal**: Users can submit agent tests that execute in isolated Docker containers via AWS ECS Fargate without "Docker spawn ENOENT" errors

**Independent Test**: Create agent → Click "Execute Real Docker Test" → Verify test runs in ECS without infrastructure errors → View results

### Implementation for User Story 1

**Backend - Test Submission & Queue Management**

- [ ] T014 [P] [US1] Create convex/testExecution.ts with submitTest mutation (validates inputs, creates testExecutions record, queues test)
- [ ] T015 [P] [US1] Create convex/testQueue.ts with addToQueue mutation (creates testQueue entry with priority)
- [ ] T016 [US1] Create convex/queueProcessor.ts with processQueue scheduled action (runs every 5s, claims pending tests, checks ECS capacity)
- [ ] T017 [US1] Implement capacity check in queueProcessor.ts (max 10 concurrent ECS tasks)
- [ ] T018 [US1] Add queue abandonment detection in queueProcessor.ts (reset claimed tests >15min old)

**Backend - Container Orchestration**

- [ ] T019 [US1] Create convex/containerOrchestrator.ts with startEcsTask action (creates ECS task definition, runs Fargate task)
- [ ] T020 [US1] Implement buildDockerContext in containerOrchestrator.ts (generates agent.py, Dockerfile, requirements.txt, test_runner.py)
- [ ] T021 [US1] Implement uploadBuildContext to S3 (temporary storage for ECS task to pull context)
- [ ] T022 [US1] Configure ECS task definition with environment variables (MODEL_PROVIDER, OLLAMA_BASE_URL, AWS_REGION, BEDROCK_MODEL_ID)
- [ ] T023 [US1] Implement ecsTaskMonitor action (polls ECS task status, updates testExecutions.status)
- [ ] T024 [US1] Add error handling for ECS failures (task stopped, insufficient capacity, build errors)

**Backend - Test Execution & Results**

- [ ] T025 [US1] Create convex/testResults.ts with updateTestStatus mutation (enforces state machine transitions)
- [ ] T026 [US1] Implement getTestById query in testExecution.ts (returns full test execution record)
- [ ] T027 [US1] Implement getUserTests query in testExecution.ts (lists user's test history with pagination)
- [ ] T028 [US1] Add test completion handler (parses /tmp/test_result.json from container, stores response/error)

**Frontend - Test Submission UI**

- [ ] T029 [P] [US1] Create src/components/TestExecutionPanel.tsx (test submission form, query input, timeout selector)
- [ ] T030 [P] [US1] Create src/hooks/useTestSubmit.ts (handles submitTest mutation, error handling)
- [ ] T031 [US1] Integrate TestExecutionPanel into agent detail page (src/pages/AgentDetailPage.tsx or equivalent)
- [ ] T032 [US1] Add loading states and success/error notifications in TestExecutionPanel

**Frontend - Test Results Display**

- [ ] T033 [P] [US1] Create src/components/TestResultsView.tsx (displays success/failure, response text, execution metrics)
- [ ] T034 [P] [US1] Create src/hooks/useTestQuery.ts (reactive query for getTestById)
- [ ] T035 [US1] Add test status badges (QUEUED, BUILDING, RUNNING, COMPLETED, FAILED) in TestResultsView
- [ ] T036 [US1] Display execution metrics (executionTime, memoryUsed, buildTime) in TestResultsView

**Checkpoint**: At this point, users can submit tests, they execute in ECS Fargate, and results are displayed. User Story 1 is fully functional.

---

## Phase 4: User Story 2 - Download Deployment Artifacts (Priority: P2)

**Goal**: Users can download deployment packages containing agent.py, Dockerfile, requirements.txt, and AWS CDK scripts after successful tests

**Independent Test**: Complete test successfully → Click "Download Deployment Package" → Verify ZIP downloads with all files

### Implementation for User Story 2

**Backend - Package Generation**

- [ ] T037 [US2] Create convex/deploymentPackageGenerator.ts with generatePackage action (creates ZIP structure)
- [ ] T038 [US2] Implement generateAgentPy in deploymentPackageGenerator.ts (formats agent code from testExecutions.agentCode)
- [ ] T039 [US2] Implement generateDockerfile (creates production Dockerfile with agent dependencies)
- [ ] T040 [US2] Implement generateRequirementsTxt (extracts Python packages from testExecutions.requirements)
- [ ] T041 [US2] Implement generateReadme (creates deployment instructions with environment variables)
- [ ] T042 [US2] Implement generateCdkTemplates (creates AWS CDK Python app for ECS deployment)
- [ ] T043 [US2] Implement generateDockerCompose (creates docker-compose.yml for local testing)
- [ ] T044 [US2] Implement generateEnvExample (documents required environment variables)

**Backend - S3 Upload & URL Generation**

- [ ] T045 [US2] Implement uploadPackageToS3 in deploymentPackageGenerator.ts (creates ZIP, uploads to S3)
- [ ] T046 [US2] Implement generatePreSignedUrl (creates 24-hour expiring download URL)
- [ ] T047 [US2] Create deploymentPackages table record with metadata (fileSize, s3Key, expiresAt)
- [ ] T048 [US2] Add checksum generation for all files in package (SHA256)

**Backend - Package Management API**

- [ ] T049 [P] [US2] Create convex/deploymentPackage.ts with generatePackage mutation (validates test COMPLETED status)
- [ ] T050 [P] [US2] Implement getPackageById query in deploymentPackage.ts
- [ ] T051 [P] [US2] Implement getUserPackages query (lists user's deployment packages)
- [ ] T052 [P] [US2] Implement refreshDownloadUrl mutation (regenerates pre-signed URL)
- [ ] T053 [P] [US2] Implement trackDownload mutation (increments downloadCount)

**Frontend - Download UI**

- [ ] T054 [P] [US2] Create src/components/DeploymentDownload.tsx (download button, package metadata display)
- [ ] T055 [P] [US2] Create src/hooks/usePackageGeneration.ts (handles generatePackage mutation)
- [ ] T056 [US2] Add "Download Deployment Package" button to TestResultsView (only for COMPLETED tests)
- [ ] T057 [US2] Display package metadata (fileSize, expiresAt, downloadCount) in DeploymentDownload
- [ ] T058 [US2] Handle download tracking (call trackDownload mutation on button click)
- [ ] T059 [US2] Add "Refresh URL" button for expired packages (calls refreshDownloadUrl)

**Infrastructure - S3 Lifecycle**

- [ ] T060 [US2] Create S3 lifecycle policy to delete packages after 24 hours (AWS CDK update)
- [ ] T061 [US2] Create Convex scheduled action to clean up expired deploymentPackages records (runs daily)

**Checkpoint**: Users can generate and download deployment packages with all necessary files for AWS/local deployment

---

## Phase 5: User Story 3 - Monitor Test Execution (Priority: P3)

**Goal**: Users can view real-time logs and status updates during test execution to understand progress and debug issues

**Independent Test**: Submit test → Watch logs stream in real-time → See status change from QUEUED → BUILDING → RUNNING → COMPLETED

### Implementation for User Story 3

**Backend - Log Streaming**

- [ ] T062 [US3] Create convex/logStreaming.ts with pollTestLogs action (polls CloudWatch Logs every 2s)
- [ ] T063 [US3] Implement fetchCloudWatchLogs in logStreaming.ts (uses CloudWatch Logs client, fetches new lines)
- [ ] T064 [US3] Implement appendLogsToTest mutation (adds new log lines to testExecutions.logs array)
- [ ] T065 [US3] Add log polling lifecycle management (start polling when test BUILDING, stop when COMPLETED/FAILED)
- [ ] T066 [US3] Create getTestLogs query in testExecution.ts (returns logs with afterIndex support for incremental updates)

**Backend - Queue Status**

- [ ] T067 [P] [US3] Create convex/queueStatus.ts with getQueueStatus query
- [ ] T068 [P] [US3] Implement queue metrics calculation (pendingCount, runningCount, avgWaitTime, oldestPendingAge)
- [ ] T069 [P] [US3] Add capacity check in getQueueStatus (returns current capacity utilization)

**Frontend - Real-Time Log Display**

- [ ] T070 [P] [US3] Create src/components/LogStreamViewer.tsx (terminal-style log display with auto-scroll)
- [ ] T071 [P] [US3] Create src/hooks/useTestStream.ts (reactive query for getTestById, updates every 2s)
- [ ] T072 [US3] Integrate LogStreamViewer into TestExecutionPanel (shows logs while test running)
- [ ] T073 [US3] Add auto-scroll to bottom when new log lines appear
- [ ] T074 [US3] Add timestamp display for each log line
- [ ] T075 [US3] Add log level color coding (info, warning, error)

**Frontend - Status Indicators**

- [ ] T076 [P] [US3] Create src/components/TestStatusIndicator.tsx (visual status with icons/colors)
- [ ] T077 [P] [US3] Create src/components/TestQueueStatus.tsx (displays queue position and wait time)
- [ ] T078 [US3] Add progress bar showing test phase (queued 25% → building 50% → running 75% → completed 100%)
- [ ] T079 [US3] Display elapsed time counter while test is running
- [ ] T080 [US3] Show queue position and estimated wait time for QUEUED tests

**Frontend - Metrics Display**

- [ ] T081 [P] [US3] Create src/components/TestMetrics.tsx (displays execution time, memory, CPU usage)
- [ ] T082 [US3] Add metrics visualization (bar charts for memory/CPU usage)
- [ ] T083 [US3] Display performance comparison vs previous tests (avg execution time)

**Checkpoint**: Users can monitor test execution in real-time with streaming logs and visual status indicators

---

## Phase 6: User Story 4 - Retry and Manage Tests (Priority: P4)

**Goal**: Users can retry failed tests, manage test history, and cancel running tests

**Independent Test**: Run test → Fail → Click "Retry" → Verify new test runs → View test history with all attempts

### Implementation for User Story 4

**Backend - Test Retry**

- [ ] T084 [US4] Create retryTest mutation in convex/testExecution.ts (clones test config, creates new testExecutions record)
- [ ] T085 [US4] Support optional query modification in retryTest (modifyQuery parameter)
- [ ] T086 [US4] Link original test to retry in testExecutions (add originalTestId field)

**Backend - Test Cancellation**

- [ ] T087 [US4] Create cancelTest action in convex/testExecution.ts (calls ECS StopTask API)
- [ ] T088 [US4] Implement graceful shutdown (30-second termination grace period)
- [ ] T089 [US4] Update test status to FAILED with cancellation reason
- [ ] T090 [US4] Add cleanup of resources (S3 build context, CloudWatch log stream)

**Backend - Test History**

- [ ] T091 [P] [US4] Add test history filtering in getUserTests (filter by status, date range)
- [ ] T092 [P] [US4] Implement test history pagination (cursor-based, 20 tests per page)
- [ ] T093 [P] [US4] Add test history sorting (most recent first, by status, by execution time)
- [ ] T094 [US4] Create clearTestHistory mutation (marks old tests as ARCHIVED)

**Frontend - Retry UI**

- [ ] T095 [P] [US4] Add "Retry Test" button to TestResultsView (enabled for FAILED tests)
- [ ] T096 [P] [US4] Create src/components/RetryTestDialog.tsx (modal for retry with optional query modification)
- [ ] T097 [US4] Handle retry submission and redirect to new test page

**Frontend - Cancellation UI**

- [ ] T098 [P] [US4] Add "Cancel Test" button to TestExecutionPanel (enabled for BUILDING/RUNNING tests)
- [ ] T099 [P] [US4] Add confirmation dialog before cancellation
- [ ] T100 [US4] Display cancellation success message and update UI

**Frontend - Test History UI**

- [ ] T101 [P] [US4] Create src/components/TestHistory.tsx (table view of all user tests)
- [ ] T102 [P] [US4] Add filter controls (status dropdown, date range picker)
- [ ] T103 [US4] Add pagination controls (next/prev page)
- [ ] T104 [US4] Add clickable test rows to view detailed results
- [ ] T105 [US4] Add "Clear History" button (archives tests older than 7 days)
- [ ] T106 [US4] Display retry chain (link original test to retries)

**Checkpoint**: Users can retry tests, cancel running tests, and manage their complete test history

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T107 [P] Add comprehensive error messages for all failure scenarios (build errors, runtime errors, ECS errors)
- [ ] T108 [P] Implement rate limiting for test submissions (max 10 tests per user per hour)
- [ ] T109 [P] Add telemetry and analytics tracking (test submission rate, success rate, avg execution time)
- [ ] T110 [P] Create admin dashboard for monitoring system health (queue length, ECS capacity, S3 usage)
- [ ] T111 Code cleanup and refactoring (extract common utilities, remove duplicate code)
- [ ] T112 Performance optimization (cache deployment package templates, reuse ECS task definitions)
- [ ] T113 Security audit (validate all inputs, check for injection attacks, verify IAM permissions)
- [ ] T114 Update documentation in docs/ (architecture diagram, API reference, troubleshooting guide)
- [ ] T115 Run quickstart.md end-to-end validation (deploy to fresh AWS account, verify all steps work)
- [ ] T116 [P] Remove old dockerService.ts and realAgentTesting.ts simulation code
- [ ] T117 Add CloudWatch alarms for critical metrics (queue length >20, test failure rate >10%, ECS task failures)
- [ ] T118 Implement cost monitoring dashboard (ECS Fargate costs, S3 storage costs, CloudWatch Logs costs)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3 → P4)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Requires US1 test completion for package generation, but independently testable with mock data
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Enhances US1 with real-time monitoring, but US1 works without it
- **User Story 4 (P4)**: Can start after Foundational (Phase 2) - Adds retry/cancel on top of US1, but US1 works without it

### Within Each User Story

- Backend API implementation before frontend UI
- Convex schema changes before mutations/queries
- AWS client setup before orchestration logic
- Core functionality before error handling
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T003, T004)
- All Foundational schema tasks can run in parallel (T006, T007)
- All Foundational AWS client setup can run in parallel (T010, T011)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- Backend and frontend tasks within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Backend API tasks (parallel):
Task T014: "Create convex/testExecution.ts with submitTest mutation"
Task T015: "Create convex/testQueue.ts with addToQueue mutation"

# Backend container tasks (parallel):
Task T019: "Create convex/containerOrchestrator.ts with startEcsTask"

# Frontend UI tasks (parallel after backend API):
Task T029: "Create src/components/TestExecutionPanel.tsx"
Task T030: "Create src/hooks/useTestSubmit.ts"
Task T033: "Create src/components/TestResultsView.tsx"
Task T034: "Create src/hooks/useTestQuery.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (AWS infrastructure, dependencies)
2. Complete Phase 2: Foundational (database schema, AWS clients) - CRITICAL blocking phase
3. Complete Phase 3: User Story 1 (test submission, ECS execution, results display)
4. **STOP and VALIDATE**: Submit test → Verify ECS runs → Check results
5. Deploy/demo basic testing capability

**Estimated Time**: 2-3 days for experienced developer

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (Day 1)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!) (Day 2-3)
3. Add User Story 2 → Test independently → Deploy/Demo (add deployment packages) (Day 4)
4. Add User Story 3 → Test independently → Deploy/Demo (add real-time monitoring) (Day 5)
5. Add User Story 4 → Test independently → Deploy/Demo (add retry/cancel) (Day 6)
6. Polish & optimize → Production ready (Day 7)

### Parallel Team Strategy

With 3 developers:

1. Team completes Setup + Foundational together (Day 1)
2. Once Foundational is done:
   - Developer A: User Story 1 (backend + frontend for test execution)
   - Developer B: User Story 2 (backend + frontend for deployment packages)
   - Developer C: User Story 3 (backend + frontend for monitoring)
3. Stories complete in parallel (Day 2-3)
4. Integrate and test together (Day 4)
5. Developer A: User Story 4 (Day 5)
6. All: Polish & optimize (Day 6)

**Estimated Time**: 6 days with 3 developers

---

## Task Summary

**Total Tasks**: 118
- Setup: 4 tasks
- Foundational: 9 tasks (BLOCKS user stories)
- User Story 1 (P1 - MVP): 23 tasks
- User Story 2 (P2): 25 tasks
- User Story 3 (P3): 22 tasks
- User Story 4 (P4): 23 tasks
- Polish: 12 tasks

**Task Count Per User Story**:
- US1 (Test in Isolated Environment): 23 tasks - 🎯 **MVP SCOPE**
- US2 (Download Deployment Artifacts): 25 tasks
- US3 (Monitor Test Execution): 22 tasks
- US4 (Retry and Manage Tests): 23 tasks

**Parallel Opportunities Identified**: 35+ tasks marked [P] for parallel execution

**Independent Test Criteria**:
- **US1**: Submit test → ECS executes → Results displayed (no Docker spawn errors)
- **US2**: Complete test → Click download → ZIP contains all files
- **US3**: Submit test → Logs stream in real-time → Status updates visible
- **US4**: Fail test → Retry → Cancel running test → View history

**Suggested MVP Scope**: Phase 1 (Setup) + Phase 2 (Foundational) + Phase 3 (User Story 1 only)
- Delivers core value: containerized agent testing without Docker spawn errors
- Estimated 2-3 days for experienced developer
- Can demo and validate before adding additional features

---

## Notes

- [P] tasks = different files, no dependencies within same phase
- [Story] label (US1, US2, US3, US4) maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Follow quickstart.md for AWS setup and environment configuration
- Refer to contracts/*.yaml for API endpoint specifications
- Refer to data-model.md for database schema details
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
