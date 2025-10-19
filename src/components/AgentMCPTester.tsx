import { useState } from "react";
import { Loader2, PlayCircle, CheckCircle, XCircle } from "lucide-react";

interface AgentMCPTesterProps {
  mcpToolName: string;
  mcpInputSchema?: any;
}

export function AgentMCPTester({ mcpToolName, mcpInputSchema }: AgentMCPTesterProps) {
  const [testInput, setTestInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    request: any;
    response: any;
    error?: string;
  } | null>(null);

  const handleTest = () => {
    void (async () => {
      setIsLoading(true);
      setResult(null);

      try {
      // Parse input as JSON if it looks like JSON, otherwise use as string
      let parsedInput;
      try {
        parsedInput = JSON.parse(testInput);
      } catch {
        parsedInput = { input: testInput };
      }

      const request = {
        name: mcpToolName,
        arguments: parsedInput,
      };

      // Call the MCP endpoint on Convex HTTP router
      const convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL || import.meta.env.CONVEX_SITE_URL || "https://resolute-kudu-325.convex.site";
      const response = await fetch(`${convexSiteUrl}/mcp/tools/call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          request,
          response: data,
        });
      } else {
        setResult({
          success: false,
          request,
          response: data,
          error: data.error || data.message || "Unknown error",
        });
      }
    } catch (error: any) {
      setResult({
        success: false,
        request: { name: mcpToolName, arguments: testInput },
        response: null,
        error: error.message || "Failed to invoke MCP tool",
      });
      } finally {
        setIsLoading(false);
      }
    })();
  };

  const getInputPlaceholder = () => {
    if (!mcpInputSchema) {
      return '{"input": "Your test input here"}';
    }

    // Generate example based on schema
    const example: any = {};
    if (mcpInputSchema.properties) {
      Object.keys(mcpInputSchema.properties).forEach((key) => {
        const prop = mcpInputSchema.properties[key];
        if (prop.type === "string") {
          example[key] = prop.description || `Example ${key}`;
        } else if (prop.type === "number") {
          example[key] = 42;
        } else if (prop.type === "boolean") {
          example[key] = true;
        } else {
          example[key] = `<${prop.type}>`;
        }
      });
    }

    return JSON.stringify(example, null, 2);
  };

  return (
    <div className="bg-gray-900/50 rounded-xl border border-green-900/30 p-6">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-green-400">Test via MCP Protocol</h3>
        <p className="text-sm text-green-600 mt-1">
          Test your agent by invoking it through the MCP endpoint
        </p>
      </div>
      <div className="space-y-4">
        {/* Test Input */}
        <div className="space-y-2">
          <label htmlFor="testInput" className="block text-sm font-medium text-green-400">
            Test Input (JSON)
          </label>
          <textarea
            id="testInput"
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder={getInputPlaceholder()}
            className="w-full min-h-[120px] p-3 font-mono text-sm bg-black border border-green-900/30 rounded-lg text-green-400 placeholder-green-600 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none"
          />
          <p className="text-sm text-green-600">
            Enter test input as JSON matching the input schema
          </p>
        </div>

        {/* Test Button */}
        <button
          onClick={handleTest}
          disabled={isLoading || !testInput}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <PlayCircle className="h-4 w-4" />
              Test MCP Invocation
            </>
          )}
        </button>

        {/* Results */}
        {result && (
          <div className="space-y-4 mt-4">
            {/* Status */}
            <div className={`border rounded-lg p-4 ${
              result.success 
                ? "bg-green-900/20 border-green-600/30" 
                : "bg-red-900/20 border-red-600/30"
            }`}>
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                )}
                <p className={result.success ? "text-green-300" : "text-red-300"}>
                  {result.success
                    ? "MCP tool invocation successful"
                    : `MCP tool invocation failed: ${result.error}`}
                </p>
              </div>
            </div>

            {/* Request */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-green-400">MCP Request</label>
              <pre className="p-3 bg-black rounded-md text-xs overflow-x-auto text-green-400">
                {JSON.stringify(result.request, null, 2)}
              </pre>
            </div>

            {/* Response */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-green-400">MCP Response</label>
              <pre className="p-3 bg-black rounded-md text-xs overflow-x-auto text-green-400">
                {JSON.stringify(result.response, null, 2)}
              </pre>
            </div>

            {/* Protocol Compliance */}
            <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4">
              <div className="space-y-2">
                <p className="font-semibold text-blue-400">MCP Protocol Compliance:</p>
                <ul className="list-disc list-inside text-sm space-y-1 text-blue-300">
                  <li>
                    Request format:{" "}
                    {result.request.name && result.request.arguments !== undefined
                      ? "✓ Valid"
                      : "✗ Invalid"}
                  </li>
                  <li>
                    Response format:{" "}
                    {result.success && result.response?.content
                      ? "✓ Valid"
                      : result.success
                      ? "⚠ Missing content field"
                      : "✗ Error response"}
                  </li>
                  <li>
                    HTTP Status:{" "}
                    {result.success ? "✓ 200 OK" : "✗ Error"}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
