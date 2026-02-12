import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { Check, CreditCard, ExternalLink, Loader2, Shield, Zap } from "lucide-react";
import { UsageMeter } from "./UsageMeter";

/**
 * PricingPanel - Billing & subscription management.
 *
 * Shows 3 tier cards (Free / Personal / Enterprise), a subscribe button
 * that redirects to Stripe Checkout, and a "Manage" button that opens
 * the Stripe Customer Portal for existing subscribers.
 */

interface TierCardProps {
  name: string;
  price: string;
  priceNote?: string;
  features: string[];
  isCurrent: boolean;
  cta: string;
  ctaDisabled?: boolean;
  onCtaClick?: () => void;
  loading?: boolean;
  highlight?: boolean;
}

function TierCard({
  name,
  price,
  priceNote,
  features,
  isCurrent,
  cta,
  ctaDisabled,
  onCtaClick,
  loading,
  highlight,
}: TierCardProps) {
  return (
    <div
      className={`relative flex flex-col rounded-xl border p-6 transition-all ${
        highlight
          ? "border-emerald-400/60 bg-emerald-950/40 shadow-lg shadow-emerald-500/10"
          : "border-emerald-500/20 bg-slate-950/80"
      }`}
    >
      {isCurrent && (
        <span className="absolute -top-3 left-4 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
          Current Plan
        </span>
      )}

      <h3 className="text-lg font-bold text-gray-100 mb-1">{name}</h3>

      <div className="mb-4">
        <span className="text-3xl font-extrabold text-emerald-300">{price}</span>
        {priceNote && (
          <span className="ml-1 text-sm text-gray-500">{priceNote}</span>
        )}
      </div>

      <ul className="flex-1 space-y-2 mb-6">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
            <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onCtaClick}
        disabled={ctaDisabled || loading}
        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
          highlight
            ? "bg-emerald-600 hover:bg-emerald-500 text-white disabled:bg-emerald-800 disabled:text-emerald-500"
            : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 disabled:opacity-50"
        }`}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {cta}
      </button>
    </div>
  );
}

export function PricingPanel() {
  const subscription = useQuery(api.stripeMutations.getSubscriptionStatus);
  const createCheckout = useAction(api.stripe.createCheckoutSession);
  const createPortal = useAction(api.stripe.createPortalSession);

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tier = subscription?.tier ?? "freemium";
  const hasActive = subscription?.hasActiveSubscription ?? false;

  async function handleSubscribe() {
    setError(null);
    setCheckoutLoading(true);
    try {
      const { url } = await createCheckout({});
      window.location.href = url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start checkout";
      setError(msg);
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handleManage() {
    setError(null);
    setPortalLoading(true);
    try {
      const { url } = await createPortal({});
      window.location.href = url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to open portal";
      setError(msg);
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-emerald-400" />
            Billing & Plans
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage your subscription and view usage
          </p>
        </div>
        <UsageMeter />
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Tier cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <TierCard
          name="Free"
          price="$0"
          priceNote="/month"
          features={[
            "Local models (Ollama, LMStudio)",
            "50 local executions / month",
            "5 agents",
            "Community support",
          ]}
          isCurrent={tier === "freemium"}
          cta={tier === "freemium" ? "Current Plan" : "Downgrade"}
          ctaDisabled={tier === "freemium"}
          onCtaClick={hasActive ? handleManage : undefined}
        />

        <TierCard
          name="Personal"
          price="$5"
          priceNote="/month"
          features={[
            "All Free features",
            "AWS Bedrock models (Haiku, Sonnet, Opus, Nova, more)",
            "100 included units / month",
            "$0.05 per additional unit",
            "Models cost 1–5 units per call",
            "50 agents, 5 concurrent tests",
          ]}
          isCurrent={tier === "personal"}
          highlight={tier !== "personal"}
          cta={
            tier === "personal"
              ? "Manage Subscription"
              : tier === "enterprise"
                ? "Current plan is higher"
                : "Subscribe"
          }
          ctaDisabled={tier === "enterprise"}
          onCtaClick={
            tier === "personal"
              ? handleManage
              : tier === "freemium"
                ? handleSubscribe
                : undefined
          }
          loading={checkoutLoading}
        />

        <TierCard
          name="Enterprise"
          price="Custom"
          features={[
            "All Personal features",
            "All Bedrock models",
            "Unlimited units",
            "500 agents, 20 concurrent tests",
            "Dedicated support",
          ]}
          isCurrent={tier === "enterprise"}
          cta={tier === "enterprise" ? "Current Plan" : "Contact Us"}
          ctaDisabled={tier === "enterprise"}
          onCtaClick={() => {
            window.open("mailto:support@mikepfunk.com?subject=Enterprise%20Inquiry", "_blank");
          }}
        />
      </div>

      {/* Subscription details for active subscribers */}
      {hasActive && subscription && (
        <div className="rounded-xl border border-emerald-500/20 bg-slate-950/80 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-emerald-200 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Subscription Details
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Status</p>
              <p className={`font-medium ${
                subscription.subscriptionStatus === "active"
                  ? "text-emerald-300"
                  : subscription.subscriptionStatus === "past_due"
                    ? "text-amber-300"
                    : "text-gray-400"
              }`}>
                {subscription.subscriptionStatus ?? "N/A"}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Tier</p>
              <p className="font-medium text-gray-200 capitalize">{tier}</p>
            </div>
            <div>
              <p className="text-gray-500">Units This Period</p>
              <p className="font-medium text-gray-200">
                {subscription.executionsThisMonth}
                {subscription.rawCallsThisMonth != null && subscription.rawCallsThisMonth !== subscription.executionsThisMonth && (
                  <span className="ml-1 text-gray-500 text-xs">({subscription.rawCallsThisMonth} calls)</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Period Ends</p>
              <p className="font-medium text-gray-200">
                {subscription.currentPeriodEnd
                  ? new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleManage}
            disabled={portalLoading}
            className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            Manage in Stripe
          </button>
        </div>
      )}
    </div>
  );
}
