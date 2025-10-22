/**
 * Cognito Login Component
 * Styled to match the Agent Builder dark/Matrix theme
 */

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Terminal, Lock, User, Key, Shield } from "lucide-react";

interface CognitoLoginProps {
  onSuccess?: (token: string) => void;
  onCancel?: () => void;
  showCancel?: boolean;
}

export function CognitoLogin({ onSuccess, onCancel, showCancel = true }: CognitoLoginProps) {
  const [username, setUsername] = useState("agentbuilder");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [userPoolId, setUserPoolId] = useState("");
  const [clientId, setClientId] = useState("");
  const [region, setRegion] = useState("us-east-1");

  const getCognitoToken = useAction(api.cognitoAuth.getCognitoToken);
  const getCognitoTokenWithCredentials = useAction(api.cognitoAuth.getCognitoTokenWithCredentials);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      toast.error("Password is required");
      return;
    }

    setIsSubmitting(true);

    try {
      let result;

      if (showAdvanced && userPoolId && clientId) {
        // Use custom credentials
        result = await getCognitoTokenWithCredentials({
          userPoolId,
          clientId,
          username,
          password,
          region,
        });
      } else {
        // Use platform credentials
        result = await getCognitoToken({});
      }

      if (result.success && result.token) {
        toast.success("Authenticated successfully!");
        onSuccess?.(result.token);
      } else {
        toast.error(result.error || "Authentication failed");
      }
    } catch (error: any) {
      toast.error(error.message || "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header with Terminal Icon */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600/20 rounded-full border-2 border-green-600 mb-4">
            <Terminal className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-green-400 mb-2">
            AgentCore Authentication
          </h1>
          <p className="text-green-600">
            Sign in with AWS Cognito to access MCP Runtime
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-gray-900/50 border border-green-900/30 rounded-xl p-6 space-y-4">
            {/* Security Badge */}
            <div className="flex items-center gap-3 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
              <Shield className="w-5 h-5 text-green-400 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-green-400">Secure Connection</p>
                <p className="text-green-600">JWT token-based authentication</p>
              </div>
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-green-400 mb-2">
                <User className="w-4 h-4 inline-block mr-2" />
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="auth-input-field"
                placeholder="agentbuilder"
                required
                disabled={isSubmitting}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-green-400 mb-2">
                <Lock className="w-4 h-4 inline-block mr-2" />
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input-field"
                placeholder="Enter your password"
                required
                disabled={isSubmitting}
              />
            </div>

            {/* Advanced Settings Toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-green-600 hover:text-green-400 transition-colors"
            >
              {showAdvanced ? "▼" : "▶"} Advanced Settings (Custom Cognito Pool)
            </button>

            {/* Advanced Settings */}
            {showAdvanced && (
              <div className="space-y-4 pt-4 border-t border-green-900/30">
                <div>
                  <label className="block text-sm font-medium text-green-400 mb-2">
                    User Pool ID
                  </label>
                  <input
                    type="text"
                    value={userPoolId}
                    onChange={(e) => setUserPoolId(e.target.value)}
                    className="auth-input-field"
                    placeholder="us-east-1_xxxxxxxxx"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-green-400 mb-2">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="auth-input-field"
                    placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxx"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-green-400 mb-2">
                    Region
                  </label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="auth-input-field"
                    disabled={isSubmitting}
                  >
                    <option value="us-east-1">us-east-1</option>
                    <option value="us-east-2">us-east-2</option>
                    <option value="us-west-1">us-west-1</option>
                    <option value="us-west-2">us-west-2</option>
                    <option value="eu-west-1">eu-west-1</option>
                    <option value="eu-central-1">eu-central-1</option>
                    <option value="ap-southeast-1">ap-southeast-1</option>
                    <option value="ap-southeast-2">ap-southeast-2</option>
                  </select>
                </div>
              </div>
            )}

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="auth-button flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Key className="w-5 h-5" />
                  Sign In with Cognito
                </>
              )}
            </button>

            {/* Cancel Button */}
            {showCancel && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="w-full px-4 py-3 rounded-lg border border-green-900/30 text-green-400 hover:bg-green-900/20 transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-600/30 rounded-lg">
          <p className="text-sm text-blue-300">
            <strong className="text-blue-400">Default Credentials:</strong>
            <br />
            Username: agentbuilder
            <br />
            Password: AgentBuilder2025!
            <br />
            <span className="text-xs text-blue-500 mt-2 block">
              These credentials are set in your CloudFormation stack outputs.
            </span>
          </p>
        </div>

        {/* Matrix Effect Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-green-600 font-mono">
            &gt; SECURE_CONNECTION_ESTABLISHED
          </p>
          <p className="text-xs text-green-900 font-mono mt-1">
            &gt; AWAITING_AUTHENTICATION...
          </p>
        </div>
      </div>
    </div>
  );
}
