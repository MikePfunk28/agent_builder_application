"use node";

/**
 * Stripe Actions - Client-callable and internal actions that need Node.js runtime.
 *
 * "use node" files can ONLY contain action / internalAction exports.
 * Mutations and queries live in stripeMutations.ts (standard Convex runtime).
 *
 * Actions (client-callable, authenticated):
 *   - createCheckoutSession: Redirects user to Stripe Checkout for $5/mo subscription
 *   - createPortalSession: Redirects user to Stripe Customer Portal for self-service
 *
 * Internal actions (NOT client-callable):
 *   - reportUsage: Reports metered execution overage to Stripe
 */

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Mutations live in stripeMutations.ts (non-Node runtime).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internalStripeMutations = (internal as any).stripeMutations;

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Stripe type alias - resolved dynamically via import("stripe")
type StripeClient = import("stripe").default;

async function getStripeClient(): Promise<StripeClient> {
  const { default: StripeSDK } = await import( "stripe" );
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if ( !secretKey ) {
    throw new Error(
      "Missing STRIPE_SECRET_KEY environment variable. " +
      "Add it to the Convex dashboard under Settings > Environment Variables."
    );
  }
  return new StripeSDK( secretKey );
}

/**
 * Resolve the frontend URL for Stripe redirect callbacks.
 * Reads FRONTEND_URL first (explicit override), then falls back to SITE_URL
 * or CONVEX_SITE_URL.
 */
function getFrontendUrl(): string {
  return (
    process.env.FRONTEND_URL ??
    process.env.SITE_URL ??
    process.env.CONVEX_SITE_URL ??
    "http://localhost:4000"
  );
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

    const personalPriceId = process.env.STRIPE_PERSONAL_PRICE;
    const meteredPriceId = process.env.STRIPE_METERED_PRICE;
    if ( !personalPriceId || !meteredPriceId ) {
      throw new Error(
        "Missing STRIPE_PERSONAL_PRICE or STRIPE_METERED_PRICE. " +
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

      // Persist the customer ID immediately (mutation in stripeMutations.ts)
      await ctx.runMutation( internalStripeMutations.setStripeCustomerId, {
        userId,
        customerId,
      } );
    }

    const frontendUrl = getFrontendUrl();

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

    const frontendUrl = getFrontendUrl();

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
 *
 * Looks up STRIPE_METERED_PRICE → retrieves the connected Billing Meter →
 * sends a meter event with the customer ID and quantity. No extra env vars
 * needed — the meter event name is derived from the price at runtime.
 *
 * NOTE: internalAction - NOT client-callable. Only invoked by backend after
 * cloud executions via ctx.scheduler.runAfter().
 */
export const reportUsage = internalAction( {
  args: {
    stripeCustomerId: v.string(),
    quantity: v.number(),
  },
  handler: async ( _ctx, args ) => {
    const stripe = await getStripeClient();

    const meteredPriceId = process.env.STRIPE_METERED_PRICE;
    if ( !meteredPriceId ) {
      console.warn( "STRIPE_METERED_PRICE not set; skipping overage report" );
      return;
    }

    // Look up the price to find its connected Billing Meter
    const price = await stripe.prices.retrieve( meteredPriceId );
    const meterId = price.recurring?.meter;
    if ( !meterId ) {
      console.warn(
        `Price ${meteredPriceId} has no connected Billing Meter. ` +
        "Create a meter in Stripe Dashboard → Billing → Meters and link it to this price."
      );
      return;
    }

    // Retrieve the meter to get its event_name
    const meter = await stripe.billing.meters.retrieve( meterId );

    await stripe.billing.meterEvents.create( {
      event_name: meter.event_name,
      payload: {
        stripe_customer_id: args.stripeCustomerId,
        value: String( args.quantity ),
      },
      timestamp: Math.floor( Date.now() / 1000 ),
    } );
  },
} );
