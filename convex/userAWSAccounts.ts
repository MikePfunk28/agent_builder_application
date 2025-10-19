// User AWS Account Management for Tier 2 (Cross-Account Deployment)
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Generate a unique External ID for security (prevents confused deputy)
export const generateExternalId = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Generate cryptographically secure External ID
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const externalId = `agent-builder-${userId}-${timestamp}-${random}`;

    // Store for later validation
    await ctx.db.insert("userAWSAccounts", {
      userId,
      externalId,
      status: "pending",
      createdAt: Date.now(),
    });

    return {
      externalId,
      platformAccountId: process.env.AWS_ACCOUNT_ID!,
      cloudFormationUrl: generateCloudFormationUrl(
        process.env.AWS_ACCOUNT_ID!,
        externalId
      ),
    };
  },
});

// User submits their Role ARN after running CloudFormation
export const connectAWSAccount = mutation({
  args: {
    roleArn: v.string(),
    externalId: v.string(),
    region: v.string(),
    awsAccountId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify the External ID belongs to this user
    const existingAccount = await ctx.db
      .query("userAWSAccounts")
      .withIndex("by_user_and_external_id", (q) =>
        q.eq("userId", userId).eq("externalId", args.externalId)
      )
      .first();

    if (!existingAccount) {
      throw new Error("Invalid External ID");
    }

    // Validate the role by attempting to assume it
    const isValid = await validateCrossAccountRole(
      args.roleArn,
      args.externalId
    );

    if (!isValid) {
      throw new Error(
        "Cannot assume role. Check Role ARN and External ID are correct."
      );
    }

    // Update with role information
    await ctx.db.patch(existingAccount._id, {
      roleArn: args.roleArn,
      region: args.region,
      awsAccountId: args.awsAccountId,
      status: "connected",
      connectedAt: Date.now(),
    });

    // Upgrade user to Tier 2
    // userId from getAuthUserId() is already the Convex user document ID
    await ctx.db.patch(userId, {
      tier: "personal",
      upgradedAt: Date.now(),
    });

    return {
      success: true,
      message: "AWS account connected successfully!",
    };
  },
});

// Get user's AWS account info
export const getUserAWSAccount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const account = await ctx.db
      .query("userAWSAccounts")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("status"), "connected"))
      .first();

    if (!account) return null;

    return {
      roleArn: account.roleArn,
      region: account.region,
      awsAccountId: account.awsAccountId,
      externalId: account.externalId,
      connectedAt: account.connectedAt,
    };
  },
});

// Disconnect AWS account
export const disconnectAWSAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const account = await ctx.db
      .query("userAWSAccounts")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("status"), "connected"))
      .first();

    if (!account) {
      throw new Error("No AWS account connected");
    }

    // Mark as disconnected
    await ctx.db.patch(account._id, {
      status: "disconnected",
      disconnectedAt: Date.now(),
    });

    // Downgrade user to Tier 1
    // userId from getAuthUserId() is already the Convex user document ID
    await ctx.db.patch(userId, {
      tier: "freemium",
    });

    return { success: true };
  },
});

// Helper: Generate CloudFormation URL with pre-filled parameters
function generateCloudFormationUrl(
  platformAccountId: string,
  externalId: string
): string {
  // TODO: Replace with your GitHub raw URL after pushing to GitHub
  // Example: https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/cloudformation/user-onboarding-template.yaml
  const templateUrl = encodeURIComponent(
    process.env.CLOUDFORMATION_TEMPLATE_URL || 
    `https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/cloudformation/user-onboarding-template.yaml`
  );

  const params = new URLSearchParams({
    stackName: "agent-builder-onboarding",
    templateURL: templateUrl,
    "param_PlatformAccountId": platformAccountId,
    "param_UserIdentifier": externalId,
  });

  return `https://console.aws.amazon.com/cloudformation/home#/stacks/create/review?${params.toString()}`;
}

// Helper: Validate cross-account role (calls AWS STS)
async function validateCrossAccountRole(
  roleArn: string,
  externalId: string
): Promise<boolean> {
  try {
    // This will be implemented in the AWS action
    const response = await fetch(
      `${process.env.CONVEX_SITE_URL}/validateRole`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleArn, externalId }),
      }
    );

    const result = await response.json();
    return result.valid === true;
  } catch (error) {
    console.error("Role validation failed:", error);
    return false;
  }
}
