/**
 * Cron Jobs Configuration
 *
 * Scheduled tasks for queue processing and maintenance
 * 
 * NOTE: To save costs, the queue processor is now triggered on-demand
 * when tests are submitted, rather than polling every few seconds.
 * Only the cleanup job runs on a schedule.
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// DISABLED: Queue processor now runs on-demand when tests are submitted
// This saves ~86K function calls per month
// crons.interval(
//   "process-test-queue",
//   { seconds: 30 },
//   internal.queueProcessor.processQueue
// );

// Cleanup abandoned tests every hour (reduced from 15 minutes to save costs)
crons.interval(
  "cleanup-abandoned-tests",
  { hours: 1 },
  internal.queueProcessor.cleanupAbandonedTests
);

export default crons;
