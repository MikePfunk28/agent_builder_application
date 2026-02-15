/**
 * AWS Deployment Flow - Vercel-style Experience
 *
 * Flow:
 * 1. User clicks "Deploy to AWS"
 * 2. Check if they have AWS configured
 * 3. If not, offer two options:
 *    a) Quick Setup - We create role via CloudFormation (1-click)
 *    b) Manual Setup - Step-by-step wizard
 * 4. Once configured, deploy to Bedrock AgentCore
 */

import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";

/**
 * Check deployment readiness
 * Returns what's needed before deployment can proceed
 */
export const checkDeploymentReadiness = query({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    
    if (!userId) {
      return {
        ready: false,
        reason: "authentication_required",
        message: "Please sign in to deploy agents",
        action: "sign_in"
      };
    }

    // Check if user has AWS role configured
    const user = await ctx.db.get(userId);
    const hasAWSRole = Boolean((user as any)?.awsRoleArn);

    if (!hasAWSRole) {
      return {
        ready: false,
        reason: "aws_not_configured",
        message: "AWS deployment not configured",
        action: "configure_aws",
        options: {
          quickSetup: true, // Can use CloudFormation
          manualSetup: true // Can do manual wizard
        }
      };
    }

    // Get agent to check model type
    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      return {
        ready: false,
        reason: "agent_not_found",
        message: "Agent not found"
      };
    }

    return {
      ready: true,
      deploymentType: "bedrock_agentcore",
      requiresECR: false,
      estimatedCost: "Pay-per-use (Bedrock pricing)",
      roleArn: (user as any).awsRoleArn
    };
  },
});

/**
 * Quick Setup - Create IAM role via CloudFormation
 * This is the 1-click option
 */
export const quickSetupAWS = action({
  args: {
    region: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const region = args.region || "us-east-1";

    // Get OAuth token for web identity
    const session = await ctx.auth.getUserIdentity();
    if (!session) {
      throw new Error("No active session");
    }

    // Generate CloudFormation template
    const cfnTemplate = generateQuickSetupTemplate(session.tokenIdentifier);

    // Create CloudFormation stack in user's account
    const { CloudFormationClient, CreateStackCommand } = await import("@aws-sdk/client-cloudformation");

    // First, we need to assume a bootstrap role or use their credentials
    // For quick setup, we'll generate a stack URL they can click
    const stackUrl = generateCloudFormationURL(region, cfnTemplate);

    return {
      method: "cloudformation_url",
      stackUrl,
      instructions: "Click the link to create the IAM role in your AWS account. It will take ~2 minutes.",
      nextStep: "poll_for_role"
    };
  },
});

/**
 * Generate CloudFormation template for quick setup
 */
function generateQuickSetupTemplate(identityProvider: string): string {
  const template = {
    AWSTemplateFormatVersion: "2010-09-09",
    Description: "Agent Builder Deployment Role - Created via Quick Setup",
    Resources: {
      AgentBuilderDeployRole: {
        Type: "AWS::IAM::Role",
        Properties: {
          RoleName: "AgentBuilderDeployRole",
          AssumeRolePolicyDocument: {
            Version: "2012-10-17",
            Statement: [{
              Effect: "Allow",
              Principal: {
                Federated: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
              },
              Action: "sts:AssumeRoleWithWebIdentity",
              Condition: {
                StringEquals: {
                  "sts:ExternalId": "agent-builder-platform"
                }
              }
            }]
          },
          ManagedPolicyArns: [
            "arn:aws:iam::aws:policy/AmazonBedrockFullAccess",
            "arn:aws:iam::aws:policy/AmazonS3FullAccess",
            "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess"
          ],
          Policies: [{
            PolicyName: "AgentCoreDeployment",
            PolicyDocument: {
              Version: "2012-10-17",
              Statement: [{
                Effect: "Allow",
                Action: [
                  "bedrock:*",
                  "lambda:*",
                  "iam:PassRole",
                  "cloudformation:*"
                ],
                Resource: "*"
              }]
            }
          }]
        }
      }
    },
    Outputs: {
      RoleArn: {
        Description: "ARN of the created IAM role",
        Value: { "Fn::GetAtt": ["AgentBuilderDeployRole", "Arn"] },
        Export: {
          Name: "AgentBuilderDeployRoleArn"
        }
      }
    }
  };

  return JSON.stringify(template);
}

/**
 * Generate CloudFormation console URL
 */
function generateCloudFormationURL(region: string, template: string): string {
  const encodedTemplate = encodeURIComponent(template);
  return `https://console.aws.amazon.com/cloudformation/home?region=${region}#/stacks/create/review?templateURL=&stackName=AgentBuilderDeployment&param_IdentityProvider=github`;
}

/**
 * Check for role creation (user-triggered, not polling)
 * User clicks "Check Status" button after creating CloudFormation stack
 */
export const pollForRole: any = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Try to assume the role to verify it exists
    const testRoleArn = "arn:aws:iam::*:role/AgentBuilderDeployRole";
    
    try {
      const result = await ctx.runAction(api.awsAuth.assumeRoleWithWebIdentity, {
        roleArn: testRoleArn
      });

      if (result.success && result.assumedRoleArn) {
        // Role exists! Save it
        await ctx.runMutation(api.awsAuth.storeRoleArn, {
          roleArn: result.assumedRoleArn
        });

        return {
          found: true,
          roleArn: result.assumedRoleArn,
          message: "AWS role configured successfully!"
        };
      }

      return {
        found: false,
        message: "Role not found yet. Please wait for CloudFormation stack to complete."
      };
    } catch (error) {
      return {
        found: false,
        message: "Role not ready yet. Check CloudFormation stack status in AWS Console."
      };
    }
  },
});

/**
 * Deploy based on model type
 */
export const deployAgent: any = action({
  args: {
    agentId: v.id("agents"),
    region: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check readiness
    const readiness = await ctx.runQuery(api.awsDeploymentFlow.checkDeploymentReadiness, {
      agentId: args.agentId
    });

    if (!readiness.ready) {
      throw new Error(`Cannot deploy: ${readiness.message}`);
    }

    // Get agent
    const agent = await ctx.runQuery(internal.agents.getInternal, {
      id: args.agentId
    });

    if (!agent) {
      throw new Error("Agent not found");
    }

    // All deployments go through AgentCore
    return await deployToBedrockAgentCore(ctx, agent, args.region, userId);
  },
});

/**
 * Deploy Bedrock model to AgentCore (Lambda-based, no ECR)
 */
async function deployToBedrockAgentCore(
  ctx: any,
  agent: any,
  region: string,
  userId: string
) {
  // Get temporary credentials
  const user = await ctx.runQuery(internal.awsDeployment.getUserTierInternal, {
    userId
  });

  if (!(user as any)?.awsRoleArn) {
    throw new Error("AWS role not configured");
  }

  const assumeResult = await ctx.runAction(api.awsAuth.assumeRoleWithWebIdentity, {
    roleArn: (user as any).awsRoleArn
  });

  if (!assumeResult.success) {
    throw new Error(assumeResult.error || "Failed to assume role");
  }

  const { credentials } = assumeResult;

  // Deploy to Bedrock AgentCore (Lambda-based)
  const {
    LambdaClient,
    CreateFunctionCommand,
    UpdateFunctionCodeCommand
  } = await import("@aws-sdk/client-lambda");

  const lambdaClient = new LambdaClient({
    region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken
    }
  });

  // Create Lambda function for AgentCore
  const functionName = `agent-${agent._id}`;
  
  // Generate agent code
  const agentCode = generateBedrockAgentCode(agent);
  
  // Package as Lambda deployment package
  const deploymentPackage = await packageForLambda(agentCode);

  try {
    // Try to create new function
    await lambdaClient.send(new CreateFunctionCommand({
      FunctionName: functionName,
      Runtime: "python3.11",
      Role: (user as any).awsRoleArn, // Lambda execution role
      Handler: "agent.handler",
      Code: {
        ZipFile: deploymentPackage
      },
      Environment: {
        Variables: {
          AGENT_NAME: agent.name,
          MODEL_ID: agent.model
        }
      },
      Timeout: 300,
      MemorySize: 512
    }));
  } catch (error: any) {
    if (error.name === "ResourceConflictException") {
      // Function exists, update it
      await lambdaClient.send(new UpdateFunctionCodeCommand({
        FunctionName: functionName,
        ZipFile: deploymentPackage
      }));
    } else {
      throw error;
    }
  }

  return {
    deploymentType: "bedrock_agentcore",
    functionName,
    endpoint: `https://${functionName}.lambda-url.${region}.on.aws/`,
    message: "Deployed to Bedrock AgentCore (Lambda)"
  };
}

// Fargate/ECS deployment removed — all deployments now go through Bedrock AgentCore.

/**
 * Generate Bedrock agent code (Lambda handler)
 */
function generateBedrockAgentCode(agent: any): string {
  return `
import json
import boto3
from strands import Agent
from strands.models import BedrockModel

# Initialize Bedrock client
bedrock = boto3.client('bedrock-runtime')

# Initialize agent
model = BedrockModel(model_id="${agent.model}")
agent = Agent(
    model=model,
    system_prompt="""${agent.systemPrompt}""",
    tools=[]
)

def handler(event, context):
    """Lambda handler for Bedrock AgentCore"""
    try:
        body = json.loads(event.get('body', '{}'))
        user_input = body.get('message', '')
        
        # Process with agent
        response = agent(user_input)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': response.message['content'][0]['text'],
                'agent': '${agent.name}'
            })
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
`;
}

// ECS/Fargate stubs removed — all deployments now use Bedrock AgentCore.
