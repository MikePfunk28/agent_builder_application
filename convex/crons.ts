/**
 * Cron Jobs Configuration
 *
 * Scheduled tasks for billing resets and maintenance.
 *
 * NOTE: Queue processing is triggered on-demand when tests are submitted,
 * NOT via polling. Only billing resets and cleanup run on a schedule.
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Reset freemium-tier users' monthly usage on the 1st of each month at 00:00 UTC.
// Paid users are reset via Stripe invoice.paid webhook instead.
crons.monthly(
  "reset freemium monthly usage",
  { day: 1, hourUTC: 0, minuteUTC: 0 },
  internal.stripeMutations.resetFreemiumMonthlyUsage,
);

export default crons;
