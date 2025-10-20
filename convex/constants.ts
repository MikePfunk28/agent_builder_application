/**
 * Shared Constants
 * Central location for all application constants
 */

/**
 * Deployment URLs for OAuth configuration
 */
export const DEPLOYMENT_URLS = {
  PRODUCTION: "https://resolute-kudu-325.convex.site",
  DEVELOPMENT: "https://unique-kookabura-922.convex.site",
} as const;

/**
 * Valid deployment types for agents
 */
export const DEPLOYMENT_TYPES = {
  AWS: "aws",
  OLLAMA: "ollama",
  DOCKER: "docker",
  AGENTCORE: "agentcore",
} as const;

export type DeploymentType = typeof DEPLOYMENT_TYPES[keyof typeof DEPLOYMENT_TYPES];

/**
 * Valid extras pip packages for strands-agents-tools
 */
export const VALID_EXTRAS_PIP = [
  "browser",
  "aws",
  "slack",
  "vision",
  "audio",
  "code_interpreter",
  "memory",
  "all",
] as const;

export type ExtrasPip = typeof VALID_EXTRAS_PIP[number];

/**
 * Default resource configurations
 */
export const DEFAULT_RESOURCES = {
  ECS_CPU: "256",
  ECS_MEMORY: "512",
  LOG_RETENTION_DAYS: 7,
  ECR_IMAGE_RETENTION: 10,
  CONTAINER_PORT: 8000,
} as const;

/**
 * Sanitize agent name for use in resource names
 */
export function sanitizeAgentName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

/**
 * Check if deployment type is AWS-based
 */
export function isAWSDeployment(deploymentType: string): boolean {
  return deploymentType === DEPLOYMENT_TYPES.AWS || 
         deploymentType === DEPLOYMENT_TYPES.AGENTCORE;
}

/**
 * Check if deployment type is container-based
 */
export function isContainerDeployment(deploymentType: string): boolean {
  return deploymentType === DEPLOYMENT_TYPES.DOCKER || 
         deploymentType === DEPLOYMENT_TYPES.OLLAMA;
}

/**
 * Test Constants
 * Constants used in test files for consistent test data
 */
export const TEST_CONSTANTS = {
  USERS: {
    AGENT_BUILDER: "test-agent-builder-user",
    ADMIN: "test-admin-user",
    REGULAR: "test-regular-user",
  },
  MODELS: {
    CLAUDE_SONNET: "anthropic.claude-3-5-sonnet-20241022-v2:0",
    CLAUDE_HAIKU: "anthropic.claude-3-5-haiku-20241022-v1:0",
    GPT_4: "gpt-4",
    NOVA_PRO: "amazon.nova-pro-v1:0",
    NOVA_LITE: "amazon.nova-lite-v1:0",
  },
  TOOLS: {
    SEARCH: {
      name: "web_search",
      type: "search",
      config: {
        description: "Search the web for information",
        parameters: [],
      },
    },
    CALCULATOR: {
      name: "calculator",
      type: "calculator",
      config: {
        description: "Perform mathematical calculations",
        parameters: [],
      },
    },
    FILE_READ: {
      name: "file_read",
      type: "file_system",
      config: {
        description: "Read file contents",
        parameters: [{ name: "path", type: "string", required: true }],
      },
    },
    FILE_WRITE: {
      name: "file_write",
      type: "file_system",
      config: {
        description: "Write content to a file",
        parameters: [
          { name: "path", type: "string", required: true },
          { name: "content", type: "string", required: true },
        ],
      },
    },
    HTTP_REQUEST: {
      name: "http_request",
      type: "http",
      config: {
        description: "Make HTTP requests",
        parameters: [
          { name: "url", type: "string", required: true },
          { name: "method", type: "string", required: false },
        ],
      },
    },
    BROWSER: {
      name: "browser",
      type: "browser",
      config: {
        description: "Interact with web browsers",
        parameters: [],
      },
      extrasPip: "browser" as const,
    },
  },
} as const;
