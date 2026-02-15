/**
 * Stripe Internal Mutations & Queries
 *
 * Separated from stripe.ts because that file uses "use node" (Node.js runtime),
 * which only permits action/internalAction exports. Mutations and queries must
 * live in a standard Convex runtime file.
 *
 * Internal mutations (NOT client-callable):
 *   - incrementUsageAndReportOverage: Single source of truth for usage increment + Stripe overage
 *   - setStripeCustomerId: Persists Stripe customer ID on user record
 *   - updateSubscription: Sets tier/role/status on checkout or renewal
 *   - cancelSubscription: Downgrades user on cancellation
 *   - resetMonthlyUsage: Zeros executionsThisMonth on invoice.paid
 *   - markPastDue: Marks subscription as past_due on payment failure
 *
 * Query (client-callable):
 *   - getSubscriptionStatus: Returns current tier, status, usage, period end
 */

import { internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internalStripe = ( internal as any ).stripe;

// ─── Internal Mutations (NOT client-callable) ────────────────────────────────

/**
 * Core logic: Increment executionsThisMonth and report Stripe overage.
 *
 * Exported as a plain function so mutation handlers can call it directly
 * (mutations cannot call ctx.runMutation). Action handlers should use the
 * internalMutation wrapper below instead.
 *
 * This is the SINGLE source of truth for usage increment + overage reporting.
 */
export async function incrementUsageAndReportOverageImpl(
  ctx: { db: any; scheduler: any },
  userId: any,
  options?: {
    updateLastTestAt?: boolean;
    modelId?: string;
    inputTokens?: number;
    outputTokens?: number;
  },
) {
  const user = await ctx.db.get( userId );
  if ( !user ) {
    console.warn( `incrementUsageAndReportOverage: user not found for id ${userId}` );
    return;
  }

  // Token-based billing: use actual token counts when available (2x AWS cost at $0.05/unit).
  // Falls back to flat per-call units when token counts are not provided.
  let units: number;
  const hasTokens =
    options?.inputTokens !== undefined &&
    options?.outputTokens !== undefined &&
    ( ( options.inputTokens || 0 ) > 0 || ( options.outputTokens || 0 ) > 0 );

  if ( hasTokens ) {
    const { calculateUnitsFromTokens } = await import( "./lib/tokenBilling" );
    units = calculateUnitsFromTokens(
      options!.modelId || "anthropic.claude-haiku-4-5-20251001-v1:0",
      options!.inputTokens!,
      options!.outputTokens!,
    );
  } else {
    // Flat fallback: look up unitsPerCall from model registry
    const { getUnitsForModel } = await import( "./modelRegistry" );
    units = options?.modelId ? getUnitsForModel( options.modelId ) : 1;
  }

  const prevUnits = user.executionsThisMonth || 0;
  const newCount = prevUnits + units;
  const newRawCalls = ( user.rawCallsThisMonth || 0 ) + 1;

  // Accumulate token totals for analytics
  const newInputTokens = ( user.tokensInputThisMonth || 0 ) + ( options?.inputTokens || 0 );
  const newOutputTokens = ( user.tokensOutputThisMonth || 0 ) + ( options?.outputTokens || 0 );

  const patch: Record<string, unknown> = {
    executionsThisMonth: newCount,
    rawCallsThisMonth: newRawCalls,
    tokensInputThisMonth: newInputTokens,
    tokensOutputThisMonth: newOutputTokens,
  };
  if ( options?.updateLastTestAt ) {
    patch.lastTestAt = Date.now();
  }
  await ctx.db.patch( userId, patch );

  // Report overage to Stripe for personal tier users past included limit.
  // Only report the units that crossed the threshold (not units already reported).
  if ( user.tier === "personal" && user.stripeCustomerId ) {
    const { getTierConfig } = await import( "./lib/tierConfig" );
    const tierCfg = getTierConfig( "personal" );
    if ( newCount > tierCfg.monthlyExecutions ) {
      // How many units of THIS call are overage?
      const overageUnits = Math.min( units, newCount - tierCfg.monthlyExecutions );
      await ctx.scheduler.runAfter( 0, internalStripe.reportUsage, {
        stripeCustomerId: user.stripeCustomerId,
        quantity: overageUnits,
      } );
    }
  }
}

/**
 * InternalMutation wrapper — for callers in actions (which use ctx.runMutation).
 * Mutation callers should import and call incrementUsageAndReportOverageImpl directly.
 */
export const incrementUsageAndReportOverage = internalMutation( {
  args: {
    userId: v.id( "users" ),
    updateLastTestAt: v.optional( v.boolean() ),
    modelId: v.optional( v.string() ),
    inputTokens: v.optional( v.number() ),
    outputTokens: v.optional( v.number() ),
  },
  handler: async ( ctx, args ) => {
    await incrementUsageAndReportOverageImpl( ctx, args.userId, {
      updateLastTestAt: args.updateLastTestAt,
      modelId: args.modelId,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
    } );
  },
} );

// ─── Webhook Mutations (NOT client-callable) ─────────────────────────────────

/**
 * Persist Stripe customer ID on the user record.
 */
export const setStripeCustomerId = internalMutation( {
  args: {
    userId: v.id( "users" ),
    customerId: v.string(),
  },
  handler: async ( ctx, args ) => {
    await ctx.db.patch( args.userId, {
      stripeCustomerId: args.customerId,
    } );
  },
} );

/**
 * Update subscription state after checkout.session.completed or subscription.updated.
 * Sets tier to "personal", role to "paid", and marks subscription as active.
 */
export const updateSubscription = internalMutation( {
  args: {
    stripeCustomerId: v.string(),
    subscriptionId: v.string(),
    status: v.string(),
    currentPeriodEnd: v.number(),
  },
  handler: async ( ctx, args ) => {
    // Find user by Stripe customer ID
    const user = await ctx.db
      .query( "users" )
      .withIndex( "by_stripe_customer_id", ( q ) =>
        q.eq( "stripeCustomerId", args.stripeCustomerId )
      )
      .first();

    if ( !user ) {
      console.error( `Stripe webhook: No user found for customer ${args.stripeCustomerId}` );
      return;
    }

    await ctx.db.patch( user._id, {
      stripeSubscriptionId: args.subscriptionId,
      subscriptionStatus: args.status,
      currentPeriodEnd: args.currentPeriodEnd,
      tier: "personal",
      role: "paid",
      upgradedAt: Date.now(),
    } );
  },
} );

/**
 * Handle subscription cancellation. Downgrades user to freemium.
 */
export const cancelSubscription = internalMutation( {
  args: {
    stripeCustomerId: v.string(),
  },
  handler: async ( ctx, args ) => {
    const user = await ctx.db
      .query( "users" )
      .withIndex( "by_stripe_customer_id", ( q ) =>
        q.eq( "stripeCustomerId", args.stripeCustomerId )
      )
      .first();

    if ( !user ) {
      console.error( `Stripe webhook: No user found for customer ${args.stripeCustomerId}` );
      return;
    }

    await ctx.db.patch( user._id, {
      subscriptionStatus: "canceled",
      tier: "freemium",
      role: "user",
    } );
  },
} );

/**
 * Reset monthly execution counter at the start of each billing period (invoice.paid).
 */
export const resetMonthlyUsage = internalMutation( {
  args: {
    stripeCustomerId: v.string(),
    periodStart: v.number(),
  },
  handler: async ( ctx, args ) => {
    const user = await ctx.db
      .query( "users" )
      .withIndex( "by_stripe_customer_id", ( q ) =>
        q.eq( "stripeCustomerId", args.stripeCustomerId )
      )
      .first();

    if ( !user ) {
      console.error( `Stripe webhook: No user found for customer ${args.stripeCustomerId}` );
      return;
    }

    await ctx.db.patch( user._id, {
      executionsThisMonth: 0,
      rawCallsThisMonth: 0,
      tokensInputThisMonth: 0,
      tokensOutputThisMonth: 0,
      billingPeriodStart: args.periodStart,
    } );
  },
} );

/**
 * Reset monthly usage for all freemium-tier users.
 * Called by cron on the 1st of each month.
 * Paid users are reset via invoice.paid webhook instead.
 */
export const resetFreemiumMonthlyUsage = internalMutation( {
  args: {},
  handler: async ( ctx ) => {
    const freemiumUsers = await ctx.db
      .query( "users" )
      .filter( ( q ) =>
        q.or(
          q.eq( q.field( "tier" ), "freemium" ),
          q.eq( q.field( "tier" ), undefined )
        )
      )
      .collect();

    let resetCount = 0;
    for ( const user of freemiumUsers ) {
      // Only reset if they have usage
      if (
        ( user.executionsThisMonth ?? 0 ) > 0 ||
        ( user.rawCallsThisMonth ?? 0 ) > 0 ||
        ( user.tokensInputThisMonth ?? 0 ) > 0 ||
        ( user.tokensOutputThisMonth ?? 0 ) > 0
      ) {
        await ctx.db.patch( user._id, {
          executionsThisMonth: 0,
          rawCallsThisMonth: 0,
          tokensInputThisMonth: 0,
          tokensOutputThisMonth: 0,
          billingPeriodStart: Date.now(),
        } );
        resetCount++;
      }
    }

    console.log( `resetFreemiumMonthlyUsage: reset ${resetCount} freemium users` );
  },
} );

/**
 * Mark subscription as past_due when payment fails.
 */
export const markPastDue = internalMutation( {
  args: {
    stripeCustomerId: v.string(),
  },
  handler: async ( ctx, args ) => {
    const user = await ctx.db
      .query( "users" )
      .withIndex( "by_stripe_customer_id", ( q ) =>
        q.eq( "stripeCustomerId", args.stripeCustomerId )
      )
      .first();

    if ( !user ) {
      console.error( `Stripe webhook: No user found for customer ${args.stripeCustomerId}` );
      return;
    }

    await ctx.db.patch( user._id, {
      subscriptionStatus: "past_due",
    } );
  },
} );

/**
 * Restrict account when a charge dispute (chargeback) is created.
 * Sets subscriptionStatus to "disputed" which bedrockGate blocks.
 */
export const restrictAccountForDispute = internalMutation( {
  args: {
    stripeCustomerId: v.string(),
  },
  handler: async ( ctx, args ) => {
    const user = await ctx.db
      .query( "users" )
      .withIndex( "by_stripe_customer_id", ( q ) =>
        q.eq( "stripeCustomerId", args.stripeCustomerId )
      )
      .first();

    if ( !user ) {
      console.error( `Stripe webhook: No user found for customer ${args.stripeCustomerId}` );
      return;
    }

    await ctx.db.patch( user._id, {
      subscriptionStatus: "disputed",
    } );
  },
} );

/**
 * Handle charge refund — mark subscription status so the gate can act on it.
 * We don't downgrade immediately (the subscription may still be active),
 * but we log it for monitoring. If the refund leads to a cancellation,
 * the customer.subscription.deleted event will handle the downgrade.
 */
export const handleChargeRefund = internalMutation( {
  args: {
    stripeCustomerId: v.string(),
    amountRefunded: v.number(),
  },
  handler: async ( ctx, args ) => {
    const user = await ctx.db
      .query( "users" )
      .withIndex( "by_stripe_customer_id", ( q ) =>
        q.eq( "stripeCustomerId", args.stripeCustomerId )
      )
      .first();

    if ( !user ) {
      console.error( `Stripe webhook: No user found for customer ${args.stripeCustomerId}` );
      return;
    }

    // Log refund but don't change tier — the subscription lifecycle events handle that.
    // If this is a full refund, Stripe will likely also fire subscription.deleted.
    console.warn(
      `Stripe refund processed for customer ${args.stripeCustomerId}: $${( args.amountRefunded / 100 ).toFixed( 2 )}`
    );
  },
} );

// ─── Query (Client-callable) ─────────────────────────────────────────────────

/**
 * Get the current user's subscription status and usage.
 */
export const getSubscriptionStatus = query( {
  args: {},
  handler: async ( ctx ) => {
    const userId = await getAuthUserId( ctx );
    if ( !userId ) {
      return null;
    }

    const user = await ctx.db.get( userId );
    if ( !user ) {
      return null;
    }

    return {
      tier: user.tier ?? "freemium",
      role: user.role ?? "user",
      subscriptionStatus: user.subscriptionStatus ?? null,
      executionsThisMonth: user.executionsThisMonth ?? 0,
      rawCallsThisMonth: user.rawCallsThisMonth ?? 0,
      tokensInputThisMonth: user.tokensInputThisMonth ?? 0,
      tokensOutputThisMonth: user.tokensOutputThisMonth ?? 0,
      currentPeriodEnd: user.currentPeriodEnd ?? null,
      hasActiveSubscription: user.subscriptionStatus === "active",
    };
  },
} );
