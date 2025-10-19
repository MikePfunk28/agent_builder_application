import { useState, useEffect } from "react";
import { Network, DollarSign, Zap, Server, Database, Shield } from "lucide-react";

interface Tool {
  name: string;
  type: string;
  config?: any;
  requiresPip?: boolean;
  pipPackages?: string[];
}

interface ArchitecturePreviewProps {
  agentName: string;
  model: string;
  tools: Tool[];
  deploymentType: string;
}

interface ResourceEstimate {
  name: string;
  type: string;
  icon: React.ReactNode;
  description: string;
  cost?: string;
}

export function ArchitecturePreview({
  agentName,
  model,
  tools,
  deploymentType,
}: ArchitecturePreviewProps) {
  const [resources, setResources] = useState<ResourceEstimate[]>([]);
  const [estimatedCost, setEstimatedCost] = useState<string>("");
  const [tier, setTier] = useState<string>("");

  useEffect(() => {
    // Determine tier based on deployment type and model
    const determinedTier = determineDeploymentTier(deploymentType, model);
    setTier(determinedTier);

    // Build resource list
    const resourceList = buildResourceEstimates(determinedTier, agentName);
    setResources(resourceList);

    // Calculate estimated cost
    const cost = calculateEstimatedCost(determinedTier);
    setEstimatedCost(cost);
  }, [agentName, model, tools, deploymentType]);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-600/30 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-600/20 rounded-lg">
            <Network className="w-6 h-6 text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-blue-400 mb-2">
              Architecture Preview
            </h3>
            <p className="text-sm text-blue-300/70 mb-4">
              Your agent will be deployed using the following AWS resources based on your
              configuration.
            </p>
            
            {/* Tier Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600/30 border border-blue-500/50 rounded-full">
              <Zap className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-300">
                {tier === "tier1" && "Tier 1: Freemium (AgentCore)"}
                {tier === "tier2" && "Tier 2: Personal AWS (Fargate)"}
                {tier === "tier3" && "Tier 3: Enterprise"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* AWS Resources */}
      <div>
        <h4 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
          <Server className="w-4 h-4" />
          AWS Resources
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {resources.map((resource, index) => (
            <div
              key={index}
              className="p-4 bg-black border border-green-900/30 rounded-lg hover:border-green-600/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-600/10 rounded-md">
                  {resource.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-green-400 text-sm">
                    {resource.name}
                  </div>
                  <div className="text-xs text-green-600 mt-0.5">
                    {resource.type}
                  </div>
                  <div className="text-xs text-green-300/70 mt-1">
                    {resource.description}
                  </div>
                  {resource.cost && (
                    <div className="text-xs text-yellow-400 mt-1 font-medium">
                      {resource.cost}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tool Dependencies */}
      {tools.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
            <Database className="w-4 h-4" />
            Tool Dependencies
          </h4>
          <div className="space-y-2">
            {tools.map((tool, index) => (
              <div
                key={index}
                className="p-3 bg-black border border-green-900/30 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-green-400 text-sm">
                      {tool.name}
                    </div>
                    <div className="text-xs text-green-600 mt-0.5">
                      {tool.type}
                    </div>
                  </div>
                  {tool.requiresPip && tool.pipPackages && (
                    <div className="text-xs text-yellow-400 font-mono">
                      {tool.pipPackages.join(", ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cost Estimate */}
      <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border border-yellow-600/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-yellow-600/20 rounded-lg">
            <DollarSign className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-yellow-400 mb-1">
              Estimated Cost
            </h4>
            <div className="text-2xl font-bold text-yellow-300 mb-2">
              {estimatedCost}
            </div>
            <p className="text-xs text-yellow-300/70">
              {tier === "tier1" &&
                "Freemium tier includes limited free usage. Additional usage charged per request."}
              {tier === "tier2" &&
                "Costs include Fargate compute, storage, and data transfer. You only pay when your agent is active."}
              {tier === "tier3" &&
                "Enterprise pricing includes dedicated resources, SSO, and priority support."}
            </p>
          </div>
        </div>
      </div>

      {/* Security & Compliance */}
      <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-600/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-purple-600/20 rounded-lg">
            <Shield className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-purple-400 mb-2">
              Security & Compliance
            </h4>
            <ul className="space-y-1 text-xs text-purple-300/70">
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 bg-purple-400 rounded-full" />
                IAM roles with least privilege access
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 bg-purple-400 rounded-full" />
                Encrypted data at rest and in transit
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 bg-purple-400 rounded-full" />
                CloudWatch logging and monitoring
              </li>
              {tier === "tier2" && (
                <li className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-purple-400 rounded-full" />
                  VPC isolation with private subnets
                </li>
              )}
              {tier === "tier3" && (
                <>
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-purple-400 rounded-full" />
                    AWS SSO integration
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-purple-400 rounded-full" />
                    Secrets Manager for credential storage
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-900/10 border border-blue-600/30 rounded-lg p-4">
        <p className="text-xs text-blue-300/70">
          <strong className="text-blue-400">Note:</strong> This is an estimated
          architecture preview. The actual deployment may include additional resources
          based on your AWS account configuration and security requirements. You can
          view the detailed architecture diagram after deployment.
        </p>
      </div>
    </div>
  );
}

function determineDeploymentTier(deploymentType: string, model: string): string {
  // Tier 2: Personal AWS (Fargate) - Docker, Ollama, or custom models
  // Check these first as they take priority
  if (deploymentType === "docker" || deploymentType === "ollama") {
    return "tier2";
  }

  // Tier 1: Freemium (AgentCore) - Bedrock models only
  // Bedrock models can be identified by:
  // 1. Containing "bedrock" in the name
  // 2. Using AWS Bedrock provider prefixes (anthropic., amazon., meta., cohere., ai21., mistral.)
  if (deploymentType === "aws") {
    const bedrockProviders = ["anthropic.", "amazon.", "meta.", "cohere.", "ai21.", "mistral."];
    const isBedrockModel = model.includes("bedrock") || 
                          bedrockProviders.some(provider => model.startsWith(provider));
    
    if (isBedrockModel) {
      return "tier1";
    }
    
    // Non-Bedrock AWS deployments use Fargate (tier2)
    return "tier2";
  }

  // Default to tier1 for local development
  return "tier1";
}

function buildResourceEstimates(
  tier: string,
  _agentName: string
): ResourceEstimate[] {
  const resources: ResourceEstimate[] = [];

  if (tier === "tier1") {
    // Tier 1: AgentCore (Bedrock)
    resources.push({
      name: "AWS Bedrock AgentCore",
      type: "Managed Runtime",
      icon: <Zap className="w-4 h-4 text-purple-400" />,
      description: "Serverless agent execution environment",
      cost: "$0.001/request",
    });

    resources.push({
      name: "Lambda Function",
      type: "Compute",
      icon: <Server className="w-4 h-4 text-orange-400" />,
      description: "Agent invocation handler",
      cost: "Included",
    });

    resources.push({
      name: "CloudWatch Logs",
      type: "Monitoring",
      icon: <Database className="w-4 h-4 text-blue-400" />,
      description: "Log aggregation and monitoring",
      cost: "$0.50/GB",
    });
  } else if (tier === "tier2") {
    // Tier 2: Personal AWS (Fargate)
    resources.push({
      name: "VPC",
      type: "Network",
      icon: <Network className="w-4 h-4 text-blue-400" />,
      description: "Isolated virtual network",
      cost: "Free",
    });

    resources.push({
      name: "ECS Fargate",
      type: "Compute",
      icon: <Server className="w-4 h-4 text-orange-400" />,
      description: "Containerized agent execution",
      cost: "$0.04/hour",
    });

    resources.push({
      name: "ECR Repository",
      type: "Storage",
      icon: <Database className="w-4 h-4 text-green-400" />,
      description: "Docker image storage",
      cost: "$0.10/GB/month",
    });

    resources.push({
      name: "CloudWatch Logs",
      type: "Monitoring",
      icon: <Database className="w-4 h-4 text-blue-400" />,
      description: "Log aggregation and monitoring",
      cost: "$0.50/GB",
    });

    resources.push({
      name: "Application Load Balancer",
      type: "Network",
      icon: <Network className="w-4 h-4 text-purple-400" />,
      description: "Traffic distribution (optional)",
      cost: "$0.0225/hour",
    });
  } else if (tier === "tier3") {
    // Tier 3: Enterprise (includes all Tier 2 + SSO)
    resources.push({
      name: "VPC",
      type: "Network",
      icon: <Network className="w-4 h-4 text-blue-400" />,
      description: "Isolated virtual network",
      cost: "Free",
    });

    resources.push({
      name: "ECS Fargate",
      type: "Compute",
      icon: <Server className="w-4 h-4 text-orange-400" />,
      description: "Containerized agent execution",
      cost: "$0.04/hour",
    });

    resources.push({
      name: "ECR Repository",
      type: "Storage",
      icon: <Database className="w-4 h-4 text-green-400" />,
      description: "Docker image storage",
      cost: "$0.10/GB/month",
    });

    resources.push({
      name: "AWS SSO",
      type: "Identity",
      icon: <Shield className="w-4 h-4 text-purple-400" />,
      description: "Single sign-on integration",
      cost: "Included",
    });

    resources.push({
      name: "Secrets Manager",
      type: "Security",
      icon: <Shield className="w-4 h-4 text-red-400" />,
      description: "Secure credential storage",
      cost: "$0.40/secret/month",
    });

    resources.push({
      name: "CloudWatch Dashboard",
      type: "Monitoring",
      icon: <Database className="w-4 h-4 text-blue-400" />,
      description: "Custom metrics and alerts",
      cost: "$3/dashboard/month",
    });
  }

  return resources;
}

function calculateEstimatedCost(tier: string): string {
  if (tier === "tier1") {
    // Tier 1: AgentCore - pay per request
    return "$0.001 - $0.01/request";
  } else if (tier === "tier2") {
    // Tier 2: Fargate - pay per hour when active
    const baseCost = 0.04; // Fargate (includes storage and logs in estimate)
    
    const estimatedHourly = baseCost;
    const estimatedMonthly = estimatedHourly * 24 * 30; // Assuming 24/7 operation
    
    return `~$${estimatedHourly.toFixed(2)}/hour (~$${estimatedMonthly.toFixed(2)}/month)`;
  } else if (tier === "tier3") {
    // Tier 3: Enterprise - contact for pricing
    return "Contact for enterprise pricing";
  }

  return "Free (local development)";
}
