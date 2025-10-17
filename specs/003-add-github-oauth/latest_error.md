   Test execution error: Error: [CONVEX A(realAgentTesting:executeRealAgentTest)] [Request ID: 8fa0a29ecaa166d9] Server Error
Uncaught uncaughtException: spawn docker ENOENT

  Called by client
Uncaught (in promise) Error: A listener indicated an asynchronous response by returning true, but the message channel closed before a response was receivedUnderstand this error
hook.js:608 [CONVEX A(realAgentTesting:executeRealAgentTest)] [Request ID: 8fa0a29ecaa166d9] Server Error
Uncaught uncaughtException: spawn docker ENOENT

========================================================================
   
   never disable something enabled or on by default, or take the easy path to fix     
  something, like creating a new file.  ALWAYS fix the original issue and file.      
  NEVER disable or try to subvert the error. 
  
  Be sure to pick a temporary directory that's on the same filesystem as× TypeScript typecheck via `tsc` failed.
To ignore failing typecheck, use `--typecheck=disable`.
convex/containerOrchestrator.ts:131:51 - error TS2339: Property 'containerOrchestrator' does not exist on type '{ templates: { seedTemplates: FunctionReference<"mutation", "internal", {}, string, string | undefined>; }; auth: { store: FunctionReference<"mutation", "internal", { args: { ...; } | ... 10 more ... | { ...; }; }, string | ... 3 more ... | null, string | undefined>; }; maintenance: { ...; }; queueProcessor: { ...; ...'.

131       await ctx.scheduler.runAfter(2000, internal.containerOrchestrator.pollLogs, {
                                                      ~~~~~~~~~~~~~~~~~~~~~
convex/containerOrchestrator.ts:138:59 - error TS2339: Property 'containerOrchestrator' does not exist on type '{ templates: { seedTemplates: FunctionReference<"mutation", "internal", {}, string, string | undefined>; }; auth: { store: FunctionReference<"mutation", "internal", { args: { ...; } | ... 10 more ... | { ...; }; }, string | ... 3 more ... | null, string | undefined>; }; maintenance: { ...; }; queueProcessor: { ...; ...'.

138       await ctx.scheduler.runAfter(args.timeout, internal.containerOrchestrator.handleTimeout, {
                                                              ~~~~~~~~~~~~~~~~~~~~~

convex/containerOrchestrator.ts:229:51 - error TS2339: Property 'containerOrchestrator' does not exist on type '{ templates: { seedTemplates: FunctionReference<"mutation", "internal", {}, string, string | undefined>; }; auth: { store: FunctionReference<"mutation", "internal", { args: { ...; } | ... 10 more ... | { ...; }; }, string | ... 3 more ... | null, string | undefined>; }; maintenance: { ...; }; queueProcessor: { ...; ...'.

229       await ctx.scheduler.runAfter(2000, internal.containerOrchestrator.pollLogs, {
                                                      ~~~~~~~~~~~~~~~~~~~~~

convex/containerOrchestrator.ts:242:81 - error TS2339: Property 'containerOrchestrator' does not exist on type '{ templates: { seedTemplates: FunctionReference<"mutation", "internal", {}, string, string | undefined>; }; auth: { store: FunctionReference<"mutation", "internal", { args: { ...; } | ... 10 more ... | { ...; }; }, string | ... 3 more ... | null, string | undefined>; }; maintenance: { ...; }; queueProcessor: { ...; ...'.

242         await ctx.scheduler.runAfter(Math.min(5000 * attempts, 15000), internal.containerOrchestrator.pollLogs, {
                                                                        
            ~~~~~~~~~~~~~~~~~~~~~

convex/deploymentPackageGenerator.ts:52:46 - error TS2339: Property 'deploymentPackageGenerator' does not exist on type '{ templates: { seedTemplates: FunctionReference<"mutation", "internal", {}, string, string | undefined>; }; auth: { store: FunctionReference<"mutation", "internal", { args: { ...; } | ... 10 more ... | { ...; }; }, string | ... 3 more ... | null, string | undefined>; }; maintenance: { ...; }; queueProcessor: { ...; ...'.

52     await ctx.scheduler.runAfter(0, internal.deploymentPackageGenerator.generatePackageAction, {
                                                ~~~~~~~~~~~~~~~~~~~~~~~~~~

convex/deploymentPackageGenerator.ts:92:49 - error TS2339: Property 'agents' does not exist on type '{ templates: { seedTemplates: FunctionReference<"mutation", "internal", {}, string, string | undefined>; }; auth: { store: FunctionReference<"mutation", "internal", { args: { ...; } | ... 10 more ... | { ...; }; }, string | ... 3 more ... | null, string | undefined>; }; maintenance: { ...; }; queueProcessor: { ...; ...'.

92       const agent = await ctx.runQuery(internal.agents.get, {        
                                                   ~~~~~~

convex/queueProcessor.ts:89:55 - error TS2339: Property 'containerOrchestrator' does not exist on type '{ templates: { seedTemplates: FunctionReference<"mutation", "internal", {}, string, string | undefined>; }; auth: { store: FunctionReference<"mutation", "internal", { args: { ...; } | ... 10 more ... | { ...; }; }, string | ... 3 more ... | null, string | undefined>; }; maintenance: { ...; }; queueProcessor: { ...; ...'.      

89           const result = await ctx.runAction(internal.containerOrchestrator.startTestContainer, {
                                                         ~~~~~~~~~~~~~~~~~~~~~

convex/testExecution.ts:241:48 - error TS2339: Property 'containerOrchestrator' does not exist on type '{ templates: { seedTemplates: FunctionReference<"mutation", "internal", {}, string, string | undefined>; }; auth: { store: FunctionReference<"mutation", "internal", { args: { ...; } | ... 10 more ... | { ...; }; }, string | ... 3 more ... | null, string | undefined>; }; maintenance: { ...; }; queueProcessor: { ...; ...'.      

241       await ctx.scheduler.runAfter(0, internal.containerOrchestrator.stopTestContainer, {
                                                   ~~~~~~~~~~~~~~~~~~~~~

Found 8 errors in 4 files.

Errors  Files
     4  convex/containerOrchestrator.ts:131
     2  convex/deploymentPackageGenerator.ts:52
     1  convex/queueProcessor.ts:89
     1  convex/testExecution.ts:241
PS M:\agent_builder_application> 


## Latest

× TypeScript typecheck via `tsc` failed.
To ignore failing typecheck, use `--typecheck=disable`.
convex/containerOrchestrator.ts:131:51 - error TS2339: Property 'containerOrchestrator' does not exist on type '{ templates: { seedTemplates: FunctionReference<"mutation", "internal", {}, string, string | undefined>; }; auth: { store: FunctionReference<"mutation", "internal", { args: { ...; } | ... 10 more ... | { ...; }; }, string | ... 3 more ... | null, string | undefined>; }; maintenance: { ...; }; queueProcessor: { ...; ...'.

131       await ctx.scheduler.runAfter(2000, internal.containerOrchestrator.pollLogs, {
                                                      ~~~~~~~~~~~~~~~~~~~~~
convex/containerOrchestrator.ts:138:59 - error TS2339: Property 'containerOrchestrator' does not exist on type '{ templates: { seedTemplates: FunctionReference<"mutation", "internal", {}, string, string | undefined>; }; auth: { store: FunctionReference<"mutation", "internal", { args: { ...; } | ... 10 more ... | { ...; }; }, string | ... 3 more ... | null, string | undefined>; }; maintenance: { ...; }; queueProcessor: { ...; ...'.

138       await ctx.scheduler.runAfter(args.timeout, internal.containerOrchestrator.handleTimeout, {
                                                              ~~~~~~~~~~~~~~~~~~~~~

convex/containerOrchestrator.ts:229:51 - error TS2339: Property 'containerOrchestrator' does not exist on type '{ templates: { seedTemplates: FunctionReference<"mutation", "internal", {}, string, string | undefined>; }; auth: { store: FunctionReference<"mutation", "internal", { args: { ...; } | ... 10 more ... | { ...; }; }, string | ... 3 more ... | null, string | undefined>; }; maintenance: { ...; }; queueProcessor: { ...; ...'.

229       await ctx.scheduler.runAfter(2000, internal.containerOrchestrator.pollLogs, {
                                                      ~~~~~~~~~~~~~~~~~~~~~

convex/containerOrchestrator.ts:242:81 - error TS2339: Property 'containerOrchestrator' does not exist on type '{ templates: { seedTemplates: FunctionReference<"mutation", "internal", {}, string, string | undefined>; }; auth: { store: FunctionReference<"mutation", "internal", { args: { ...; } | ... 10 more ... | { ...; }; }, string | ... 3 more ... | null, string | undefined>; }; maintenance: { ...; }; queueProcessor: { ...; ...'.

242         await ctx.scheduler.runAfter(Math.min(5000 * attempts, 15000), internal.containerOrchestrator.pollLogs, {
                                                                        
            ~~~~~~~~~~~~~~~~~~~~~

convex/deploymentPackageGenerator.ts:52:46 - error TS2339: Property 'deploymentPackageGenerator' does not exist on type '{ templates: { seedTemplates: FunctionReference<"mutation", "internal", {}, string, string | undefined>; }; auth: { store: FunctionReference<"mutation", "internal", { args: { ...; } | ... 10 more ... | { ...; }; }, string | ... 3 more ... | null, string | undefined>; }; maintenance: { ...; }; queueProcessor: { ...; ...'.

52     await ctx.scheduler.runAfter(0, internal.deploymentPackageGenerator.generatePackageAction, {
                                                ~~~~~~~~~~~~~~~~~~~~~~~~~~

convex/deploymentPackageGenerator.ts:92:49 - error TS2339: Property 'agents' does not exist on type '{ templates: { seedTemplates: FunctionReference<"mutation", "internal", {}, string, string | undefined>; }; auth: { store: FunctionReference<"mutation", "internal", { args: { ...; } | ... 10 more ... | { ...; }; }, string | ... 3 more ... | null, string | undefined>; }; maintenance: { ...; }; queueProcessor: { ...; ...'.

92       const agent = await ctx.runQuery(internal.agents.get, {        
                                                   ~~~~~~

convex/queueProcessor.ts:89:55 - error TS2339: Property 'containerOrchestrator' does not exist on type '{ templates: { seedTemplates: FunctionReference<"mutation", "internal", {}, string, string | undefined>; }; auth: { store: FunctionReference<"mutation", "internal", { args: { ...; } | ... 10 more ... | { ...; }; }, string | ... 3 more ... | null, string | undefined>; }; maintenance: { ...; }; queueProcessor: { ...; ...'.      

89           const result = await ctx.runAction(internal.containerOrchestrator.startTestContainer, {
                                                         ~~~~~~~~~~~~~~~~~~~~~

convex/testExecution.ts:241:48 - error TS2339: Property 'containerOrchestrator' does not exist on type '{ templates: { seedTemplates: FunctionReference<"mutation", "internal", {}, string, string | undefined>; }; auth: { store: FunctionReference<"mutation", "internal", { args: { ...; } | ... 10 more ... | { ...; }; }, string | ... 3 more ... | null, string | undefined>; }; maintenance: { ...; }; queueProcessor: { ...; ...'.      

241       await ctx.scheduler.runAfter(0, internal.containerOrchestrator.stopTestContainer, {
                                                   ~~~~~~~~~~~~~~~~~~~~~

Found 8 errors in 4 files.

Errors  Files
     4  convex/containerOrchestrator.ts:131
     2  convex/deploymentPackageGenerator.ts:52
     1  convex/queueProcessor.ts:89
     1  convex/testExecution.ts:241
- Collecting TypeScript errors
PS M:\agent_builder_application> 

## Latest 
× TypeScript typecheck via `tsc` failed.
To ignore failing typecheck, use `--typecheck=disable`.
convex/containerOrchestrator.ts:180:62 - error TS2339: Property 'getTestById' does not exist on type '{ getTestByIdInternal: FunctionReference<"query", "internal", { testId: Id<"testExecutions">; }, { _id: Id<"testExecutions">; _creationTime: number; ecsTaskArn?: string | undefined; ecsTaskId?: string | undefined; ... 28 more ...; submittedAt: number; } | null, string | undefined>; updateStatus: FunctionReference<.....'.        

180       const test = await ctx.runQuery(internal.testExecution.getTestById, { testId: args.testId });
                                                                 ~~~~~~~~~~~
convex/containerOrchestrator.ts:238:62 - error TS2339: Property 'getTestById' does not exist on type '{ getTestByIdInternal: FunctionReference<"query", "internal", { testId: Id<"testExecutions">; }, { _id: Id<"testExecutions">; _creationTime: number; ecsTaskArn?: string | undefined; ecsTaskId?: string | undefined; ... 28 more ...; submittedAt: number; } | null, string | undefined>; updateStatus: FunctionReference<.....'.        

238       const test = await ctx.runQuery(internal.testExecution.getTestById, { testId: args.testId });
                                                                 ~~~~~~~~~~~

convex/containerOrchestrator.ts:262:60 - error TS2339: Property 'getTestById' does not exist on type '{ getTestByIdInternal: FunctionReference<"query", "internal", { testId: Id<"testExecutions">; }, { _id: Id<"testExecutions">; _creationTime: number; ecsTaskArn?: string | undefined; ecsTaskId?: string | undefined; ... 28 more ...; submittedAt: number; } | null, string | undefined>; updateStatus: FunctionReference<.....'.        

262     const test = await ctx.runQuery(internal.testExecution.getTestById, { testId: args.testId });
                                                               ~~~~~~~~~~~

convex/queueProcessor.ts:24:47 - error TS2345: Argument of type 'FunctionReference<"action", "internal", {}, number, string | undefined>' is not assignable to parameter of type 'FunctionReference<"query", "public" | "internal">'.
  Type '"action"' is not assignable to type '"query"'.

24       const runningTests = await ctx.runQuery(internal.queueProcessor.getRunningTestsCount);
                                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

convex/queueProcessor.ts:35:44 - error TS2345: Argument of type 'FunctionReference<"action", "internal", { limit: number; }, any[], string | undefined>' is not assignable to parameter of type 'FunctionReference<"query", "public" | "internal">'.
  Type '"action"' is not assignable to type '"query"'.

35       const nextTests = await ctx.runQuery(internal.queueProcessor.getNextPendingTests, {
                                              ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

convex/realAgentTesting.ts:18:14 - error TS7022: 'executeRealAgentTest' implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer.

18 export const executeRealAgentTest = action({
                ~~~~~~~~~~~~~~~~~~~~

convex/realAgentTesting.ts:27:3 - error TS7023: 'handler' implicitly has return type 'any' because it does not have a return type annotation and is referenced directly or indirectly in one of its return expressions. 

27   handler: async (ctx, args) => {
     ~~~~~~~

convex/realAgentTesting.ts:30:13 - error TS7022: 'agent' implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer.

30       const agent = await findOrCreateTestAgent(ctx, args);
               ~~~~~
convex/realAgentTesting.ts:33:13 - error TS7022: 'result' implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer.

33       const result = await ctx.runMutation(api.testExecution.submitTest, {
               ~~~~~~

convex/realAgentTesting.ts:45:15 - error TS7022: 'test' implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer.

45         const test = await ctx.runQuery(api.testExecution.getTestById, {
                 ~~~~

convex/realAgentTesting.ts:105:16 - error TS7023: 'findOrCreateTestAgent' implicitly has return type 'any' because it does not have a return type annotation and is referenced directly or indirectly in one of its return expressions.

105 async function findOrCreateTestAgent(ctx: any, args: any) {
                   ~~~~~~~~~~~~~~~~~~~~~

convex/realAgentTesting.ts:117:9 - error TS7022: 'agentId' implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer.

117   const agentId = await ctx.runMutation(api.realAgentTesting.createTempAgent, {
            ~~~~~~~

convex/realAgentTesting.ts:171:14 - error TS7022: 'streamTestLogs' implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer.

171 export const streamTestLogs = action({
                 ~~~~~~~~~~~~~~

convex/realAgentTesting.ts:175:3 - error TS7023: 'handler' implicitly has return type 'any' because it does not have a return type annotation and is referenced directly or indirectly in one of its return expressions.

175   handler: async (ctx, args) => {
      ~~~~~~~

convex/realAgentTesting.ts:176:11 - error TS7022: 'test' implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer.

176     const test = await ctx.runQuery(api.testExecution.getTestById, {
              ~~~~

convex/realAgentTesting.ts:199:14 - error TS7022: 'getAgentTestHistory' implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer.

199 export const getAgentTestHistory = action({
                 ~~~~~~~~~~~~~~~~~~~

convex/realAgentTesting.ts:203:3 - error TS7023: 'handler' implicitly has return type 'any' because it does not have a return type annotation and is referenced directly or indirectly in one of its return expressions.

203   handler: async (ctx, args) => {
      ~~~~~~~

convex/realAgentTesting.ts:205:11 - error TS7022: 'tests' implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer.

205     const tests = await ctx.runQuery(api.realAgentTesting.queryAgentTests, {
              ~~~~~

convex/realAgentTesting.ts:209:22 - error TS7006: Parameter 'test' implicitly has an 'any' type.

209     return tests.map(test => ({
                         ~~~~

convex/realAgentTesting.ts:221:14 - error TS7022: 'queryAgentTests' implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer.

221 export const queryAgentTests = action({
                 ~~~~~~~~~~~~~~~

convex/realAgentTesting.ts:225:3 - error TS7023: 'handler' implicitly has return type 'any' because it does not have a return type annotation and is referenced directly or indirectly in one of its return expressions.

225   handler: async (ctx, args) => {
      ~~~~~~~

convex/realAgentTesting.ts:231:11 - error TS7022: 'tests' implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer.

231     const tests = await ctx.runQuery(api.realAgentTesting.getAgentTestsInternal, {
              ~~~~~

Found 22 errors in 3 files.

Errors  Files
     3  convex/containerOrchestrator.ts:180
     2  convex/queueProcessor.ts:24
    17  convex/realAgentTesting.ts:18
PS M:\agent_builder_application> 