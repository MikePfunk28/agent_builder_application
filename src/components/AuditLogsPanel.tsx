import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";

export function AuditLogsPanel() {
  const [eventType, setEventType] = useState<string | undefined>(undefined);
  const [successFilter, setSuccessFilter] = useState<boolean | undefined>(undefined);
  const [limit, setLimit] = useState(50);

  const auditLogs = useQuery(api.errorLogging.getAuditLogs, {
    eventType,
    success: successFilter,
    limit,
  });

  if (!auditLogs) {
    return <div className="p-4">Loading audit logs...</div>;
  }

  // Calculate statistics
  const stats = {
    total: auditLogs.length,
    successful: auditLogs.filter((log) => log.success).length,
    failed: auditLogs.filter((log) => !log.success).length,
    byEventType: {} as Record<string, number>,
  };

  auditLogs.forEach((log: any) => {
    stats.byEventType[log.eventType] = (stats.byEventType[log.eventType] || 0) + 1;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Audit Logs</h2>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-sm text-gray-600">Total Events</div>
          <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
        </div>
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="text-sm text-gray-600">Successful</div>
          <div className="text-2xl font-bold text-green-600">{stats.successful}</div>
        </div>
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="text-sm text-gray-600">Failed</div>
          <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
        </div>
      </div>

      {/* Event Type Breakdown */}
      <div className="mb-6 p-4 bg-white rounded-lg border">
        <h3 className="font-semibold mb-3">Events by Type</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(stats.byEventType).map(([type, count]) => (
            <div key={type} className="p-2 bg-gray-50 rounded text-center">
              <div className="text-xs text-gray-600">{type.replace(/_/g, " ")}</div>
              <div className="text-lg font-bold">{count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 p-4 bg-white rounded-lg border">
        <h3 className="font-semibold mb-3">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Event Type</label>
            <select
              value={eventType || ""}
              onChange={(e) => setEventType(e.target.value || undefined)}
              className="w-full p-2 border rounded"
            >
              <option value="">All Event Types</option>
              <option value="oauth_login">OAuth Login</option>
              <option value="mcp_invocation">MCP Invocation</option>
              <option value="agent_invocation">Agent Invocation</option>
              <option value="deployment_created">Deployment Created</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={successFilter === undefined ? "" : successFilter ? "success" : "failure"}
              onChange={(e) =>
                setSuccessFilter(
                  e.target.value === "" ? undefined : e.target.value === "success"
                )
              }
              className="w-full p-2 border rounded"
            >
              <option value="">All Statuses</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Limit</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full p-2 border rounded"
            >
              <option value="25">25 logs</option>
              <option value="50">50 logs</option>
              <option value="100">100 logs</option>
              <option value="200">200 logs</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Event Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Resource
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {auditLogs.map((log: any) => (
                <tr key={log._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {log.eventType.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-gray-900">{log.action}</div>
                    {log.details && (
                      <details className="mt-1">
                        <summary className="text-xs text-blue-600 cursor-pointer hover:underline">
                          View details
                        </summary>
                        <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {log.resource && (
                      <div>
                        <div className="font-medium">{log.resource}</div>
                        {log.resourceId && (
                          <div className="text-xs text-gray-500 font-mono">
                            {log.resourceId}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {log.success ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ✓ Success
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        ✗ Failed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {auditLogs.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No audit logs found matching the current filters.
        </div>
      )}
    </div>
  );
}
