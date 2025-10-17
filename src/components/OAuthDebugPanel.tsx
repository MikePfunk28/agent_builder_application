import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function OAuthDebugPanel() {
  const config = useQuery(api.authDebug.getOAuthConfig);

  if (!config) {
    return <div className="p-4">Loading OAuth configuration...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">OAuth Configuration Debug Panel</h2>

      {/* Provider Status */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4">Provider Status</h3>
        <div className="space-y-4">
          {config.providers.map((provider) => (
            <div
              key={provider.id}
              className={`p-4 rounded-lg border-2 ${
                provider.configured
                  ? "border-green-500 bg-green-50"
                  : "border-red-500 bg-red-50"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-lg">{provider.name}</h4>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    provider.configured
                      ? "bg-green-200 text-green-800"
                      : "bg-red-200 text-red-800"
                  }`}
                >
                  {provider.configured ? "✓ Configured" : "✗ Not Configured"}
                </span>
              </div>
              <div className="text-sm space-y-1">
                {Object.entries(provider.envVars).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="font-mono text-gray-600">{key}:</span>
                    <span className={value.includes("✓") ? "text-green-600" : "text-red-600"}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Expected Callback URLs */}
      <div>
        <h3 className="text-xl font-semibold mb-4">Expected Callback URLs</h3>
        <div className="space-y-6">
          {config.environments.map((env) => (
            <div key={env.name} className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold mb-2">{env.name}</h4>
              <p className="text-sm text-gray-600 mb-3">{env.url}</p>
              <div className="space-y-2">
                {env.callbackUrls.map((callback) => (
                  <div key={callback.provider} className="flex items-start gap-2">
                    <span className="font-mono text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded min-w-[80px] text-center">
                      {callback.provider}
                    </span>
                    <code className="text-xs bg-white px-2 py-1 rounded border flex-1 break-all">
                      {callback.url}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
        <h4 className="font-semibold mb-2">Setup Instructions</h4>
        <ol className="text-sm space-y-2 list-decimal list-inside">
          <li>Ensure all environment variables are set in Convex dashboard</li>
          <li>Add the callback URLs above to each OAuth provider's configuration</li>
          <li>For GitHub: Settings → Developer settings → OAuth Apps</li>
          <li>For Google: Cloud Console → APIs & Services → Credentials</li>
          <li>For Cognito: AWS Console → Cognito → User Pools → App clients</li>
        </ol>
      </div>
    </div>
  );
}
