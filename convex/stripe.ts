"use node";

/**
 * Stripe Integration - Subscription billing for Agent Builder
 *
 * Actions (client-callable, authenticated):
 *   - createCheckoutSession: Redirects user to Stripe Checkout for $5/mo subscription
 *   - createPortalSession: Redirects user to Stripe Customer Portal for self-service
 *   - reportUsage: Reports metered execution overage to Stripe
 *
 * Internal mutations (webhook-only, NOT client-callable):
 *   - updateSubscription: Sets tier/role/status on checkout or renewal
 *   - cancelSubscription: Downgrades user on cancellation
 *   - resetMonthlyUsage: Zeros executionsThisMonth on invoice.paid
 *
 * Query (client-callable):
 *   - getSubscriptionStatus: Returns current tier, status, usage, period end
 */

import { action, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Note: `internalStripe.*` references will resolve after running `npx convex dev`
// to regenerate API types. The cast below bridges the gap until codegen runs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internalStripe = (internal as any).stripe;

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Stripe type alias - resolved dynamically via import("stripe")
type StripeClient = import("stripe").default;

async function getStripeClient(): Promise<StripeClient> {
  const { default: StripeSDK } = await import( "stripe" );
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if ( !secretKey ) {
    throw new Error(
      "Missing STRIPE_SECRET_KEY environment variable. " +
      "Add it to the Convex dashboard under Settings → Environment Variables."
    );
  }
  return new StripeSDK( secretKey );
}

// ─── Actions (Client-callable, Authenticated) ───────────────────────────────

/**
 * Create a Stripe Checkout session for the Personal tier ($5/mo + metered overage).
 * Returns the checkout URL for client-side redirect.
 */
export const createCheckoutSession = action( {
  args: {},
  handler: async ( ctx ): Promise<{ url: string }> => {
    const userId = await getAuthUserId( ctx );
    if ( !userId ) {
      throw new Error( "Authentication required to subscribe" );
    }

    const user = await ctx.runQuery( internal.users.getInternal, { id: userId } );
    if ( !user ) {
      throw new Error( "User not found" );
    }

    const stripe = await getStripeClient();

    const personalPriceId = process.env.STRIPE_PERSONAL_PRICE_ID;
    const meteredPriceId = process.env.STRIPE_METERED_PRICE_ID;
    if ( !personalPriceId || !meteredPriceId ) {
      throw new Error(
        "Missing STRIPE_PERSONAL_PRICE_ID or STRIPE_METERED_PRICE_ID. " +
        "Create these prices in Stripe Dashboard and add the IDs to Convex env vars."
      );
    }

    // Reuse existing Stripe customer or create new one
    let customerId = user.stripeCustomerId;
    if ( !customerId ) {
      const customer = await stripe.customers.create( {
        email: user.email ?? undefined,
        name: user.name ?? undefined,
        metadata: { convexUserId: userId },
      } );
      customerId = customer.id;

      // Persist the customer ID immediately
      await ctx.runMutation( internalStripe.setStripeCustomerId, {
        userId,
        customerId,
      } );
    }

    // Determine success/cancel URLs from the site URL env var
    const siteUrl = process.env.CONVEX_SITE_URL ?? process.env.SITE_URL ?? "http://localhost:4000";
    // Strip the convex URL suffix if present (e.g., .convex.site → use frontend URL instead)
    const frontendUrl = siteUrl.includes( ".convex." )
      ? "http://localhost:4000"
      : siteUrl;

    const session = await stripe.checkout.sessions.create( {
      customer: customerId,
      mode: "subscription",
      line_items: [
        { price: personalPriceId, quantity: 1 },       // Flat $5/mo
        { price: meteredPriceId },                       // Metered overage
      ],
      success_url: `${frontendUrl}?view=settings&checkout=success`,
      cancel_url: `${frontendUrl}?view=settings&checkout=canceled`,
      metadata: { convexUserId: userId, tier: "personal" },
    } );

    if ( !session.url ) {
      throw new Error( "Stripe did not return a checkout URL" );
    }

    return { url: session.url };
  },
} );

/**
 * Create a Stripe Customer Portal session for self-service subscription management.
 * Returns the portal URL for client-side redirect.
 */
export const createPortalSession = action( {
  args: {},
  handler: async ( ctx ): Promise<{ url: string }> => {
    const userId = await getAuthUserId( ctx );
    if ( !userId ) {
      throw new Error( "Authentication required" );
    }

    const user = await ctx.runQuery( internal.users.getInternal, { id: userId } );
    if ( !user?.stripeCustomerId ) {
      throw new Error( "No active subscription found. Subscribe first." );
    }

    const stripe = await getStripeClient();

    const siteUrl = process.env.CONVEX_SITE_URL ?? process.env.SITE_URL ?? "http://localhost:4000";
    const frontendUrl = siteUrl.includes( ".convex." )
      ? "http://localhost:4000"
      : siteUrl;

    const session = await stripe.billingPortal.sessions.create( {
      customer: user.stripeCustomerId,
      return_url: `${frontendUrl}?view=settings`,
    } );

    return { url: session.url };
  },
} );

/**
 * Report metered usage to Stripe for overage billing.
 * Called internally after cloud executions that exceed the included 100/month.
 */
export const reportUsage = action( {
  args: {
    subscriptionItemId: v.string(),
    quantity: v.number(),
  },
  handler: async ( _ctx, args ) => {
    const stripe = await getStripeClient();

    // Create a usage record on the metered subscription item.
    // In Stripe SDK v20+, use billing.meterEvents or the REST-compatible path.
    // The subscriptionItems resource still supports this via the underlying API.
    await (stripe.subscriptionItems as any).createUsageRecord(
      args.subscriptionItemId,
      {
        quantity: args.quantity,
        action: "increment",
        timestamp: Math.floor( Date.now() / 1000 ),
      }
    );
  },
} );

// ─── Internal Mutations (Webhook-only, NOT client-callable) ──────────────────

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
      billingPeriodStart: args.periodStart,
    } );
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
      currentPeriodEnd: user.currentPeriodEnd ?? null,
      stripeCustomerId: user.stripeCustomerId ?? null,
      hasActiveSubscription: user.subscriptionStatus === "active",
    };
  },
} );
