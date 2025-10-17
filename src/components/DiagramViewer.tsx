import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface DiagramViewerProps {
  deploymentId: Id<"deployments">;
  onClose?: () => void;
}

export function DiagramViewer({ deploymentId, onClose }: DiagramViewerProps) {
  const [selectedFormat, setSelectedFormat] = useState<"svg" | "png" | "mermaid">("svg");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Query for existing diagram
  const diagram = useQuery(api.awsDiagramGenerator.getDiagram, {
    deploymentId,
    format: selectedFormat,
  });

  // Action to generate diagram (using useAction instead of useMutation)
  const generateDiagram = useMutation(api.awsDiagramGenerator.generateArchitectureDiagram as any);

  const handleGenerate = async (isRetry: boolean = false) => {
    setIsGenerating(true);
    setError(null);

    if (isRetry) {
      setRetryCount(prev => prev + 1);
    } else {
      setRetryCount(0);
    }

    try {
      const result = await generateDiagram({
        deploymentId,
        format: selectedFormat,
      });

      if (!result.success) {
        setError(result.error || "Failed to generate diagram");
      } else {
        setRetryCount(0); // Reset retry count on success
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while generating the diagram");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateClick = () => {
    void handleGenerate(false);
  };

  const handleRetryClick = () => {
    void handleGenerate(true);
  };

  const handleExport = () => {
    if (!diagram?.content) return;

    const blob = new Blob([diagram.content], {
      type: selectedFormat === "svg" ? "image/svg+xml" : "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `architecture-diagram.${selectedFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderDiagram = () => {
    if (!diagram?.content) {
      return (
        <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-600">No diagram available</p>
            <p className="text-xs text-gray-500">Click "Generate Diagram" to create one</p>
          </div>
        </div>
      );
    }

    if (selectedFormat === "svg") {
      return (
        <div
          className="bg-white rounded-lg border border-gray-200 p-4 overflow-auto max-h-[600px]"
          dangerouslySetInnerHTML={{ __html: diagram.content }}
        />
      );
    }

    if (selectedFormat === "png") {
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <img
            src={`data:image/png;base64,${diagram.content}`}
            alt="Architecture Diagram"
            className="max-w-full h-auto"
          />
        </div>
      );
    }

    if (selectedFormat === "mermaid") {
      return (
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
          <pre className="text-sm text-gray-100 overflow-auto max-h-[600px]">
            <code>{diagram.content}</code>
          </pre>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Architecture Diagram</h2>
          {diagram && (
            <p className="text-sm text-gray-500 mt-1">
              Generated {new Date(diagram.generatedAt).toLocaleString()}
              {diagram.resourceCount && ` • ${diagram.resourceCount} resources`}
            </p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Format Selector */}
      <div className="flex items-center gap-4 mb-6">
        <label className="text-sm font-medium text-gray-700">Format:</label>
        <div className="flex gap-2">
          {(["svg", "png", "mermaid"] as const).map((format) => (
            <button
              key={format}
              onClick={() => setSelectedFormat(format)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedFormat === format
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {format.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-red-600 mt-0.5 mr-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">Failed to generate diagram</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <div className="mt-3">
                <p className="text-xs text-red-600 font-medium">Troubleshooting:</p>
                <ul className="text-xs text-red-600 mt-1 list-disc list-inside space-y-1">
                  <li>Ensure the AWS Diagram MCP server is configured and running</li>
                  <li>Check that the deployment has valid AWS resources</li>
                  <li>Verify your MCP server configuration in Settings</li>
                  {error.includes('not found') && (
                    <li className="font-medium">Configure the AWS Diagram MCP server in Settings &gt; MCP Servers</li>
                  )}
                  {error.includes('disabled') && (
                    <li className="font-medium">Enable the AWS Diagram MCP server in Settings &gt; MCP Servers</li>
                  )}
                  {error.includes('timeout') && (
                    <li className="font-medium">Try reducing the number of resources or increase the timeout</li>
                  )}
                </ul>
              </div>
              {retryCount < 3 && (
                <button
                  onClick={handleRetryClick}
                  disabled={isGenerating}
                  className="mt-3 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isGenerating ? "Retrying..." : `Retry (${retryCount}/3)`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Diagram Display */}
      <div className="mb-6">{renderDiagram()}</div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <button
            onClick={handleGenerateClick}
            disabled={isGenerating}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              isGenerating
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {isGenerating ? (
              <span className="flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Generating...
              </span>
            ) : diagram ? (
              "Regenerate Diagram"
            ) : (
              "Generate Diagram"
            )}
          </button>

          {diagram && (
            <button
              onClick={handleExport}
              className="px-4 py-2 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Export {selectedFormat.toUpperCase()}
            </button>
          )}
        </div>

        {diagram && (
          <div className="text-xs text-gray-500">
            Last updated: {new Date(diagram.generatedAt).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
