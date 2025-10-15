/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as agentcoreDeployment from "../agentcoreDeployment.js";
import type * as agents from "../agents.js";
import type * as auth from "../auth.js";
import type * as codeGenerator from "../codeGenerator.js";
import type * as containerOrchestrator from "../containerOrchestrator.js";
import type * as crons from "../crons.js";
import type * as deploymentPackageGenerator from "../deploymentPackageGenerator.js";
import type * as dockerService from "../dockerService.js";
import type * as http from "../http.js";
import type * as lib_aws_cloudwatchClient from "../lib/aws/cloudwatchClient.js";
import type * as lib_aws_ecsClient from "../lib/aws/ecsClient.js";
import type * as lib_aws_s3Client from "../lib/aws/s3Client.js";
import type * as lib_stateValidation from "../lib/stateValidation.js";
import type * as maintenance from "../maintenance.js";
import type * as modelRegistry from "../modelRegistry.js";
import type * as queueProcessor from "../queueProcessor.js";
import type * as realAgentTesting from "../realAgentTesting.js";
import type * as router from "../router.js";
import type * as templates from "../templates.js";
import type * as testExecution from "../testExecution.js";
import type * as toolRegistry from "../toolRegistry.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  agentcoreDeployment: typeof agentcoreDeployment;
  agents: typeof agents;
  auth: typeof auth;
  codeGenerator: typeof codeGenerator;
  containerOrchestrator: typeof containerOrchestrator;
  crons: typeof crons;
  deploymentPackageGenerator: typeof deploymentPackageGenerator;
  dockerService: typeof dockerService;
  http: typeof http;
  "lib/aws/cloudwatchClient": typeof lib_aws_cloudwatchClient;
  "lib/aws/ecsClient": typeof lib_aws_ecsClient;
  "lib/aws/s3Client": typeof lib_aws_s3Client;
  "lib/stateValidation": typeof lib_stateValidation;
  maintenance: typeof maintenance;
  modelRegistry: typeof modelRegistry;
  queueProcessor: typeof queueProcessor;
  realAgentTesting: typeof realAgentTesting;
  router: typeof router;
  templates: typeof templates;
  testExecution: typeof testExecution;
  toolRegistry: typeof toolRegistry;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
