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

// ALL CRON JOBS DISABLED
// Cleanup should be triggered manually or on-demand, not on a schedule

export default crons;
