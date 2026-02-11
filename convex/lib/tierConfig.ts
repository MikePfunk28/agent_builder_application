/**
 * Tier Configuration - Single Source of Truth
 *
 * Consolidates tier limits previously scattered across:
 * - convex/apiKeys.ts (getTierLimits)
 * - convex/agentcoreSetup.ts (inline limits)
 * - convex/testExecution.ts (FREE_TESTS_PER_MONTH constants)
 * - convex/agentcoreTestExecution.ts (inline limits)
 *
 * ALL tier-related constants must be imported from this file.
 * Do NOT define tier limits anywhere else.
 */

import { UserRole } from "../users";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TierName = "freemium" | "personal" | "enterprise";

export type AllowedProvider = "ollama" | "lmstudio" | "bedrock";

export interface TierConfig {
  /** Display name for UI */
  displayName: string;
  /** Monthly price in USD (0 for free) */
  monthlyPriceUsd: number;
  /** Max cloud executions per billing period (-1 = unlimited) */
  monthlyExecutions: number;
  /** Max agents a user can create */
  maxAgents: number;
  /** Max concurrent test executions */
  maxConcurrentTests: number;
  /** Cost per execution past monthly limit (0 = no overage, hard stop) */
  overageCostPerExecution: number;
  /** Whether overage is allowed (personal = yes, others = no) */
  allowOverage: boolean;
  /** Model providers accessible at this tier */
  allowedProviders: AllowedProvider[];
  /** Bedrock model families accessible (empty = none) */
  allowedBedrockFamilies: string[];
  /** Feature flags */
  features: {
    bedrockAccess: boolean;
    customDeployment: boolean;
    prioritySupport: boolean;
    advancedAnalytics: boolean;
  };
}

// ─── Configuration ───────────────────────────────────────────────────────────

export const TIER_CONFIGS: Record<TierName, TierConfig> = {
  freemium: {
    displayName: "Free",
    monthlyPriceUsd: 0,
    monthlyExecutions: 50,
    maxAgents: 5,
    maxConcurrentTests: 1,
    overageCostPerExecution: 0,
    allowOverage: false,
    allowedProviders: ["ollama", "lmstudio"],
    allowedBedrockFamilies: [],
    features: {
      bedrockAccess: false,
      customDeployment: false,
      prioritySupport: false,
      advancedAnalytics: false,
    },
  },
  personal: {
    displayName: "Personal",
    monthlyPriceUsd: 5,
    monthlyExecutions: 100,
    maxAgents: 50,
    maxConcurrentTests: 5,
    overageCostPerExecution: 0.05,
    allowOverage: true,
    allowedProviders: ["ollama", "lmstudio", "bedrock"],
    allowedBedrockFamilies: [
      "claude-haiku",
      "claude-sonnet",
      "amazon-nova",
      "cohere",
      "mistral",
    ],
    features: {
      bedrockAccess: true,
      customDeployment: true,
      prioritySupport: false,
      advancedAnalytics: false,
    },
  },
  enterprise: {
    displayName: "Enterprise",
    monthlyPriceUsd: -1, // Contact us
    monthlyExecutions: -1, // Unlimited
    maxAgents: 500,
    maxConcurrentTests: 20,
    overageCostPerExecution: 0,
    allowOverage: false,
    allowedProviders: ["ollama", "lmstudio", "bedrock"],
    allowedBedrockFamilies: ["*"], // All models
    features: {
      bedrockAccess: true,
      customDeployment: true,
      prioritySupport: true,
      advancedAnalytics: true,
    },
  },
};

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Get the tier configuration for a given tier name.
 * Falls back to freemium if tier is unknown.
 */
export function getTierConfig( tier: string | undefined | null ): TierConfig {
  const name = ( tier ?? "freemium" ) as TierName;
  return TIER_CONFIGS[name] ?? TIER_CONFIGS.freemium;
}

/**
 * Check if a model provider is allowed for a given tier.
 */
export function isProviderAllowedForTier(
  tier: string | undefined | null,
  provider: string
): boolean {
  const config = getTierConfig( tier );
  return config.allowedProviders.includes( provider as AllowedProvider );
}

/**
 * Check if a specific Bedrock model family is allowed for a tier.
 * Matches against the model ID string (e.g., "claude-haiku" matches "anthropic.claude-haiku-4-5-...")
 */
export function isBedrockModelAllowedForTier(
  tier: string | undefined | null,
  modelId: string
): boolean {
  const config = getTierConfig( tier );
  if ( !config.features.bedrockAccess ) {
    return false;
  }
  // Enterprise gets all models
  if ( config.allowedBedrockFamilies.includes( "*" ) ) {
    return true;
  }
  // Check if model ID contains any allowed family
  const lowerModelId = modelId.toLowerCase();
  return config.allowedBedrockFamilies.some(
    ( family ) => lowerModelId.includes( family.toLowerCase() )
  );
}

/**
 * Check if the user is within their execution limit.
 * Returns { allowed, remaining, overageAllowed }
 */
export function checkExecutionLimit(
  tier: string | undefined | null,
  currentCount: number
): { allowed: boolean; remaining: number; overageAllowed: boolean } {
  const config = getTierConfig( tier );

  // Unlimited tier
  if ( config.monthlyExecutions === -1 ) {
    return { allowed: true, remaining: -1, overageAllowed: false };
  }

  const remaining = config.monthlyExecutions - currentCount;

  // Within limit
  if ( remaining > 0 ) {
    return { allowed: true, remaining, overageAllowed: config.allowOverage };
  }

  // Past limit - check if overage is allowed
  if ( config.allowOverage ) {
    return { allowed: true, remaining: 0, overageAllowed: true };
  }

  return { allowed: false, remaining: 0, overageAllowed: false };
}

/**
 * Map a UserRole to the corresponding tier name.
 * Used to reconcile the role-based permission system with the tier billing system.
 */
export function getTierForRole( role: string | undefined | null ): TierName {
  switch ( role ) {
    case UserRole.PAID:
      // Both personal and enterprise subscribers get PAID role.
      // The actual tier is stored on the user record's "tier" field.
      // This returns "personal" as the minimum tier for any paid user.
      return "personal";
    case UserRole.ENTERPRISE:
      return "enterprise";
    case UserRole.ADMIN:
      // Platform operator gets enterprise-level access
      return "enterprise";
    case UserRole.USER:
    case UserRole.GUEST:
    default:
      return "freemium";
  }
}

/**
 * Get the UserRole that should be assigned when subscribing to a tier.
 *
 * ADMIN role is reserved for platform operators only — never auto-assigned
 * through billing. Enterprise subscribers get the ENTERPRISE role, which
 * has higher permissions than PAID but is NOT admin.
 */
export function getRoleForTier( tier: TierName ): string {
  switch ( tier ) {
    case "personal":
      return UserRole.PAID;
    case "enterprise":
      return UserRole.ENTERPRISE;
    case "freemium":
    default:
      return UserRole.USER;
  }
}

/**
 * Format the tier limits as a human-readable error message for upgrade prompts.
 */
export function getUpgradeMessage( tier: string | undefined | null ): string {
  if ( tier === "enterprise" ) {
    return "Enterprise tier — contact support if you need higher limits.";
  }
  const config = getTierConfig( tier );
  const nextTier = tier === "freemium" ? "Personal" : "Enterprise";
  const price = tier === "freemium" ? "$5/month" : "Contact us";
  return (
    `${config.displayName} tier limit reached. ` +
    `Upgrade to ${nextTier} (${price}) for more capacity!`
  );
}
