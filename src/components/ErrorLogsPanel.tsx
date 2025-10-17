import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";

export function ErrorLogsPanel() {
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [severity, setSeverity] = useState<string | undefined>(undefined);
  const [limit, setLimit] = useState(50);

  const errorLogs = useQuery(api.errorLogging.getErrorLogs, {
    category,
    severity,
    limit,
  });

  const errorStats = useQuery(api.errorLogging.getErrorStats, {
    timeRangeHours: 24,
  });

  if (!errorLogs || !errorStats) {
    return <div className="p-4">Loading error logs...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Error Logs & Monitoring</h2>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-sm text-gray-600">Total Errors (24h)</div>
          <div className="text-2xl font-bold text-blue-600">{errorStats.total}</div>
        </div>
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="text-sm text-gray-600">Resolved</div>
          <div className="text-2xl font-bold text-green-600">{errorStats.resolved}</div>
        </div>
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="text-sm text-gray-600">Unresolved</div>
          <div className="text-2xl font-bold text-red-600">{errorStats.unresolved}</div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Resolution Rate</div>
          <div className="text-2xl font-bold text-gray-600">
            {errorStats.total > 0
              ? Math.round(((errorStats.resolved as number) / errorStats.total) * 100)
              : 0}
            %
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="mb-6 p-4 bg-white rounded-lg border">
        <h3 className="font-semibold mb-3">Errors by Category</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {Object.entries(errorStats.byCategory).map(([cat, count]) => (
            <div key={cat} className="p-2 bg-gray-50 rounded text-center">
              <div className="text-xs text-gray-600 uppercase">{cat}</div>
              <div className="text-lg font-bold">{count as number}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Severity Breakdown */}
      <div className="mb-6 p-4 bg-white rounded-lg border">
        <h3 className="font-semibold mb-3">Errors by Severity</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(errorStats.bySeverity).map(([sev, count]) => (
            <div
              key={sev}
              className={`p-2 rounded text-center ${
                sev === "critical"
                  ? "bg-red-100 text-red-800"
                  : sev === "error"
                  ? "bg-orange-100 text-orange-800"
                  : sev === "warning"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-blue-100 text-blue-800"
              }`}
            >
              <div className="text-xs uppercase font-medium">{sev}</div>
              <div className="text-lg font-bold">{count as number}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 p-4 bg-white rounded-lg border">
        <h3 className="font-semibold mb-3">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              value={category || ""}
              onChange={(e) => setCategory(e.target.value || undefined)}
              className="w-full p-2 border rounded"
            >
              <option value="">All Categories</option>
              <option value="oauth">OAuth</option>
              <option value="mcp">MCP</option>
              <option value="agent">Agent</option>
              <option value="deployment">Deployment</option>
              <option value="general">General</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Severity</label>
            <select
              value={severity || ""}
              onChange={(e) => setSeverity(e.target.value || undefined)}
              className="w-full p-2 border rounded"
            >
              <option value="">All Severities</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="critical">Critical</option>
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

      {/* Error Logs Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Severity
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Message
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {errorLogs.map((log: any) => (
                <tr key={log._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {log.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        log.severity === "critical"
                          ? "bg-red-100 text-red-800"
                          : log.severity === "error"
                          ? "bg-orange-100 text-orange-800"
                          : log.severity === "warning"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {log.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-gray-900">{log.message}</div>
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
                  <td className="px-4 py-3">
                    {log.resolved ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Resolved
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Unresolved
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {errorLogs.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No error logs found matching the current filters.
        </div>
      )}
    </div>
  );
}
