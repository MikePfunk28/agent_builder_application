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
import type * as dockerService from "../dockerService.js";
import type * as http from "../http.js";
import type * as modelRegistry from "../modelRegistry.js";
import type * as realAgentTesting from "../realAgentTesting.js";
import type * as router from "../router.js";
import type * as templates from "../templates.js";
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
  dockerService: typeof dockerService;
  http: typeof http;
  modelRegistry: typeof modelRegistry;
  realAgentTesting: typeof realAgentTesting;
  router: typeof router;
  templates: typeof templates;
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
