/**
 * AWS Role Setup Component
 * Guides users through creating IAM role and configuring deployment
 */

import React, { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Copy, Check, ExternalLink, AlertCircle } from "lucide-react";

export function AWSRoleSetup() {
  const [roleArn, setRoleArn] = useState("");
  const [step, setStep] = useState(0); // 0 = choose method
  const [setupMethod, setSetupMethod] = useState<"quick" | "manual" | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const storeRoleArn = useMutation(api.awsAuth.storeRoleArn);
  const hasAWSCreds = useQuery(api.awsAuth.hasValidAWSCredentials);
  const awsCreds = useQuery(api.awsAuth.getAWSCredentials);
  const quickSetup = useMutation(api.awsDeploymentFlow.quickSetupAWS);
  const pollForRole = useMutation(api.awsDeploymentFlow.pollForRole);

  // Get the OAuth provider being used
  const getOAuthProvider = () => {
    // This would come from the user's session
    // For now, show all options
    return "github"; // or "google" or "cognito"
  };

  const getTrustPolicy = () => {
    const provider = getOAuthProvider();
    
    const policies: Record<string, any> = {
      github: {
        principal: "token.actions.githubusercontent.com",
        condition: {
          "StringEquals": {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
          }
        }
      },
      google: {
        principal: "accounts.google.com",
        condition: {
          "StringEquals": {
            "accounts.google.com:aud": "YOUR_GOOGLE_CLIENT_ID"
          }
        }
      },
      cognito: {
        principal: "cognito-identity.amazonaws.com",
        condition: {
          "StringEquals": {
            "cognito-identity.amazonaws.com:aud": "YOUR_COGNITO_IDENTITY_POOL_ID"
          }
        }
      }
    };

    const config = policies[provider] || policies.github;

    return {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: {
            Federated: config.principal
          },
          Action: "sts:AssumeRoleWithWebIdentity",
          Condition: config.condition
        }
      ]
    };
  };

  const getPermissionsPolicy = () => {
    return {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "AgentCoreDeployment",
          Effect: "Allow",
          Action: [
            "bedrock:CreateAgent",
            "bedrock:CreateAgentActionGroup",
            "bedrock:InvokeAgent",
            "bedrock:InvokeModel",
            "bedrock:InvokeModelWithResponseStream",
            "bedrock:GetAgent",
            "bedrock:ListAgents",
            "iam:PassRole",
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents",
            "s3:CreateBucket",
            "s3:PutObject",
            "s3:GetObject",
            "cloudformation:CreateStack",
            "cloudformation:UpdateStack",
            "cloudformation:DescribeStacks"
          ],
          Resource: "*"
        }
      ]
    };
  };

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSaveRoleArn = async () => {
    if (!roleArn.startsWith("arn:aws:iam::")) {
      toast.error("Invalid Role ARN format");
      return;
    }

    try {
      await storeRoleArn({ roleArn });
      toast.success("AWS Role configured successfully!");
      setStep(4);
    } catch (error: any) {
      toast.error("Failed to save role", {
        description: error.message
      });
    }
  };

  if (hasAWSCreds && awsCreds) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Check className="w-6 h-6 text-green-600 mt-1" />
          <div className="flex-1">
            <h3 className="font-semibold text-green-900 mb-2">
              AWS Deployment Configured
            </h3>
            <p className="text-sm text-green-700 mb-3">
              Your AWS role is configured and ready for deployment.
            </p>
            {awsCreds.method === "assumeRole" && (
              <div className="bg-white rounded p-3 mb-3">
                <p className="text-xs text-gray-500 mb-1">Role ARN:</p>
                <code className="text-sm text-gray-900 break-all">
                  {awsCreds.roleArn}
                </code>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-green-700 hover:text-green-800 underline"
            >
              Reconfigure
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleQuickSetup = async () => {
    try {
      const result = await quickSetup({ region: "us-east-1" });
      
      // Open CloudFormation URL in new tab
      window.open(result.stackUrl, "_blank");
      
      toast.info("CloudFormation stack opened in new tab", {
        description: "Click 'Create Stack' and come back here when done."
      });
      
      setStep(5); // Show waiting screen with manual check button
    } catch (error: any) {
      toast.error("Quick setup failed", {
        description: error.message
      });
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4">
        Configure AWS Deployment
      </h2>
      
      {step > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`flex-1 h-2 rounded ${
                  s <= step ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Step 0: Choose Setup Method */}
      {step === 0 && (
        <div>
          <h3 className="font-semibold mb-3">Choose Setup Method</h3>
          <p className="text-sm text-gray-600 mb-6">
            How would you like to configure AWS deployment?
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Quick Setup */}
            <button
              onClick={() => {
                setSetupMethod("quick");
                void handleQuickSetup();
              }}
              className="border-2 border-blue-600 rounded-lg p-6 hover:bg-blue-50 text-left transition-colors"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-lg mb-1">Quick Setup</h4>
                  <p className="text-sm text-gray-600">
                    Recommended - We create the IAM role for you
                  </p>
                </div>
              </div>
              <ul className="text-sm space-y-2 text-gray-700">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  One-click CloudFormation deployment
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  Takes ~2 minutes
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  Automatic configuration
                </li>
              </ul>
            </button>

            {/* Manual Setup */}
            <button
              onClick={() => {
                setSetupMethod("manual");
                setStep(1);
              }}
              className="border-2 border-gray-300 rounded-lg p-6 hover:bg-gray-50 text-left transition-colors"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 bg-gray-600 rounded-lg flex items-center justify-center text-white font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-lg mb-1">Manual Setup</h4>
                  <p className="text-sm text-gray-600">
                    Step-by-step guide for custom configuration
                  </p>
                </div>
              </div>
              <ul className="text-sm space-y-2 text-gray-700">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-gray-600" />
                  Full control over IAM policies
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-gray-600" />
                  Custom security settings
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-gray-600" />
                  Takes ~5-10 minutes
                </li>
              </ul>
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Waiting for CloudFormation */}
      {step === 5 && (
        <div className="text-center py-8">
          <Check className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h3 className="font-semibold mb-2">CloudFormation Stack Opened</h3>
          <p className="text-sm text-gray-600 mb-4">
            Complete the stack creation in AWS Console (takes 1-2 minutes).
          </p>
          <p className="text-xs text-gray-500 mb-6">
            Once the stack shows "CREATE_COMPLETE", click the button below.
          </p>
          <button
            onClick={async () => {
              try {
                const result = await pollForRole();
                if (result.found) {
                  toast.success("AWS role configured successfully!");
                  window.location.reload();
                } else {
                  toast.error("Role not found yet. Please wait for stack to complete.");
                }
              } catch (error: any) {
                toast.error("Failed to check role status", {
                  description: error.message
                });
              }
            }}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            Check Status
          </button>
        </div>
      )}

      {/* Step 1: Create IAM Role (Manual) */}
      {step === 1 && setupMethod === "manual" && (
        <div>
          <h3 className="font-semibold mb-3">Step 1: Create IAM Role</h3>
          <p className="text-sm text-gray-600 mb-4">
            Create an IAM role in your AWS account that allows web identity federation.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">Why do I need this?</p>
                <p>
                  This role allows our platform to deploy agents to YOUR AWS account
                  using your OAuth credentials (GitHub/Google/Cognito). You maintain
                  full control and pay only for what you use.
                </p>
              </div>
            </div>
          </div>

          <ol className="list-decimal list-inside space-y-3 text-sm mb-4">
            <li>
              Open the{" "}
              <a
                href="https://console.aws.amazon.com/iam/home#/roles"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                IAM Console
                <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li>Click "Create role"</li>
            <li>Select "Web identity" as the trusted entity type</li>
            <li>Choose your identity provider (GitHub, Google, or Cognito)</li>
            <li>Click "Next" and proceed to Step 2</li>
          </ol>

          <button
            onClick={() => setStep(2)}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Continue to Trust Policy
          </button>
        </div>
      )}

      {/* Step 2: Trust Policy */}
      {step === 2 && (
        <div>
          <h3 className="font-semibold mb-3">Step 2: Configure Trust Policy</h3>
          <p className="text-sm text-gray-600 mb-4">
            Copy this trust policy and paste it in the IAM role creation wizard.
          </p>

          <div className="bg-gray-900 rounded-lg p-4 mb-4 relative">
            <button
              onClick={() =>
                copyToClipboard(
                  JSON.stringify(getTrustPolicy(), null, 2),
                  "Trust Policy"
                )
              }
              className="absolute top-2 right-2 p-2 bg-gray-800 hover:bg-gray-700 rounded text-white"
            >
              {copied === "Trust Policy" ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            <pre className="text-xs text-green-400 overflow-x-auto">
              {JSON.stringify(getTrustPolicy(), null, 2)}
            </pre>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
            <p className="text-xs text-yellow-800">
              <strong>Note:</strong> Replace placeholder values (like YOUR_GOOGLE_CLIENT_ID)
              with your actual OAuth app credentials.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep(1)}
              className="flex-1 border border-gray-300 py-2 rounded hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              Continue to Permissions
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Permissions Policy */}
      {step === 3 && (
        <div>
          <h3 className="font-semibold mb-3">Step 3: Attach Permissions Policy</h3>
          <p className="text-sm text-gray-600 mb-4">
            Attach this permissions policy to allow agent deployment.
          </p>

          <div className="bg-gray-900 rounded-lg p-4 mb-4 relative">
            <button
              onClick={() =>
                copyToClipboard(
                  JSON.stringify(getPermissionsPolicy(), null, 2),
                  "Permissions Policy"
                )
              }
              className="absolute top-2 right-2 p-2 bg-gray-800 hover:bg-gray-700 rounded text-white"
            >
              {copied === "Permissions Policy" ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            <pre className="text-xs text-green-400 overflow-x-auto">
              {JSON.stringify(getPermissionsPolicy(), null, 2)}
            </pre>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
            <p className="text-xs text-blue-800">
              <strong>Security Tip:</strong> You can restrict these permissions further
              by adding resource-specific ARNs instead of using "*".
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep(2)}
              className="flex-1 border border-gray-300 py-2 rounded hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={() => setStep(4)}
              className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              Continue to Role ARN
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Enter Role ARN */}
      {step === 4 && (
        <div>
          <h3 className="font-semibold mb-3">Step 4: Enter Role ARN</h3>
          <p className="text-sm text-gray-600 mb-4">
            After creating the role, copy its ARN and paste it below.
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              IAM Role ARN
            </label>
            <input
              type="text"
              value={roleArn}
              onChange={(e) => setRoleArn(e.target.value)}
              placeholder="arn:aws:iam::123456789012:role/AgentBuilderDeployRole"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Format: arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded p-3 mb-4">
            <p className="text-xs text-green-800">
              <strong>What happens next?</strong> When you deploy an agent, we'll use
              your OAuth credentials to assume this role and deploy to your AWS account.
              You'll see all resources created in your AWS console.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep(3)}
              className="flex-1 border border-gray-300 py-2 rounded hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={handleSaveRoleArn}
              disabled={!roleArn.startsWith("arn:aws:iam::")}
              className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Save and Complete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
