# Cost Optimization Strategy

## Queue Processing - On-Demand Model

### What Changed
- **Before**: Queue processor ran every 5 seconds (518K calls/month)
- **After**: Queue processor triggered on-demand when tests are submitted (only runs when needed)

### How It Works
1. When a test is submitted → immediately triggers queue processor
2. Queue processor checks if there's work to do
3. If queue is empty → exits silently (no logs, minimal cost)
4. If queue has work → processes tests and logs activity

### Cost Savings
- **Idle time**: Zero function calls when no tests are running
- **Active time**: Only processes when there's actual work
- **Estimated savings**: 95%+ reduction in queue processing costs

### Backup Polling (Optional)
The cron job is currently **disabled** in `convex/crons.ts`. You can re-enable it as a backup:
```typescript
// Uncomment to enable backup polling every 30 seconds
crons.interval(
  "process-test-queue",
  { seconds: 30 },
  internal.queueProcessor.processQueue
);
```

## Error & Audit Logging - Event-Driven

### Cost Model
- **Zero cost when idle** - no background processes
- **Only logs when events occur**:
  - OAuth login attempts
  - MCP tool invocations
  - Agent executions
  - Errors and exceptions

### Storage Costs
- Convex includes generous database storage in free tier
- Error logs can be cleaned up periodically if needed
- Consider adding a cleanup cron for old logs (30+ days)

## Monitoring Best Practices

### Development
- Keep detailed logging enabled
- Use on-demand processing
- Monitor costs in Convex dashboard

### Production
- Keep error/audit logging (event-driven, low cost)
- Consider enabling backup polling (30-60 seconds) for reliability
- Add log cleanup for logs older than 30-90 days

## Optional: Log Cleanup Cron

Add to `convex/crons.ts` if you want automatic cleanup:
```typescript
// Cleanup old logs every day
crons.daily(
  "cleanup-old-logs",
  { hourUTC: 3 }, // 3 AM UTC
  internal.errorLogging.cleanupOldLogs
);
```

Then add to `convex/errorLogging.ts`:
```typescript
export const cleanupOldLogs = internalMutation({
  args: {
    daysToKeep: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const daysToKeep = args.daysToKeep || 30;
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    // Delete old error logs
    const oldErrors = await ctx.db
      .query("errorLogs")
      .filter((q) => q.lt(q.field("timestamp"), cutoffTime))
      .collect();
    
    for (const error of oldErrors) {
      await ctx.db.delete(error._id);
    }
    
    // Delete old audit logs
    const oldAudits = await ctx.db
      .query("auditLogs")
      .filter((q) => q.lt(q.field("timestamp"), cutoffTime))
      .collect();
    
    for (const audit of oldAudits) {
      await ctx.db.delete(audit._id);
    }
    
    console.log(`Cleaned up ${oldErrors.length} error logs and ${oldAudits.length} audit logs`);
  },
});
```

## Summary

✅ **Queue processing**: On-demand only (95%+ cost reduction)
✅ **Error logging**: Event-driven (zero idle cost)
✅ **Audit logging**: Event-driven (zero idle cost)
✅ **Monitoring**: Detailed when needed, silent when idle
✅ **Scalable**: Costs scale with actual usage, not time
