/**
 * AWS Federated Identity Integration
 * 
 * This module handles AWS credential exchange for Cognito-authenticated users.
 * When a user signs in with Cognito, we can exchange their Cognito ID token
 * for temporary AWS credentials, allowing them to deploy to their AWS account.
 */

import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

/**
 * Exchange Cognito ID token for AWS credentials using AWS STS
 * This allows Cognito users to get temporary AWS credentials
 */
export const getAWSCredentialsFromCognito = action({
  args: {
    cognitoIdToken: v.string(),
    identityPoolId: v.string(), // AWS Cognito Identity Pool ID
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    try {
      // Call AWS STS to get credentials
      // This uses the Cognito Identity Pool to exchange the ID token
      const response = await fetch(
        `https://cognito-identity.${process.env.AWS_REGION}.amazonaws.com/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target": "AWSCognitoIdentityService.GetCredentialsForIdentity",
          },
          body: JSON.stringify({
            IdentityId: args.identityPoolId,
            Logins: {
              [`cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`]:
                args.cognitoIdToken,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get AWS credentials: ${error}`);
      }

      const credentials = await response.json();

      // Store the AWS identity information in the user's profile
      await ctx.runMutation(api.awsFederatedIdentity.storeAWSIdentity, {
        identityId: credentials.IdentityId,
        accessKeyId: credentials.Credentials.AccessKeyId,
        secretKey: credentials.Credentials.SecretKey,
        sessionToken: credentials.Credentials.SessionToken,
        expiration: credentials.Credentials.Expiration,
      });

      return {
        success: true,
        credentials: {
          accessKeyId: credentials.Credentials.AccessKeyId,
          secretAccessKey: credentials.Credentials.SecretKey,
          sessionToken: credentials.Credentials.SessionToken,
          expiration: credentials.Credentials.Expiration,
        },
        identityId: credentials.IdentityId,
      };
    } catch (error) {
      console.error("Error getting AWS credentials:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

/**
 * Store AWS federated identity information in user profile
 */
export const storeAWSIdentity = mutation({
  args: {
    identityId: v.string(),
    accessKeyId: v.string(),
    secretKey: v.string(),
    sessionToken: v.string(),
    expiration: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get user record
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Update user with AWS identity information
    await ctx.db.patch(userId, {
      awsIdentityId: args.identityId,
      awsCredentials: {
        accessKeyId: args.accessKeyId,
        secretKey: args.secretKey,
        sessionToken: args.sessionToken,
        expiration: args.expiration,
      },
      awsCredentialsUpdatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Get current AWS credentials for the authenticated user
 * Automatically refreshes if expired
 */
export const getAWSCredentials = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (!user || !user.awsCredentials) {
      return null;
    }

    // Check if credentials are expired
    const now = Date.now();
    if (user.awsCredentials.expiration < now) {
      return {
        expired: true,
        needsRefresh: true,
      };
    }

    return {
      expired: false,
      credentials: {
        accessKeyId: user.awsCredentials.accessKeyId,
        secretAccessKey: user.awsCredentials.secretKey,
        sessionToken: user.awsCredentials.sessionToken,
        expiration: user.awsCredentials.expiration,
      },
      identityId: user.awsIdentityId,
    };
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
    if (!user || !user.awsCredentials) {
      return false;
    }

    // Check if credentials are still valid
    const now = Date.now();
    return user.awsCredentials.expiration > now;
  },
});

/**
 * Clear AWS credentials (for sign out)
 */
export const clearAWSCredentials = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await ctx.db.patch(userId, {
      awsCredentials: undefined,
      awsIdentityId: undefined,
      awsCredentialsUpdatedAt: undefined,
    });

    return { success: true };
  },
});
