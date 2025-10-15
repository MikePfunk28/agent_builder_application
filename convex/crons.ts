/**
 * Cron Jobs Configuration
 *
 * Scheduled tasks for queue processing and maintenance
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Process test queue every 5 seconds
crons.interval(
  "process-test-queue",
  { seconds: 5 },
  internal.queueProcessor.processQueue
);

// Cleanup abandoned tests every 15 minutes
crons.interval(
  "cleanup-abandoned-tests",
  { minutes: 15 },
  internal.queueProcessor.cleanupAbandonedTests
);

// Archive old tests every day at 2 AM UTC
crons.daily(
  "archive-old-tests",
  { hourUTC: 2, minuteUTC: 0 },
  internal.maintenance.archiveOldTests
);

// Delete expired deployment packages every hour
crons.hourly(
  "cleanup-expired-packages",
  { minuteUTC: 0 },
  internal.maintenance.cleanupExpiredPackages
);

export default crons;
