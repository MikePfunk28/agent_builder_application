/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentBuilderPrompts from "../agentBuilderPrompts.js";
import type * as agentBuilderWorkflow from "../agentBuilderWorkflow.js";
import type * as agentCapabilities from "../agentCapabilities.js";
import type * as agentCoreTester from "../agentCoreTester.js";
import type * as agentTemplates from "../agentTemplates.js";
import type * as agentValidation from "../agentValidation.js";
import type * as agentcoreDeployment from "../agentcoreDeployment.js";
import type * as agentcoreMCP from "../agentcoreMCP.js";
import type * as agentcoreSetup from "../agentcoreSetup.js";
import type * as agentcoreTestExecution from "../agentcoreTestExecution.js";
import type * as agents from "../agents.js";
import type * as apiKeys from "../apiKeys.js";
import type * as auditLogs from "../auditLogs.js";
import type * as auth from "../auth.js";
import type * as authDebug from "../authDebug.js";
import type * as authErrorHandler from "../authErrorHandler.js";
import type * as awsAuth from "../awsAuth.js";
import type * as awsCrossAccount from "../awsCrossAccount.js";
import type * as awsDeployment from "../awsDeployment.js";
import type * as awsDeploymentFlow from "../awsDeploymentFlow.js";
import type * as awsDeploymentSetup from "../awsDeploymentSetup.js";
import type * as awsDiagramGenerator from "../awsDiagramGenerator.js";
import type * as awsFederatedIdentity from "../awsFederatedIdentity.js";
import type * as cdkGenerator from "../cdkGenerator.js";
import type * as cloudFormationGenerator from "../cloudFormationGenerator.js";
import type * as codeGenerator from "../codeGenerator.js";
import type * as cognitoAuth from "../cognitoAuth.js";
import type * as constants from "../constants.js";
import type * as containerOrchestrator from "../containerOrchestrator.js";
import type * as conversations from "../conversations.js";
import type * as crons from "../crons.js";
import type * as debuggingAgent from "../debuggingAgent.js";
import type * as deploymentPackageGenerator from "../deploymentPackageGenerator.js";
import type * as deploymentRouter from "../deploymentRouter.js";
import type * as deployments from "../deployments.js";
import type * as diagramGenerator from "../diagramGenerator.js";
import type * as dockerService from "../dockerService.js";
import type * as envValidator from "../envValidator.js";
import type * as errorLogging from "../errorLogging.js";
import type * as guardrails from "../guardrails.js";
import type * as http from "../http.js";
import type * as interleavedReasoning from "../interleavedReasoning.js";
import type * as lambdaTesting from "../lambdaTesting.js";
import type * as lib_aws_cloudwatchClient from "../lib/aws/cloudwatchClient.js";
import type * as lib_aws_ecsClient from "../lib/aws/ecsClient.js";
import type * as lib_aws_s3Client from "../lib/aws/s3Client.js";
import type * as lib_cloudFormationGenerator from "../lib/cloudFormationGenerator.js";
import type * as lib_comprehensiveModelCatalog from "../lib/comprehensiveModelCatalog.js";
import type * as lib_dynamicModelSwitching from "../lib/dynamicModelSwitching.js";
import type * as lib_fileGenerators from "../lib/fileGenerators.js";
import type * as lib_multiPlatformModelSelection from "../lib/multiPlatformModelSelection.js";
import type * as lib_stateValidation from "../lib/stateValidation.js";
import type * as lib_unifiedModalitySwitching from "../lib/unifiedModalitySwitching.js";
import type * as maintenance from "../maintenance.js";
import type * as mcpClient from "../mcpClient.js";
import type * as mcpConfig from "../mcpConfig.js";
import type * as mcpFileUpload from "../mcpFileUpload.js";
import type * as memory from "../memory.js";
import type * as memoryData from "../memoryData.js";
import type * as metaAgent from "../metaAgent.js";
import type * as metaAgentWorkflow from "../metaAgentWorkflow.js";
import type * as metaTooling from "../metaTooling.js";
import type * as modelBenchmarks from "../modelBenchmarks.js";
import type * as modelRegistry from "../modelRegistry.js";
import type * as packageMutations from "../packageMutations.js";
import type * as platformValue from "../platformValue.js";
import type * as queueProcessor from "../queueProcessor.js";
import type * as realAgentTesting from "../realAgentTesting.js";
import type * as router from "../router.js";
import type * as strandsAgentExecution from "../strandsAgentExecution.js";
import type * as strandsAgentExecutionDynamic from "../strandsAgentExecutionDynamic.js";
import type * as templates from "../templates.js";
import type * as testExecution from "../testExecution.js";
import type * as toolRegistry from "../toolRegistry.js";
import type * as types_tools from "../types/tools.js";
import type * as unifiedAgentExecution from "../unifiedAgentExecution.js";
import type * as unifiedAgentExecutionTest from "../unifiedAgentExecutionTest.js";
import type * as userAWSAccounts from "../userAWSAccounts.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  agentBuilderPrompts: typeof agentBuilderPrompts;
  agentBuilderWorkflow: typeof agentBuilderWorkflow;
  agentCapabilities: typeof agentCapabilities;
  agentCoreTester: typeof agentCoreTester;
  agentTemplates: typeof agentTemplates;
  agentValidation: typeof agentValidation;
  agentcoreDeployment: typeof agentcoreDeployment;
  agentcoreMCP: typeof agentcoreMCP;
  agentcoreSetup: typeof agentcoreSetup;
  agentcoreTestExecution: typeof agentcoreTestExecution;
  agents: typeof agents;
  apiKeys: typeof apiKeys;
  auditLogs: typeof auditLogs;
  auth: typeof auth;
  authDebug: typeof authDebug;
  authErrorHandler: typeof authErrorHandler;
  awsAuth: typeof awsAuth;
  awsCrossAccount: typeof awsCrossAccount;
  awsDeployment: typeof awsDeployment;
  awsDeploymentFlow: typeof awsDeploymentFlow;
  awsDeploymentSetup: typeof awsDeploymentSetup;
  awsDiagramGenerator: typeof awsDiagramGenerator;
  awsFederatedIdentity: typeof awsFederatedIdentity;
  cdkGenerator: typeof cdkGenerator;
  cloudFormationGenerator: typeof cloudFormationGenerator;
  codeGenerator: typeof codeGenerator;
  cognitoAuth: typeof cognitoAuth;
  constants: typeof constants;
  containerOrchestrator: typeof containerOrchestrator;
  conversations: typeof conversations;
  crons: typeof crons;
  debuggingAgent: typeof debuggingAgent;
  deploymentPackageGenerator: typeof deploymentPackageGenerator;
  deploymentRouter: typeof deploymentRouter;
  deployments: typeof deployments;
  diagramGenerator: typeof diagramGenerator;
  dockerService: typeof dockerService;
  envValidator: typeof envValidator;
  errorLogging: typeof errorLogging;
  guardrails: typeof guardrails;
  http: typeof http;
  interleavedReasoning: typeof interleavedReasoning;
  lambdaTesting: typeof lambdaTesting;
  "lib/aws/cloudwatchClient": typeof lib_aws_cloudwatchClient;
  "lib/aws/ecsClient": typeof lib_aws_ecsClient;
  "lib/aws/s3Client": typeof lib_aws_s3Client;
  "lib/cloudFormationGenerator": typeof lib_cloudFormationGenerator;
  "lib/comprehensiveModelCatalog": typeof lib_comprehensiveModelCatalog;
  "lib/dynamicModelSwitching": typeof lib_dynamicModelSwitching;
  "lib/fileGenerators": typeof lib_fileGenerators;
  "lib/multiPlatformModelSelection": typeof lib_multiPlatformModelSelection;
  "lib/stateValidation": typeof lib_stateValidation;
  "lib/unifiedModalitySwitching": typeof lib_unifiedModalitySwitching;
  maintenance: typeof maintenance;
  mcpClient: typeof mcpClient;
  mcpConfig: typeof mcpConfig;
  mcpFileUpload: typeof mcpFileUpload;
  memory: typeof memory;
  memoryData: typeof memoryData;
  metaAgent: typeof metaAgent;
  metaAgentWorkflow: typeof metaAgentWorkflow;
  metaTooling: typeof metaTooling;
  modelBenchmarks: typeof modelBenchmarks;
  modelRegistry: typeof modelRegistry;
  packageMutations: typeof packageMutations;
  platformValue: typeof platformValue;
  queueProcessor: typeof queueProcessor;
  realAgentTesting: typeof realAgentTesting;
  router: typeof router;
  strandsAgentExecution: typeof strandsAgentExecution;
  strandsAgentExecutionDynamic: typeof strandsAgentExecutionDynamic;
  templates: typeof templates;
  testExecution: typeof testExecution;
  toolRegistry: typeof toolRegistry;
  "types/tools": typeof types_tools;
  unifiedAgentExecution: typeof unifiedAgentExecution;
  unifiedAgentExecutionTest: typeof unifiedAgentExecutionTest;
  userAWSAccounts: typeof userAWSAccounts;
  users: typeof users;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
