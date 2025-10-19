/**
 * Application Constants
 *
 * Central location for all configuration constants, URLs, and magic strings.
 * This prevents hardcoding values throughout the codebase.
 */

/**
 * Deployment URLs and endpoints
 */
export const DEPLOYMENT_URLS = {
  /**
   * Production Convex site URL
   * Falls back to hardcoded production URL if env var not set
   */
  get PRODUCTION(): string {
    return process.env.CONVEX_SITE_URL || "https://resolute-kudu-325.convex.site";
  },

  /**
   * Development Convex site URL
   */
  get DEVELOPMENT(): string {
    return process.env.CONVEX_SITE_URL || "http://localhost:5173";
  },

  /**
   * Current environment URL based on NODE_ENV
   */
  get CURRENT(): string {
    return process.env.NODE_ENV === 'production'
      ? this.PRODUCTION
      : this.DEVELOPMENT;
  },

  /**
   * OAuth callback URLs for different providers
   */
  get OAUTH_CALLBACKS() {
    const baseUrl = this.PRODUCTION;
    return {
      github: `${baseUrl}/api/auth/callback/github`,
      google: `${baseUrl}/api/auth/callback/google`,
      cognito: `${baseUrl}/api/auth/callback/cognito`,
    };
  },

  /**
   * Frontend URLs
   */
  FRONTEND: {
    PRODUCTION: "https://ai-forge.mikepfunk.com",
    DEVELOPMENT: "http://localhost:5173",
  },

  /**
   * API endpoints
   */
  API: {
    PRODUCTION: "https://api.mikepfunk.com",
    DEVELOPMENT: "http://localhost:3000",
  },
} as const;

/**
 * OAuth Provider Constants
 */
export const OAUTH_PROVIDERS = {
  GITHUB: 'github',
  GOOGLE: 'google',
  COGNITO: 'cognito',
  PASSWORD: 'password',
} as const;

/**
 * User Tier Constants
 */
export const USER_TIERS = {
  FREEMIUM: 'freemium',
  PERSONAL: 'personal',
  ENTERPRISE: 'enterprise',
} as const;

/**
 * Model Registry Constants
 */
export const MODEL_CONSTANTS = {
  CLAUDE_SONNET: "anthropic.claude-3-5-sonnet-20241022-v2:0",
  CLAUDE_HAIKU: "anthropic.claude-3-5-haiku-20241022-v1:0",
  GPT_4: "gpt-4",
  GPT_4_TURBO: "gpt-4-turbo",
  LLAMA_3_8B: "llama3.2:8b-instruct-q8_0",
  LLAMA_3_70B: "llama3.1:70b-instruct-q4_0",
} as const;

/**
 * Deployment Type Constants
 */
export const DEPLOYMENT_TYPES = {
  AWS: 'aws',
  DOCKER: 'docker',
  OLLAMA: 'ollama',
  LOCAL: 'local',
} as const;

/**
 * Deployment Status Constants
 */
export const DEPLOYMENT_STATUS = {
  CREATING: 'CREATING',
  ACTIVE: 'ACTIVE',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  PENDING: 'pending',
  ERROR: 'error',
} as const;

/**
 * MCP Server Status Constants
 */
export const MCP_SERVER_STATUS = {
  UNKNOWN: 'unknown',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
  DISABLED: 'disabled',
} as const;

/**
 * AWS Region Constants
 */
export const AWS_REGIONS = {
  US_EAST_1: 'us-east-1',
  US_WEST_2: 'us-west-2',
  EU_WEST_1: 'eu-west-1',
} as const;

/**
 * Test Constants
 * Used across test files to ensure consistency
 */
export const TEST_CONSTANTS = {
  USERS: {
    AGENT_BUILDER: 'test-user-agent-builder',
    MCP: 'test-user-mcp',
    GITHUB: 'test-user-github',
    GOOGLE: 'test-user-google',
  },

  MODELS: MODEL_CONSTANTS,

  PROVIDERS: OAUTH_PROVIDERS,

  TIERS: USER_TIERS,

  MCP_SERVERS: {
    AWS_DIAGRAM: 'aws-diagram-generator',
    FILE_SYSTEM: 'filesystem',
    GITHUB: 'github',
  },

  TOOLS: {
    SEARCH: { name: 'search', type: 'search', config: {} },
    CALCULATOR: { name: 'calculator', type: 'calculator', config: {} },
    FILE_READ: { name: 'file_read', type: 'file_read', config: {} },
    FILE_WRITE: { name: 'file_write', type: 'file_write', config: {} },
    HTTP_REQUEST: { name: 'http_request', type: 'http_request', config: {} },
    BROWSER: { name: 'browser', type: 'browser', config: {}, extrasPip: 'browser' },
  },
} as const;

/**
 * Error Logging Constants
 */
export const ERROR_CATEGORIES = {
  MCP: 'mcp',
  DEPLOYMENT: 'deployment',
  AUTHENTICATION: 'authentication',
  AGENT: 'agent',
  SYSTEM: 'system',
} as const;

export const ERROR_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
} as const;

/**
 * Retry Configuration Constants
 */
export const RETRY_CONFIG = {
  DEFAULT_MAX_RETRIES: 3,
  DEFAULT_INITIAL_DELAY_MS: 1000,
  DEFAULT_MAX_DELAY_MS: 10000,
  DEFAULT_BACKOFF_MULTIPLIER: 2,
} as const;

/**
 * Timeout Constants (milliseconds)
 */
export const TIMEOUTS = {
  MCP_DEFAULT: 30000, // 30 seconds
  AWS_DEPLOYMENT: 300000, // 5 minutes
  AGENT_EXECUTION: 60000, // 1 minute
  HTTP_REQUEST: 10000, // 10 seconds
} as const;
