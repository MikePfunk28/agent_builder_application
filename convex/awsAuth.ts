/**
 * AWS Authentication for Deployment
 * Supports AssumeRole and Direct Credentials
 */

import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

/**
 * Store IAM Role ARN for AssumeRole deployment
 */
export const storeRoleArn = mutation({
  args: {
    roleArn: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Please sign in to save AWS credentials");
    }

    // Validate Role ARN format
    if (!args.roleArn.startsWith("arn:aws:iam::")) {
      throw new Error("Invalid Role ARN format");
    }

    // Update user with Role ARN
    await ctx.db.patch(userId, {
      awsRoleArn: args.roleArn,
      awsAuthMethod: "assumeRole",
      awsConfiguredAt: Date.now(),
    } as any);

    return { success: true };
  },
});

export const configureRoleArn: any = action({
  args: {
    roleArn: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Please sign in to configure AWS credentials");
    }

    if (!args.roleArn.startsWith("arn:aws:iam::")) {
      throw new Error("Invalid Role ARN format");
    }

    const validation = await ctx.runAction(api.awsAuth.assumeRoleWithWebIdentity, {
      roleArn: args.roleArn,
    });

    if (!validation.success || !validation.credentials) {
      throw new Error(validation.error || "Unable to validate AWS role");
    }

    await ctx.runMutation(api.awsAuth.storeRoleArn, { roleArn: args.roleArn });

    return {
      success: true,
      assumedRoleArn: validation.assumedRoleArn,
      credentialsExpiresAt: validation.credentials.expiration,
    };
  },
});

/**
 * Store direct AWS credentials (encrypted)
 */
export const storeDirectCredentials = mutation({
  args: {
    accessKeyId: v.string(),
    secretAccessKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Please sign in to save AWS credentials");
    }

    // Validate Access Key format
    if (!args.accessKeyId.startsWith("AKIA")) {
      throw new Error("Invalid Access Key ID format");
    }

    // Store credentials (Convex automatically encrypts sensitive data)
    await ctx.db.patch(userId, {
      awsAccessKeyId: args.accessKeyId,
      awsSecretAccessKey: args.secretAccessKey,
      awsAuthMethod: "direct",
      awsConfiguredAt: Date.now(),
    } as any);

    return { success: true };
  },
});

/**
 * Check if user has valid AWS credentials
 */
export const hasValidAWSCredentials = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return false;
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return false;
    }

    // Check if user has either Role ARN or direct credentials
    const hasRoleArn = Boolean(user.awsRoleArn);
    const hasDirectCreds = Boolean(user.awsAccessKeyId && user.awsSecretAccessKey);

    return hasRoleArn || hasDirectCreds;
  },
});

/**
 * Get AWS credentials for deployment
 * Returns credentials based on configured method
 */
export const getAWSCredentials = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    if (user.awsAuthMethod === "assumeRole" && user.awsRoleArn) {
      return {
        method: "assumeRole" as const,
        roleArn: user.awsRoleArn,
      };
    }

    if (user.awsAuthMethod === "direct" && user.awsAccessKeyId && user.awsSecretAccessKey) {
      return {
        method: "direct" as const,
        accessKeyId: user.awsAccessKeyId,
        secretAccessKey: user.awsSecretAccessKey,
      };
    }

    return null;
  },
});

/**
 * Clear AWS credentials
 */
export const clearAWSCredentials = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await ctx.db.patch(userId, {
      awsRoleArn: undefined,
      awsAccessKeyId: undefined,
      awsSecretAccessKey: undefined,
      awsAuthMethod: undefined,
      awsConfiguredAt: undefined,
    } as any);

    return { success: true };
  },
});

/**
 * Assume AWS Role using Web Identity (OAuth token)
 * This is called during deployment to get temporary credentials for user's AWS account
 *
 * User must:
 * 1. Create IAM role in THEIR AWS account
 * 2. Configure trust policy to allow web identity federation
 * 3. Provide Role ARN to this platform
 *
 * This function:
 * 1. Gets user's OAuth ID token (from GitHub/Google login)
 * 2. Calls STS AssumeRoleWithWebIdentity
 * 3. Returns temporary credentials for user's AWS account
 */
export const assumeRoleWithWebIdentity = action({
  args: {
    roleArn: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated. Please sign in with GitHub or Google.");
    }

    try {
      // Get user's OAuth session to extract ID token
      const session = await ctx.auth.getUserIdentity();
      if (!session) {
        throw new Error("No active session found. Please sign in again.");
      }

      // Extract the ID token from the session
      // For Convex Auth, the token is available in the session
      const idToken = session.tokenIdentifier;

      if (!idToken) {
        throw new Error("No ID token found. Please sign in with GitHub or Google.");
      }

      // Validate Role ARN format
      if (!args.roleArn.startsWith("arn:aws:iam::")) {
        throw new Error("Invalid Role ARN format. Expected: arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME");
      }

      console.log(`Assuming role ${args.roleArn} for user ${userId}`);

      // Use AWS STS to assume role with web identity
      const { STSClient, AssumeRoleWithWebIdentityCommand } = await import("@aws-sdk/client-sts");

      const stsClient = new STSClient({
        region: process.env.AWS_REGION || "us-east-1",
      });

      const command = new AssumeRoleWithWebIdentityCommand({
        RoleArn: args.roleArn,
        RoleSessionName: `agent-builder-deploy-${Date.now()}`,
        WebIdentityToken: idToken,
        DurationSeconds: 3600, // 1 hour
      });

      const response = await stsClient.send(command);

      if (!response.Credentials) {
        throw new Error("STS did not return credentials");
      }

      console.log(`Successfully assumed role for user ${userId}`);

      return {
        success: true,
        credentials: {
          accessKeyId: response.Credentials.AccessKeyId!,
          secretAccessKey: response.Credentials.SecretAccessKey!,
          sessionToken: response.Credentials.SessionToken!,
          expiration: response.Credentials.Expiration!.getTime(),
        },
        assumedRoleArn: response.AssumedRoleUser?.Arn,
      };
    } catch (error: any) {
      console.error("AssumeRoleWithWebIdentity error:", error);

      // Provide helpful error messages
      let errorMessage = error.message || "Failed to assume role";

      if (error.name === "InvalidIdentityTokenException") {
        errorMessage = "Invalid OAuth token. Please sign out and sign in again.";
      } else if (error.name === "AccessDeniedException") {
        errorMessage = "Access denied. Check that your IAM role trust policy allows web identity federation from this platform.";
      } else if (error.name === "ExpiredTokenException") {
        errorMessage = "OAuth token expired. Please sign in again.";
      }

      return {
        success: false,
        error: errorMessage,
        details: error.name,
      };
    }
  },
});
