import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * UsageMeter - Shows execution usage for the current billing period.
 * Displays a progress bar: "42 / 100 executions used"
 * Highlights overage when past the included amount.
 */
export function UsageMeter() {
  const subscription = useQuery(api.stripe.getSubscriptionStatus);

  if (!subscription) return null;

  const { tier, executionsThisMonth } = subscription;

  // Free tier shows simple count
  if (tier === "freemium") {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span>{executionsThisMonth} / 50 free executions</span>
        <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${Math.min(100, (executionsThisMonth / 50) * 100)}%` }}
          />
        </div>
      </div>
    );
  }

  // Enterprise = unlimited
  if (tier === "enterprise") {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span>{executionsThisMonth} executions (unlimited)</span>
      </div>
    );
  }

  // Personal tier: 100 included, overage past that
  const included = 100;
  const used = executionsThisMonth;
  const overageCount = Math.max(0, used - included);
  const isOverage = overageCount > 0;
  const pct = Math.min(100, (used / included) * 100);

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={isOverage ? "text-amber-400" : "text-gray-400"}>
        {used} / {included} executions
        {isOverage && (
          <span className="ml-1 text-amber-300">
            (+{overageCount} overage)
          </span>
        )}
      </span>
      <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isOverage ? "bg-amber-500" : "bg-emerald-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
