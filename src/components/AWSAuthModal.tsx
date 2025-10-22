/**
 * AWS Authentication Modal
 * Allows users to configure AWS credentials for deployment
 */

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { X, Shield, CheckCircle, AlertCircle } from "lucide-react";

interface AWSAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AWSAuthModal({ isOpen, onClose, onSuccess }: AWSAuthModalProps) {
  const [roleArn, setRoleArn] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);

  const configureRoleArn = useAction(api.awsAuth.configureRoleArn);
  const hasCredentials = useQuery(api.awsAuth.hasValidAWSCredentials);

  if (!isOpen) return null;

  const handleAssumeRoleSubmit = async () => {
    if (!roleArn.trim()) {
      toast.error("Please enter a Role ARN");
      return;
    }

    if (!roleArn.startsWith("arn:aws:iam::")) {
      toast.error("Invalid Role ARN format");
      return;
    }

    setIsValidating(true);
    try {
      const result = await configureRoleArn({ roleArn });
      toast.success("AWS role validated and stored", {
        description: result?.assumedRoleArn ? `Assumed role: ${result.assumedRoleArn}` : undefined,
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error("Failed to configure AWS Role", {
        description: error.message,
      });
    } finally {
      setIsValidating(false);
    }
  };



  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-green-900/30 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-green-900/30">
          <div>
            <h2 className="text-2xl font-bold text-green-400">Configure AWS Deployment</h2>
            <p className="text-green-600 text-sm mt-1">
              Set up AWS credentials to deploy agents to your account
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-green-600 hover:text-green-400 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Security Badge */}
        <div className="p-6 border-b border-green-900/30">
          <div className="flex items-center gap-3 p-4 bg-green-900/20 border border-green-500 rounded-lg">
            <Shield className="w-6 h-6 text-green-400 flex-shrink-0" />
            <div>
              <div className="font-semibold text-green-400 mb-1">Federated Access with Web Identity</div>
              <p className="text-sm text-green-600">
                Deploy to YOUR AWS account using OAuth tokens. No credentials stored - only temporary access.
              </p>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="p-6">
          <div className="space-y-6">
            {/* Instructions */}
            {showInstructions && (
              <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-blue-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Setup Instructions
                  </h3>
                  <button
                    onClick={() => setShowInstructions(false)}
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    Hide
                  </button>
                </div>
                <ol className="text-sm text-blue-300 space-y-3 list-decimal list-inside">
                  <li>
                    Go to AWS IAM Console → Roles → Create Role
                  </li>
                  <li>
                    Select <strong>"Web identity"</strong> as trusted entity
                  </li>
                  <li>
                    Choose identity provider:
                    <ul className="ml-6 mt-1 list-disc">
                      <li>Google (if you signed in with Google)</li>
                      <li>Or configure GitHub OIDC provider</li>
                    </ul>
                  </li>
                  <li>
                    Attach permissions policy: <strong>PowerUserAccess</strong> or create custom policy with:
                    <ul className="ml-6 mt-1 list-disc">
                      <li>ECS full access</li>
                      <li>ECR full access</li>
                      <li>CloudFormation full access</li>
                      <li>IAM limited (for service roles)</li>
                    </ul>
                  </li>
                  <li>
                    Name the role: <strong>AgentBuilderDeploymentRole</strong>
                  </li>
                  <li>
                    Copy the Role ARN and paste below
                  </li>
                </ol>
                <a
                  href="https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-sm underline mt-3 inline-block"
                >
                  View AWS documentation for web identity roles →
                </a>
              </div>
            )}

            {!showInstructions && (
              <button
                onClick={() => setShowInstructions(true)}
                className="text-blue-400 hover:text-blue-300 text-sm underline"
              >
                Show setup instructions
              </button>
            )}

            {/* Role ARN Input */}
            <div>
              <label className="block text-sm font-medium text-green-400 mb-2">
                IAM Role ARN
              </label>
              <input
                type="text"
                value={roleArn}
                onChange={(e) => setRoleArn(e.target.value)}
                placeholder="arn:aws:iam::123456789012:role/AgentBuilderDeploymentRole"
                className="w-full bg-gray-800 border border-green-900/30 rounded-lg px-4 py-3 text-green-400 placeholder-green-600 focus:outline-none focus:border-green-500"
              />
              <p className="text-xs text-green-600 mt-2">
                Format: arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME
              </p>
            </div>

            {/* Submit Button */}
            <button
              onClick={() => void handleAssumeRoleSubmit()}
              disabled={isValidating || !roleArn.trim()}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isValidating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Validating...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Configure Role
                </>
              )}
            </button>
          </div>
        </div>

        {/* Current Status */}
        {hasCredentials && (
          <div className="p-6 border-t border-green-900/30 bg-green-900/10">
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">AWS credentials configured</span>
            </div>
            <p className="text-sm text-green-600 mt-1">
              You can deploy agents to your AWS account
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
