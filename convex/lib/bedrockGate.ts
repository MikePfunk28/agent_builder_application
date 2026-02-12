/**
 * Centralized Bedrock Access Gate
 *
 * Single module that enforces tier-based access to Bedrock models.
 * Call requireBedrockAccess() or requireBedrockAccessForUser() BEFORE
 * any Bedrock API invocation.
 *
 * ALL Bedrock gating decisions go through this module.
 * Do NOT add scattered tier checks in individual action files.
 *
 * Imports tier logic from tierConfig.ts (the single source of truth for
 * tier limits and allowed providers/models).
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";
import {
  isProviderAllowedForTier,
  isBedrockModelAllowedForTier,
  checkExecutionLimit,
  getUpgradeMessage,
  getTierConfig,
  type TierName,
} from "./tierConfig";

// ─── Result Types ────────────────────────────────────────────────────────────

export interface BedrockAccessGranted {
  allowed: true;
  userId: Id<"users">;
  tier: TierName;
}

export interface BedrockAccessDenied {
  allowed: false;
  reason: string;
  upgradeMessage: string;
}

export type BedrockGateResult = BedrockAccessGranted | BedrockAccessDenied;

// ─── Variant A: JWT-authenticated callers ────────────────────────────────────

/**
 * Gate for action handlers where the CALLER is the authenticated user.
 *
 * 1. Validates JWT via getAuthUserId(ctx) (Convex handles JWT verification)
 * 2. Looks up user record to read tier
 * 3. Checks provider access, model family, and execution limits
 *
 * @param ctx       Convex action/query/mutation context (must have ctx.auth)
 * @param modelId   The Bedrock model ID being requested (optional — skips
 *                  model-family check if omitted)
 * @param userLookup  Function that fetches a user document by ID.
 *                    Typically: `(args) => ctx.runQuery(internal.users.getInternal, args)`
 */
export async function requireBedrockAccess(
  ctx: any,
  modelId: string | undefined,
  userLookup: ( args: { id: any } ) => Promise<any>,
): Promise<BedrockGateResult> {
  // 1. Authenticate via JWT
  const userId = await getAuthUserId( ctx );
  if ( !userId ) {
    return {
      allowed: false,
      reason: "Authentication required to use cloud AI models. Please sign in.",
      upgradeMessage: "Sign in to continue.",
    };
  }

  // 2. Look up user record
  const user = await userLookup( { id: userId } );
  if ( !user ) {
    return {
      allowed: false,
      reason: "User record not found. Please sign in again.",
      upgradeMessage: "Sign in to continue.",
    };
  }

  // 3. Delegate to the user-doc variant
  const result = await requireBedrockAccessForUser( user, modelId );
  if ( result.allowed ) {
    // Override userId with the real authenticated user ID
    return { ...result, userId };
  }
  return result;
}

// ─── Variant B: Internal callers with a pre-fetched user doc ─────────────────

/**
 * Gate for internal actions that already have the user document
 * (e.g., looked up via agent.createdBy).
 *
 * Same tier/model/limit checks, also blocks anonymous users.
 *
 * @param userDoc   User document from the users table (or null)
 * @param modelId   Optional Bedrock model ID for family-level gating
 */
export async function requireBedrockAccessForUser(
  userDoc: {
    _id?: any;
    tier?: string;
    executionsThisMonth?: number;
    isAnonymous?: boolean;
    subscriptionStatus?: string;
    currentPeriodEnd?: number;
  } | null,
  modelId?: string,
): Promise<BedrockGateResult> {
  if ( !userDoc ) {
    return {
      allowed: false,
      reason: "User record not found.",
      upgradeMessage: "Please sign in again.",
    };
  }

  // Block anonymous users from Bedrock
  if ( userDoc.isAnonymous ) {
    return {
      allowed: false,
      reason: "Anonymous users cannot access cloud AI models. Please create an account.",
      upgradeMessage: "Create an account to access Bedrock models.",
    };
  }

  const tier = ( userDoc.tier || "freemium" ) as TierName;
  const config = getTierConfig( tier );

  // Payment verification: block paid-tier users with failed/disputed payments
  if ( tier === "personal" || tier === "enterprise" ) {
    const subStatus = userDoc.subscriptionStatus;

    if ( subStatus === "past_due" ) {
      return {
        allowed: false,
        reason:
          "Your payment has failed. Please update your payment method in Settings → Billing to continue using cloud AI models.",
        upgradeMessage: "Update payment method to continue.",
      };
    }

    if ( subStatus === "disputed" ) {
      return {
        allowed: false,
        reason:
          "Your account is restricted due to a payment dispute. Please contact support to resolve this.",
        upgradeMessage: "Contact support to restore access.",
      };
    }

    if ( subStatus === "canceled" ) {
      return {
        allowed: false,
        reason:
          "Your subscription has been canceled. Resubscribe in Settings → Billing to access cloud AI models.",
        upgradeMessage: "Resubscribe to continue.",
      };
    }

    // Check if subscription period has expired (grace period: 3 days past period end)
    const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
    if (
      userDoc.currentPeriodEnd &&
      Date.now() > ( userDoc.currentPeriodEnd * 1000 ) + GRACE_PERIOD_MS
    ) {
      return {
        allowed: false,
        reason:
          "Your subscription period has expired. Please renew in Settings → Billing.",
        upgradeMessage: "Renew your subscription to continue.",
      };
    }
  }

  // Provider-level check: does this tier allow Bedrock at all?
  if ( !isProviderAllowedForTier( tier, "bedrock" ) ) {
    return {
      allowed: false,
      reason:
        "Bedrock models require a Personal subscription ($5/month). " +
        "Use local Ollama models for free, or upgrade in Settings \u2192 Billing.",
      upgradeMessage: getUpgradeMessage( tier ),
    };
  }

  // Model-family check: is this specific model allowed on this tier?
  if ( modelId && !isBedrockModelAllowedForTier( tier, modelId ) ) {
    return {
      allowed: false,
      reason: `Model ${modelId} is not available on the ${config.displayName} tier.`,
      upgradeMessage: getUpgradeMessage( tier ),
    };
  }

  // Execution limit check
  const execCount = userDoc.executionsThisMonth || 0;
  const limitResult = checkExecutionLimit( tier, execCount );
  if ( !limitResult.allowed ) {
    return {
      allowed: false,
      reason: `Monthly unit limit reached (${execCount} used). ${
        limitResult.overageAllowed
          ? "Overage billing applies at $0.05/unit."
          : "Upgrade your plan for more capacity."
      }`,
      upgradeMessage: getUpgradeMessage( tier ),
    };
  }

  if ( !userDoc._id ) {
    console.error( "bedrockGate: userDoc is missing _id", { tier, isAnonymous: userDoc.isAnonymous } );
    return {
      allowed: false,
      reason: "User record is incomplete (missing ID). Please sign in again.",
      upgradeMessage: "Sign in to continue.",
    };
  }

  return {
    allowed: true,
    userId: userDoc._id as Id<"users">,
    tier,
  };
}
