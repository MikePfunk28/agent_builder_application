/**
 * Environment Variable Validator
 *
 * Validates that required environment variables are set at startup.
 * Prevents runtime errors from missing configuration.
 */

interface ValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Required environment variables for production deployment
 */
const REQUIRED_ENV_VARS = [
  'CONVEX_SITE_URL',
] as const;

/**
 * Optional OAuth provider environment variables
 * These are only required if the corresponding provider is being used
 */
const OAUTH_PROVIDER_VARS = {
  github: ['AUTH_GITHUB_ID', 'AUTH_GITHUB_SECRET'],
  google: ['AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET'],
  cognito: ['COGNITO_CLIENT_ID', 'COGNITO_CLIENT_SECRET', 'COGNITO_ISSUER_URL'],
} as const;

/**
 * AWS-related environment variables
 * Required if using AWS deployment features
 */
const AWS_DEPLOYMENT_VARS = [
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
] as const;

/**
 * Validates required environment variables
 *
 * @returns ValidationResult with list of missing variables and warnings
 */
export function validateEnvironment(): ValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  // Check OAuth providers - warn if partially configured
  for (const [provider, vars] of Object.entries(OAUTH_PROVIDER_VARS)) {
    const configured = vars.filter(v => process.env[v]);
    const unconfigured = vars.filter(v => !process.env[v]);

    if (configured.length > 0 && unconfigured.length > 0) {
      warnings.push(
        `OAuth provider "${provider}" is partially configured. ` +
        `Missing: ${unconfigured.join(', ')}. ` +
        `This provider will not work correctly.`
      );
    }
  }

  // Check AWS deployment vars - warn if partially configured
  const awsConfigured = AWS_DEPLOYMENT_VARS.filter(v => process.env[v]);
  const awsUnconfigured = AWS_DEPLOYMENT_VARS.filter(v => !process.env[v]);

  if (awsConfigured.length > 0 && awsUnconfigured.length > 0) {
    warnings.push(
      `AWS deployment is partially configured. ` +
      `Missing: ${awsUnconfigured.join(', ')}. ` +
      `AWS features will not work correctly.`
    );
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Validates environment and throws if critical variables are missing
 *
 * @throws Error if required environment variables are missing
 */
export function validateEnvironmentOrThrow(): void {
  const result = validateEnvironment();

  if (!result.valid) {
    throw new Error(
      `Missing required environment variables:\n` +
      result.missing.map(v => `  - ${v}`).join('\n') +
      `\n\nPlease set these variables in your .env.local file or deployment configuration.`
    );
  }

  // Log warnings but don't throw
  if (result.warnings.length > 0) {
    console.warn('Environment configuration warnings:');
    result.warnings.forEach(warning => console.warn(`  ⚠️  ${warning}`));
  }
}

/**
 * Checks if a specific OAuth provider is fully configured
 *
 * @param provider - The OAuth provider to check
 * @returns true if all required variables for the provider are set
 */
export function isOAuthProviderConfigured(
  provider: keyof typeof OAUTH_PROVIDER_VARS
): boolean {
  const vars = OAUTH_PROVIDER_VARS[provider];
  return vars.every(v => process.env[v]);
}

/**
 * Checks if AWS deployment is fully configured
 *
 * @returns true if all AWS deployment variables are set
 */
export function isAWSDeploymentConfigured(): boolean {
  return AWS_DEPLOYMENT_VARS.every(v => process.env[v]);
}

/**
 * Gets the current environment (development/production)
 *
 * @returns 'development' or 'production'
 */
export function getEnvironment(): 'development' | 'production' {
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}
