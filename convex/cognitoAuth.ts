/**
 * AWS Cognito Authentication for AgentCore MCP Runtime
 * Handles JWT token generation for accessing the MCP server
 */

import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Authenticate with Cognito and get JWT token
 * Used for AgentCore MCP Runtime authentication
 */
export const getCognitoToken = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; token?: string; expiresAt?: number; error?: string }> => {
    try {
      // Import AWS Cognito Identity Provider
      const { CognitoIdentityProviderClient, InitiateAuthCommand } = await import(
        "@aws-sdk/client-cognito-identity-provider" as any
      ) as any;

      // Get Cognito configuration from environment variables
      const userPoolId = process.env.AGENTCORE_COGNITO_USER_POOL_ID;
      const clientId = process.env.AGENTCORE_COGNITO_CLIENT_ID;
      const username = process.env.AGENTCORE_COGNITO_USERNAME || "agentbuilder";
      const password = process.env.AGENTCORE_COGNITO_PASSWORD || "AgentBuilder2025!";
      const region = process.env.AWS_REGION || "us-east-1";

      if (!userPoolId || !clientId) {
        throw new Error("Cognito configuration missing. Set AGENTCORE_COGNITO_USER_POOL_ID and AGENTCORE_COGNITO_CLIENT_ID environment variables.");
      }

      const client = new CognitoIdentityProviderClient({ region });

      const command = new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: clientId,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
        },
      } as any);

      const response = await client.send(command);

      if (!response.AuthenticationResult?.IdToken) {
        throw new Error("No ID token received from Cognito");
      }

      // Calculate expiration time
      const expiresIn = response.AuthenticationResult.ExpiresIn || 3600; // Default 1 hour
      const expiresAt = Date.now() + (expiresIn * 1000);

      return {
        success: true,
        token: response.AuthenticationResult.IdToken,
        expiresAt,
      };
    } catch (error: any) {
      console.error("Cognito authentication failed:", error);
      return {
        success: false,
        error: error.message || "Failed to authenticate with Cognito",
      };
    }
  },
});

/**
 * Authenticate with Cognito using custom credentials
 * Allows users to provide their own Cognito credentials
 */
export const getCognitoTokenWithCredentials = action({
  args: {
    userPoolId: v.string(),
    clientId: v.string(),
    username: v.string(),
    password: v.string(),
    region: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; token?: string; expiresAt?: number; error?: string }> => {
    try {
      const { CognitoIdentityProviderClient, InitiateAuthCommand } = await import(
        "@aws-sdk/client-cognito-identity-provider" as any
      ) as any;

      const client = new CognitoIdentityProviderClient({
        region: args.region || process.env.AWS_REGION || "us-east-1"
      });

      const command = new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: args.clientId,
        AuthParameters: {
          USERNAME: args.username,
          PASSWORD: args.password,
        },
      } as any);

      const response = await client.send(command);

      if (!response.AuthenticationResult?.IdToken) {
        throw new Error("No ID token received from Cognito");
      }

      const expiresIn = response.AuthenticationResult.ExpiresIn || 3600;
      const expiresAt = Date.now() + (expiresIn * 1000);

      return {
        success: true,
        token: response.AuthenticationResult.IdToken,
        expiresAt,
      };
    } catch (error: any) {
      console.error("Cognito authentication with credentials failed:", error);

      // Provide helpful error messages
      let errorMessage = error.message || "Authentication failed";

      if (error.name === "NotAuthorizedException") {
        errorMessage = "Invalid username or password";
      } else if (error.name === "UserNotFoundException") {
        errorMessage = "User not found";
      } else if (error.name === "InvalidParameterException") {
        errorMessage = "Invalid parameters. Check your User Pool ID and Client ID.";
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});

/**
 * Token cache to avoid unnecessary Cognito calls
 * In production, use a proper cache (Redis, etc.)
 */
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get cached token or fetch new one
 * Internal helper used by MCP client
 */
export const getCachedCognitoToken = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; token?: string; error?: string }> => {
    // Check if cached token is still valid (with 5 minute buffer)
    if (cachedToken && cachedToken.expiresAt > Date.now() + (5 * 60 * 1000)) {
      return {
        success: true,
        token: cachedToken.token,
      };
    }

    // Fetch new token
    const result = await ctx.runAction(getCognitoToken as any, {});

    if (result.success && result.token && result.expiresAt) {
      cachedToken = {
        token: result.token,
        expiresAt: result.expiresAt,
      };
    }

    return result;
  },
});
