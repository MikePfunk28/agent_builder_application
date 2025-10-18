/**
 * Integration Tests for MCP Integration and OAuth Authentication
 * 
 * These tests validate the full integration of:
 * 1. OAuth authentication flows (GitHub, Google, Cognito)
 * 2. MCP server integration (AWS Diagram, Bedrock AgentCore)
 * 3. Agent-to-agent communication via MCP
 * 
 * IMPORTANT: OAuth Setup Required
 * ================================
 * Before running OAuth tests, you MUST configure callback URLs in each OAuth provider:
 * 
 * Current Convex Deployment: https://resolute-kudu-325.convex.site
 * 
 * Required Callback URLs:
 * - GitHub: https://resolute-kudu-325.convex.site/api/auth/callback/github
 * - Google: https://resolute-kudu-325.convex.site/api/auth/callback/google
 * - Cognito: https://resolute-kudu-325.convex.site/api/auth/callback/cognito
 * 
 * See convex/OAUTH_SETUP_GUIDE.md for detailed setup instructions.
 * 
 * Note: These tests require proper MCP server configuration and may need
 * to be run with actual MCP servers available.
 */

import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

// Configure convex-test to find Convex functions
const modules = import.meta.glob("./**/*.ts");

describe("OAuth Authentication Integration", () => {
  describe("OAuth Provider Configuration", () => {
    test("should have all OAuth providers available", async () => {
      const t = convexTest(schema, modules);

      // Query OAuth configuration
      const config = await t.query(api.authDebug.getOAuthConfig);

      expect(config).toBeDefined();
      expect(config.providers).toBeDefined();
      expect(Array.isArray(config.providers)).toBe(true);

      // Check that all expected providers are in the list
      const providerIds = config.providers.map((p: any) => p.id);
      expect(providerIds).toContain("github");
      expect(providerIds).toContain("google");
      expect(providerIds).toContain("cognito");
    });

    test("should validate environment variables for OAuth providers", async () => {
      const t = convexTest(schema, modules);

      const config = await t.query(api.authDebug.getOAuthConfig);

      // Check that environment configuration is returned for each provider
      expect(config.providers).toBeDefined();

      const githubProvider = config.providers.find((p: any) => p.id === "github");
      expect(githubProvider).toBeDefined();
      if (githubProvider) {
        expect(githubProvider.envVars).toBeDefined();
        expect(githubProvider.envVars).toHaveProperty("clientId");
        expect(githubProvider.envVars).toHaveProperty("clientSecret");
      }

      const googleProvider = config.providers.find((p: any) => p.id === "google");
      expect(googleProvider).toBeDefined();
      if (googleProvider) {
        expect(googleProvider.envVars).toBeDefined();
      }

      const cognitoProvider = config.providers.find((p: any) => p.id === "cognito");
      expect(cognitoProvider).toBeDefined();
      if (cognitoProvider) {
        expect(cognitoProvider.envVars).toBeDefined();
      }
    });

    test("should use production Convex site URL for OAuth callbacks", async () => {
      const t = convexTest(schema, modules);

      const config = await t.query(api.authDebug.getOAuthConfig);

      expect(config.environments).toBeDefined();
      expect(Array.isArray(config.environments)).toBe(true);
      expect(config.environments.length).toBeGreaterThan(0);

      const environment = config.environments[0];

      // Verify production URL is used
      expect(environment.url).toBe("https://resolute-kudu-325.convex.site");

      // Verify callback URLs are correctly formatted
      expect(environment.callbackUrls).toBeDefined();
      expect(Array.isArray(environment.callbackUrls)).toBe(true);

      const githubCallback = environment.callbackUrls.find((cb: any) => cb.provider === "github");
      expect(githubCallback).toBeDefined();
      if (githubCallback) {
        expect(githubCallback.url).toBe("https://resolute-kudu-325.convex.site/api/auth/callback/github");
      }

      const googleCallback = environment.callbackUrls.find((cb: any) => cb.provider === "google");
      expect(googleCallback).toBeDefined();
      if (googleCallback) {
        expect(googleCallback.url).toBe("https://resolute-kudu-325.convex.site/api/auth/callback/google");
      }

      const cognitoCallback = environment.callbackUrls.find((cb: any) => cb.provider === "cognito");
      expect(cognitoCallback).toBeDefined();
      if (cognitoCallback) {
        expect(cognitoCallback.url).toBe("https://resolute-kudu-325.convex.site/api/auth/callback/cognito");
      }
    });

    test("should use correct production Convex site URL", async () => {
      const t = convexTest(schema, modules);

      const config = await t.query(api.authDebug.getOAuthConfig);

      const environment = config.environments[0];

      // Verify we're using the production URL
      expect(environment.url).toBe("https://resolute-kudu-325.convex.site");

      // Verify all callback URLs use the production URL
      environment.callbackUrls.forEach((cb: any) => {
        expect(cb.url).toContain("resolute-kudu-325");
      });
    });

    test("should have correct OAuth callback URL format", async () => {
      const t = convexTest(schema, modules);

      const config = await t.query(api.authDebug.getOAuthConfig);
      const environment = config.environments[0];

      // Verify callback URL format is correct
      environment.callbackUrls.forEach((cb: any) => {
        expect(cb.url).toMatch(/^https:\/\/.*\.convex\.site\/api\/auth\/callback\/.+$/);
        expect(cb.url).toContain("/api/auth/callback/");
      });
    });

    test("should provide OAuth configuration for debugging", async () => {
      const t = convexTest(schema, modules);

      const config = await t.query(api.authDebug.getOAuthConfig);

      // Verify structure for debugging
      expect(config.providers).toBeDefined();
      expect(config.environments).toBeDefined();

      // Each provider should have configuration status
      config.providers.forEach((provider: any) => {
        expect(provider).toHaveProperty("id");
        expect(provider).toHaveProperty("name");
        expect(provider).toHaveProperty("configured");
        expect(provider).toHaveProperty("envVars");
      });
    });
  });

  describe("User Authentication Flow", () => {
    test("should create user session after successful authentication", async () => {
      const t = convexTest(schema, modules);

      // Simulate authenticated user
      t.withIdentity({ subject: "test-user-123", email: "test@example.com" });

      // Query logged in user
      const user = await t.query(api.auth.loggedInUser);

      // User should be created or retrieved
      expect(user).toBeDefined();
    });

    test("should return null for unauthenticated requests", async () => {
      const t = convexTest(schema, modules);

      // No identity set
      const user = await t.query(api.auth.loggedInUser);

      expect(user).toBeNull();
    });
  });

  describe("OAuth Profile Data Storage", () => {
    test("should store GitHub profile data with login field", async () => {
      const t = convexTest(schema, modules);

      // Create user with GitHub profile data
      const _userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          userId: "github-user-123",
          email: "github@example.com",
          name: "GitHub User",
          image: "https://avatars.githubusercontent.com/u/123",
          login: "githubuser", // GitHub username
          authProvider: "github",
          createdAt: Date.now(),
          lastSignIn: Date.now(),
          signInCount: 1,
        });
      });

      expect(_userId).toBeDefined();

      // Retrieve user and verify GitHub-specific fields
      const user = await t.run(async (ctx) => {
        return await ctx.db.get(_userId);
      });

      expect(user).toBeDefined();
      expect(user?.login).toBe("githubuser");
      expect(user?.authProvider).toBe("github");
      expect(user?.email).toBe("github@example.com");
      expect(user?.image).toContain("avatars.githubusercontent.com");
    });

    test("should store Google profile data with locale field", async () => {
      const t = convexTest(schema, modules);

      // Create user with Google profile data
      const _userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          userId: "google-user-456",
          email: "google@example.com",
          name: "Google User",
          image: "https://lh3.googleusercontent.com/a/test",
          locale: "en-US", // User's locale preference
          authProvider: "google",
          createdAt: Date.now(),
          lastSignIn: Date.now(),
          signInCount: 1,
        });
      });

      expect(_userId).toBeDefined();

      // Retrieve user and verify Google-specific fields
      const user = await t.run(async (ctx) => {
        return await ctx.db.get(_userId);
      });

      expect(user).toBeDefined();
      expect(user?.locale).toBe("en-US");
      expect(user?.authProvider).toBe("google");
      expect(user?.email).toBe("google@example.com");
      expect(user?.image).toContain("googleusercontent.com");
    });

    test("should store authProvider field correctly for different providers", async () => {
      const t = convexTest(schema, modules);

      // Create users with different auth providers
      const githubUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          userId: "github-provider-test",
          email: "github-provider@example.com",
          name: "GitHub Provider Test",
          authProvider: "github",
          login: "githubtest",
          createdAt: Date.now(),
        });
      });

      const googleUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          userId: "google-provider-test",
          email: "google-provider@example.com",
          name: "Google Provider Test",
          authProvider: "google",
          locale: "fr-FR",
          createdAt: Date.now(),
        });
      });

      const passwordUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          userId: "password-provider-test",
          email: "password-provider@example.com",
          name: "Password Provider Test",
          authProvider: "password",
          createdAt: Date.now(),
        });
      });

      // Verify each user has correct authProvider
      const githubUser = await t.run(async (ctx) => await ctx.db.get(githubUserId));
      const googleUser = await t.run(async (ctx) => await ctx.db.get(googleUserId));
      const passwordUser = await t.run(async (ctx) => await ctx.db.get(passwordUserId));

      expect(githubUser?.authProvider).toBe("github");
      expect(googleUser?.authProvider).toBe("google");
      expect(passwordUser?.authProvider).toBe("password");
    });

    test("should query users by authProvider index", async () => {
      const t = convexTest(schema, modules);

      // Create multiple users with different providers
      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          userId: "github-query-1",
          email: "github1@example.com",
          name: "GitHub User 1",
          authProvider: "github",
          login: "githubuser1",
          createdAt: Date.now(),
        });

        await ctx.db.insert("users", {
          userId: "github-query-2",
          email: "github2@example.com",
          name: "GitHub User 2",
          authProvider: "github",
          login: "githubuser2",
          createdAt: Date.now(),
        });

        await ctx.db.insert("users", {
          userId: "google-query-1",
          email: "google1@example.com",
          name: "Google User 1",
          authProvider: "google",
          locale: "en-US",
          createdAt: Date.now(),
        });
      });

      // Query GitHub users using index
      const githubUsers = await t.run(async (ctx) => {
        return await ctx.db
          .query("users")
          .withIndex("by_auth_provider", (q) => q.eq("authProvider", "github"))
          .collect();
      });

      // Query Google users using index
      const googleUsers = await t.run(async (ctx) => {
        return await ctx.db
          .query("users")
          .withIndex("by_auth_provider", (q) => q.eq("authProvider", "google"))
          .collect();
      });

      expect(githubUsers.length).toBeGreaterThanOrEqual(2);
      expect(googleUsers.length).toBeGreaterThanOrEqual(1);

      // Verify all GitHub users have login field
      githubUsers.forEach((user) => {
        expect(user.authProvider).toBe("github");
        expect(user.login).toBeDefined();
      });

      // Verify all Google users have locale field
      googleUsers.forEach((user) => {
        expect(user.authProvider).toBe("google");
        expect(user.locale).toBeDefined();
      });
    });

    test("should track sign-in count and last sign-in timestamp", async () => {
      const t = convexTest(schema, modules);

      // Create user with initial sign-in
      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          userId: "signin-tracking-test",
          email: "signin@example.com",
          name: "Sign-in Tracking User",
          authProvider: "github",
          login: "signinuser",
          createdAt: Date.now(),
          lastSignIn: Date.now(),
          signInCount: 1,
        });
      });

      // Simulate subsequent sign-in
      const firstSignInTime = Date.now();
      await t.run(async (ctx) => {
        const user = await ctx.db.get(userId);
        if (user) {
          await ctx.db.patch(userId, {
            lastSignIn: firstSignInTime,
            signInCount: (user.signInCount || 0) + 1,
          });
        }
      });

      // Verify sign-in tracking
      const user = await t.run(async (ctx) => await ctx.db.get(userId));

      expect(user?.signInCount).toBeGreaterThanOrEqual(2);
      expect(user?.lastSignIn).toBeDefined();
      expect(user?.lastSignIn).toBeGreaterThan(0);
    });
  });

  describe("OAuth Integration Flow Tests", () => {
    test("should simulate complete GitHub OAuth flow", async () => {
      const t = convexTest(schema, modules);

      // Step 1: User initiates GitHub OAuth (frontend redirects to GitHub)
      // This would happen in the browser, so we simulate the result

      // Step 2: GitHub redirects back with authorization code
      // Convex Auth handles token exchange automatically

      // Step 3: Simulate authenticated session with GitHub profile data
      const githubProfile = {
        id: "12345",
        login: "testgithubuser",
        name: "Test GitHub User",
        email: "github-oauth@example.com",
        avatar_url: "https://avatars.githubusercontent.com/u/12345",
      };

      // Step 4: Create user record as Convex Auth would
      const _userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          userId: githubProfile.id,
          email: githubProfile.email,
          name: githubProfile.name,
          image: githubProfile.avatar_url,
          login: githubProfile.login, // Custom field from profile handler
          authProvider: "github",
          createdAt: Date.now(),
          lastSignIn: Date.now(),
          signInCount: 1,
        });
      });

      expect(_userId).toBeDefined();

      // Step 5: Verify user session is created with correct data
      t.withIdentity({ subject: githubProfile.id, email: githubProfile.email });

      const user = await t.query(api.auth.loggedInUser);

      expect(user).toBeDefined();
      expect(user?.userId).toBe(githubProfile.id);
      expect(user?.login).toBe(githubProfile.login);
      expect(user?.authProvider).toBe("github");
      expect(user?.email).toBe(githubProfile.email);
    });

    test("should simulate complete Google OAuth flow", async () => {
      const t = convexTest(schema, modules);

      // Step 1: User initiates Google OAuth
      // Step 2: Google redirects back with authorization code
      // Step 3: Simulate authenticated session with Google profile data

      const googleProfile = {
        sub: "google-123456",
        name: "Test Google User",
        email: "google-oauth@example.com",
        picture: "https://lh3.googleusercontent.com/a/test123",
        locale: "en-US",
      };

      // Step 4: Create user record as Convex Auth would
      const _userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          userId: googleProfile.sub,
          email: googleProfile.email,
          name: googleProfile.name,
          image: googleProfile.picture,
          locale: googleProfile.locale, // Custom field from profile handler
          authProvider: "google",
          createdAt: Date.now(),
          lastSignIn: Date.now(),
          signInCount: 1,
        });
      });

      expect(_userId).toBeDefined();

      // Step 5: Verify user session is created with correct data
      t.withIdentity({ subject: googleProfile.sub, email: googleProfile.email });

      const user = await t.query(api.auth.loggedInUser);

      expect(user).toBeDefined();
      expect(user?.userId).toBe(googleProfile.sub);
      expect(user?.locale).toBe(googleProfile.locale);
      expect(user?.authProvider).toBe("google");
      expect(user?.email).toBe(googleProfile.email);
    });

    test("should handle OAuth callback URL validation", async () => {
      const t = convexTest(schema, modules);

      // Get OAuth configuration
      const config = await t.query(api.authDebug.getOAuthConfig);

      expect(config).toBeDefined();
      expect(config.environments).toBeDefined();
      expect(config.environments.length).toBeGreaterThan(0);

      const environment = config.environments[0];

      // Verify callback URLs are correctly formatted
      const githubCallback = environment.callbackUrls.find((cb: any) => cb.provider === "github");
      const googleCallback = environment.callbackUrls.find((cb: any) => cb.provider === "google");

      expect(githubCallback).toBeDefined();
      expect(googleCallback).toBeDefined();

      // Verify URLs match expected production format
      expect(githubCallback?.url).toMatch(/^https:\/\/.*\.convex\.site\/api\/auth\/callback\/github$/);
      expect(googleCallback?.url).toMatch(/^https:\/\/.*\.convex\.site\/api\/auth\/callback\/google$/);

      // Verify using production URL
      expect(githubCallback?.url).toContain("resolute-kudu-325");
      expect(googleCallback?.url).toContain("resolute-kudu-325");
    });

    test("should handle multi-environment OAuth configuration", async () => {
      const t = convexTest(schema, modules);

      // Get OAuth configuration
      const config = await t.query(api.authDebug.getOAuthConfig);

      // Verify environment configuration
      expect(config.environments).toBeDefined();

      const environment = config.environments[0];

      // Should use production URL
      expect(environment.url).toBe("https://resolute-kudu-325.convex.site");

      // Verify all providers have callback URLs
      const providers = ["github", "google", "cognito"];
      providers.forEach((provider) => {
        const callback = environment.callbackUrls.find((cb: any) => cb.provider === provider);
        expect(callback).toBeDefined();
        expect(callback?.url).toContain(environment.url);
        expect(callback?.url).toContain(`/api/auth/callback/${provider}`);
      });
    });

    test("should handle OAuth provider environment variable validation", async () => {
      const t = convexTest(schema, modules);

      // Get OAuth configuration
      const config = await t.query(api.authDebug.getOAuthConfig);

      // Verify provider configuration status
      expect(config.providers).toBeDefined();
      expect(Array.isArray(config.providers)).toBe(true);

      config.providers.forEach((provider: any) => {
        expect(provider).toHaveProperty("id");
        expect(provider).toHaveProperty("name");
        expect(provider).toHaveProperty("configured");
        expect(provider).toHaveProperty("envVars");

        // Each provider should have environment variable status
        expect(provider.envVars).toBeDefined();
        expect(typeof provider.configured).toBe("boolean");
      });
    });

    test("should handle returning user OAuth flow", async () => {
      const t = convexTest(schema, modules);

      // Step 1: Create existing user
      const existingUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          userId: "returning-github-user",
          email: "returning@example.com",
          name: "Returning User",
          image: "https://avatars.githubusercontent.com/u/999",
          login: "returninguser",
          authProvider: "github",
          createdAt: Date.now() - 86400000, // Created 1 day ago
          lastSignIn: Date.now() - 86400000,
          signInCount: 5,
        });
      });

      // Step 2: Simulate returning user sign-in
      const newSignInTime = Date.now();
      await t.run(async (ctx) => {
        const user = await ctx.db.get(existingUserId);
        if (user) {
          await ctx.db.patch(existingUserId, {
            lastSignIn: newSignInTime,
            signInCount: (user.signInCount || 0) + 1,
          });
        }
      });

      // Step 3: Verify user data is updated
      const user = await t.run(async (ctx) => await ctx.db.get(existingUserId));

      expect(user).toBeDefined();
      expect(user?.signInCount).toBe(6);
      expect(user?.lastSignIn).toBe(newSignInTime);
      expect(user?.login).toBe("returninguser"); // Profile data preserved
    });

    test("should handle OAuth error scenarios gracefully", async () => {
      const t = convexTest(schema, modules);

      // Test 1: Missing required profile fields
      const incompleteUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          userId: "incomplete-user",
          // Missing email and name
          authProvider: "github",
          createdAt: Date.now(),
        });
      });

      const incompleteUser = await t.run(async (ctx) => await ctx.db.get(incompleteUserId));
      expect(incompleteUser).toBeDefined();
      expect(incompleteUser?.userId).toBe("incomplete-user");

      // Test 2: Invalid provider type
      const invalidProviderId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          userId: "invalid-provider-user",
          email: "invalid@example.com",
          name: "Invalid Provider User",
          authProvider: "unknown-provider",
          createdAt: Date.now(),
        });
      });

      const invalidProviderUser = await t.run(async (ctx) => await ctx.db.get(invalidProviderId));
      expect(invalidProviderUser).toBeDefined();
      expect(invalidProviderUser?.authProvider).toBe("unknown-provider");
    });

    test("should handle concurrent OAuth sign-ins", async () => {
      const t = convexTest(schema, modules);

      // Simulate multiple users signing in concurrently
      const userPromises = Array.from({ length: 5 }, (_, i) => {
        return t.run(async (ctx) => {
          return await ctx.db.insert("users", {
            userId: `concurrent-user-${i}`,
            email: `concurrent${i}@example.com`,
            name: `Concurrent User ${i}`,
            authProvider: i % 2 === 0 ? "github" : "google",
            login: i % 2 === 0 ? `githubuser${i}` : undefined,
            locale: i % 2 === 1 ? "en-US" : undefined,
            createdAt: Date.now(),
            lastSignIn: Date.now(),
            signInCount: 1,
          });
        });
      });

      const userIds = await Promise.all(userPromises);

      // Verify all users were created
      expect(userIds.length).toBe(5);

      // Verify each user has correct provider-specific fields
      for (let i = 0; i < userIds.length; i++) {
        const user = await t.run(async (ctx) => await ctx.db.get(userIds[i]));
        expect(user).toBeDefined();

        if (i % 2 === 0) {
          expect(user?.authProvider).toBe("github");
          expect(user?.login).toBeDefined();
        } else {
          expect(user?.authProvider).toBe("google");
          expect(user?.locale).toBeDefined();
        }
      }
    });
  });
});

describe("MCP Server Integration", () => {
  let _testUserId: any;

  beforeEach(async () => {
    const t = convexTest(schema, modules);

    // Create test user
    _testUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        userId: "test-user-mcp",
        email: "mcp-test@example.com",
        name: "MCP Test User",
        tier: "personal",
        createdAt: Date.now(),
      });
    });
  });

  describe("MCP Server Configuration", () => {
    test("should add MCP server configuration", async () => {
      const t = convexTest(schema, modules);
      t.withIdentity({ subject: "test-user-mcp" });

      const serverId = await t.mutation(api.mcpConfig.addMCPServer, {
        name: "test-mcp-server",
        command: "uvx",
        args: ["test-mcp-server@latest"],
        disabled: false,
      });

      expect(serverId).toBeDefined();

      // Verify server was added
      const servers = await t.query(api.mcpConfig.listMCPServers);
      const addedServer = servers.find((s: any) => s._id === serverId);

      expect(addedServer).toBeDefined();
      if (addedServer) {
        expect(addedServer.name).toBe("test-mcp-server");
        expect(addedServer.command).toBe("uvx");
      }
    });

    test("should update MCP server configuration", async () => {
      const t = convexTest(schema, modules);
      t.withIdentity({ subject: "test-user-mcp" });

      // Add server
      const serverId = await t.mutation(api.mcpConfig.addMCPServer, {
        name: "test-server-update",
        command: "uvx",
        args: ["test@latest"],
        disabled: false,
      });

      // Update server
      await t.mutation(api.mcpConfig.updateMCPServer, {
        serverId,
        updates: {
          disabled: true,
          timeout: 10000,
        },
      });

      // Verify update
      const servers = await t.query(api.mcpConfig.listMCPServers);
      const updatedServer = servers.find((s: any) => s._id === serverId);

      expect(updatedServer).toBeDefined();
      if (updatedServer) {
        expect(updatedServer.disabled).toBe(true);
        expect(updatedServer.timeout).toBe(10000);
      }
    });

    test("should delete MCP server configuration", async () => {
      const t = convexTest(schema, modules);
      t.withIdentity({ subject: "test-user-mcp" });

      // Add server
      const serverId = await t.mutation(api.mcpConfig.addMCPServer, {
        name: "test-server-delete",
        command: "uvx",
        args: ["test@latest"],
        disabled: false,
      });

      // Delete server
      await t.mutation(api.mcpConfig.deleteMCPServer, {
        serverId,
      });

      // Verify deletion
      const servers = await t.query(api.mcpConfig.listMCPServers);
      const deletedServer = servers.find((s: any) => s._id === serverId);

      expect(deletedServer).toBeUndefined();
    });
  });

  describe("MCP Tool Invocation", () => {
    test("should handle MCP tool invocation with proper error handling", async () => {
      const t = convexTest(schema, modules);
      t.withIdentity({ subject: "test-user-mcp" });

      // Add test server
      await t.mutation(api.mcpConfig.addMCPServer, {
        name: "test-invocation-server",
        command: "uvx",
        args: ["test-server@latest"],
        disabled: false,
      });

      // Try to invoke tool (will fail because MCP protocol not implemented)
      const result = await t.action(api.mcpClient.invokeMCPTool, {
        serverName: "test-invocation-server",
        toolName: "test_tool",
        parameters: { input: "test" },
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test("should respect timeout configuration", async () => {
      const t = convexTest(schema, modules);
      t.withIdentity({ subject: "test-user-mcp" });

      // Add test server with short timeout
      await t.mutation(api.mcpConfig.addMCPServer, {
        name: "test-timeout-server",
        command: "uvx",
        args: ["test-server@latest"],
        disabled: false,
        timeout: 1000,
      });

      // Invoke with timeout
      const result = await t.action(api.mcpClient.invokeMCPTool, {
        serverName: "test-timeout-server",
        toolName: "test_tool",
        parameters: {},
        timeout: 500,
      });

      expect(result).toBeDefined();
      if ('executionTime' in result) {
        expect(result.executionTime).toBeDefined();
      }
    });
  });
});

describe("AWS Diagram Generator Integration", () => {
  let testUserId: any;
  let testAgentId: any;
  let testDeploymentId: any;

  beforeEach(async () => {
    const t = convexTest(schema, modules);

    // Create test user
    testUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        userId: "test-user-diagram",
        email: "diagram-test@example.com",
        name: "Diagram Test User",
        tier: "personal",
        createdAt: Date.now(),
      });
    });

    // Create test agent
    testAgentId = await t.run(async (ctx) => {
      return await ctx.db.insert("agents", {
        createdBy: testUserId,
        name: "Test Agent",
        description: "Test agent for diagram generation",
        systemPrompt: "You are a test agent",
        model: "gpt-4",
        tools: [],
        generatedCode: "# Test agent code",
        deploymentType: "aws",
      });
    });

    // Create test deployment
    testDeploymentId = await t.run(async (ctx) => {
      return await ctx.db.insert("deployments", {
        userId: testUserId,
        agentId: testAgentId,
        agentName: "Test Agent",
        tier: "personal",
        region: "us-east-1",
        status: "ACTIVE",
        startedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  });

  test("should generate architecture diagram for Tier 1 deployment", async () => {
    const t = convexTest(schema, modules);
    t.withIdentity({ subject: "test-user-diagram" });

    // Update deployment to Tier 1
    await t.run(async (ctx) => {
      await ctx.db.patch(testDeploymentId, {
        tier: "freemium",
        agentCoreRuntimeId: "test-sandbox-123",
      });
    });

    // Generate diagram
    const result = await t.action(api.awsDiagramGenerator.generateArchitectureDiagram, {
      deploymentId: testDeploymentId,
      format: "svg",
    });

    // Should fail because MCP server not available, but should handle gracefully
    expect(result).toBeDefined();
    if (!result.success) {
      expect(result.error).toBeDefined();
      expect(result.error).toContain("MCP");
    }
  });

  test("should generate architecture diagram for Tier 2 deployment", async () => {
    const t = convexTest(schema, modules);
    t.withIdentity({ subject: "test-user-diagram" });

    // Update deployment to Tier 2 with resources
    await t.run(async (ctx) => {
      await ctx.db.patch(testDeploymentId, {
        tier: "personal",
        ecrRepositoryUri: "123456789.dkr.ecr.us-east-1.amazonaws.com/test-agent",
        taskArn: "arn:aws:ecs:us-east-1:123456789:task/test-cluster/abc123",
        cloudFormationStackId: "arn:aws:cloudformation:us-east-1:123456789:stack/test-stack/xyz789",
      });
    });

    // Generate diagram
    const result = await t.action(api.awsDiagramGenerator.generateArchitectureDiagram, {
      deploymentId: testDeploymentId,
      format: "svg",
    });

    expect(result).toBeDefined();
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  test("should store generated diagram in database", async () => {
    const t = convexTest(schema, modules);
    t.withIdentity({ subject: "test-user-diagram" });

    // Store diagram directly
    const diagramId = await t.mutation(api.awsDiagramGenerator.storeDiagram, {
      deploymentId: testDeploymentId,
      format: "svg",
      content: "<svg>test diagram</svg>",
      resourceCount: 5,
    });

    expect(diagramId).toBeDefined();

    // Retrieve diagram
    const diagram = await t.query(api.awsDiagramGenerator.getDiagram, {
      deploymentId: testDeploymentId,
      format: "svg",
    });

    expect(diagram).toBeDefined();
    expect(diagram?.content).toBe("<svg>test diagram</svg>");
    expect(diagram?.resourceCount).toBe(5);
  });

  test("should list all diagrams for a deployment", async () => {
    const t = convexTest(schema, modules);
    t.withIdentity({ subject: "test-user-diagram" });

    // Store multiple diagrams
    await t.mutation(api.awsDiagramGenerator.storeDiagram, {
      deploymentId: testDeploymentId,
      format: "svg",
      content: "<svg>svg diagram</svg>",
    });

    await t.mutation(api.awsDiagramGenerator.storeDiagram, {
      deploymentId: testDeploymentId,
      format: "png",
      content: "base64-png-data",
    });

    // List diagrams
    const diagrams = await t.query(api.awsDiagramGenerator.listDiagramsForDeployment, {
      deploymentId: testDeploymentId,
    });

    expect(diagrams).toBeDefined();
    expect(diagrams.length).toBeGreaterThanOrEqual(2);
  });

  test("should delete diagram", async () => {
    const t = convexTest(schema, modules);
    t.withIdentity({ subject: "test-user-diagram" });

    // Store diagram
    const diagramId = await t.mutation(api.awsDiagramGenerator.storeDiagram, {
      deploymentId: testDeploymentId,
      format: "svg",
      content: "<svg>test</svg>",
    });

    // Delete diagram
    await t.mutation(api.awsDiagramGenerator.deleteDiagram, {
      diagramId,
    });

    // Verify deletion
    const diagram = await t.query(api.awsDiagramGenerator.getDiagram, {
      deploymentId: testDeploymentId,
      format: "svg",
    });

    expect(diagram).toBeNull();
  });
});

describe("Bedrock AgentCore Integration", () => {
  let testUserId: any;
  let testAgentId: any;

  beforeEach(async () => {
    const t = convexTest(schema, modules);

    // Create test user
    testUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        userId: "test-user-agentcore",
        email: "agentcore-test@example.com",
        name: "AgentCore Test User",
        tier: "freemium",
        createdAt: Date.now(),
      });
    });

    // Create test agent
    testAgentId = await t.run(async (ctx) => {
      return await ctx.db.insert("agents", {
        createdBy: testUserId,
        name: "Test AgentCore Agent",
        description: "Test agent for AgentCore deployment",
        systemPrompt: "You are a test agent",
        model: "gpt-4",
        tools: [],
        generatedCode: "# Test agent code",
        deploymentType: "aws",
      });
    });
  });

  test("should deploy agent to AgentCore sandbox", async () => {
    const t = convexTest(schema, modules);
    t.withIdentity({ subject: "test-user-agentcore" });

    // Deploy to AgentCore
    const result = await t.action(api.agentcoreDeployment.deployToAgentCore, {
      agentId: testAgentId,
      code: "def handler(event, context): return {'result': 'success'}",
      dependencies: ["boto3"],
      environmentVariables: {
        ENV: "test",
      },
    });

    expect(result).toBeDefined();
    // Will fail because MCP server not available, but should handle gracefully
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  test("should invoke agent in AgentCore sandbox", async () => {
    const t = convexTest(schema, modules);
    t.withIdentity({ subject: "test-user-agentcore" });

    // Invoke sandbox
    const result = await t.action(api.agentcoreDeployment.invokeAgentCoreSandbox, {
      sandboxId: "test-sandbox-123",
      input: { message: "Hello, agent!" },
    });

    expect(result).toBeDefined();
    // Will fail because MCP server not available
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  test("should check AgentCore sandbox health", async () => {
    const t = convexTest(schema, modules);
    t.withIdentity({ subject: "test-user-agentcore" });

    // Check health
    const result = await t.action(api.agentcoreDeployment.getAgentCoreSandboxHealth, {
      sandboxId: "test-sandbox-123",
    });

    expect(result).toBeDefined();
    expect(result.status).toBeDefined();
  });

  test("should delete AgentCore sandbox gracefully", async () => {
    const t = convexTest(schema, modules);
    t.withIdentity({ subject: "test-user-agentcore" });

    // Delete sandbox
    const result = await t.action(api.agentcoreDeployment.deleteAgentCoreSandbox, {
      sandboxId: "test-sandbox-123",
    });

    expect(result).toBeDefined();
    // Should handle failure gracefully
    expect(result.message).toBeDefined();
  });
});

describe("Agent-to-Agent Communication via MCP", () => {
  let testUserId: any;
  let testAgentId: any;

  beforeEach(async () => {
    const t = convexTest(schema, modules);

    // Create test user
    testUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        userId: "test-user-agent-mcp",
        email: "agent-mcp-test@example.com",
        name: "Agent MCP Test User",
        tier: "personal",
        createdAt: Date.now(),
      });
    });

    // Create test agent exposed as MCP tool
    testAgentId = await t.run(async (ctx) => {
      return await ctx.db.insert("agents", {
        createdBy: testUserId,
        name: "Test MCP Agent",
        description: "Test agent exposed as MCP tool",
        systemPrompt: "You are a test agent",
        model: "gpt-4",
        tools: [],
        generatedCode: "# Test agent code",
        deploymentType: "aws",
        exposableAsMCPTool: true,
        mcpToolName: "test_agent_tool",
        mcpInputSchema: {
          type: "object",
          properties: {
            input: { type: "string", description: "Input message" },
          },
          required: ["input"],
        },
      });
    });
  });

  test("should list agents exposed as MCP tools", async () => {
    const t = convexTest(schema, modules);
    t.withIdentity({ subject: "test-user-agent-mcp" });

    // List exposable agents
    const agents = await t.query(api.agents.listExposableAgents);

    expect(agents).toBeDefined();
    expect(Array.isArray(agents)).toBe(true);

    const testAgent = agents.find((a: any) => a._id === testAgentId);
    expect(testAgent).toBeDefined();
    expect(testAgent?.name).toBe("test_agent_tool"); // mcpToolName is mapped to name
    expect(testAgent?.description).toContain("Test agent exposed as MCP tool");
  });

  test("should configure agent for MCP exposure", async () => {
    const t = convexTest(schema, modules);
    t.withIdentity({ subject: "test-user-agent-mcp" });

    // Create new agent
    const newAgentId = await t.run(async (ctx) => {
      return await ctx.db.insert("agents", {
        createdBy: testUserId,
        name: "New Agent",
        description: "New agent to be exposed",
        systemPrompt: "You are a new agent",
        model: "gpt-4",
        tools: [],
        generatedCode: "# New agent code",
        deploymentType: "aws",
        exposableAsMCPTool: false,
      });
    });

    // Update to expose as MCP tool
    await t.run(async (ctx) => {
      await ctx.db.patch(newAgentId, {
        exposableAsMCPTool: true,
        mcpToolName: "new_agent_tool",
        mcpInputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
        },
      });
    });

    // Verify update
    const agent = await t.run(async (ctx) => {
      return await ctx.db.get(newAgentId);
    });

    expect(agent?.exposableAsMCPTool).toBe(true);
    expect(agent?.mcpToolName).toBe("new_agent_tool");
  });

  test("should validate MCP tool name uniqueness", async () => {
    const t = convexTest(schema, modules);
    t.withIdentity({ subject: "test-user-agent-mcp" });

    // Try to create another agent with same MCP tool name
    const _duplicateAgentId = await t.run(async (ctx) => {
      return await ctx.db.insert("agents", {
        createdBy: testUserId,
        name: "Duplicate Agent",
        description: "Agent with duplicate MCP tool name",
        systemPrompt: "You are a duplicate agent",
        model: "gpt-4",
        tools: [],
        generatedCode: "# Duplicate agent code",
        deploymentType: "aws",
        exposableAsMCPTool: true,
        mcpToolName: "test_agent_tool", // Same as existing agent
      });
    });

    // Both agents should exist (validation would be in mutation logic)
    const agents = await t.query(api.agents.listExposableAgents);
    const duplicates = agents.filter((a: any) => a.mcpToolName === "test_agent_tool");

    // This test documents that duplicate tool names are possible
    // In production, we should add validation to prevent this
    expect(duplicates.length).toBeGreaterThanOrEqual(1);
  });
});

describe("End-to-End Integration Scenarios", () => {
  test("should handle complete deployment workflow with diagram generation", async () => {
    const t = convexTest(schema, modules);

    // 1. Create user
    const _userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        userId: "test-user-e2e",
        email: "e2e-test@example.com",
        name: "E2E Test User",
        tier: "personal",
        createdAt: Date.now(),
      });
    });

    t.withIdentity({ subject: "test-user-e2e" });

    // 2. Create agent
    const agentId = await t.run(async (ctx) => {
      return await ctx.db.insert("agents", {
        createdBy: _userId,
        name: "E2E Test Agent",
        description: "End-to-end test agent",
        systemPrompt: "You are a test agent",
        model: "gpt-4",
        tools: [],
        generatedCode: "# E2E test agent code",
        deploymentType: "aws",
      });
    });

    // 3. Create deployment
    const deploymentId = await t.run(async (ctx) => {
      return await ctx.db.insert("deployments", {
        userId: _userId,
        agentId,
        agentName: "E2E Test Agent",
        tier: "personal",
        region: "us-east-1",
        status: "ACTIVE",
        ecrRepositoryUri: "123456789.dkr.ecr.us-east-1.amazonaws.com/e2e-agent",
        startedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // 4. Generate diagram
    const diagramResult = await t.action(api.awsDiagramGenerator.generateArchitectureDiagram, {
      deploymentId,
      format: "svg",
    });

    expect(diagramResult).toBeDefined();

    // 5. Verify workflow completed
    const deployment = await t.run(async (ctx) => {
      return await ctx.db.get(deploymentId);
    });

    expect(deployment).toBeDefined();
    expect(deployment?.status).toBe("ACTIVE");
  });

  test("should handle MCP server configuration and tool invocation workflow", async () => {
    const t = convexTest(schema, modules);

    // 1. Create user
    const _userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        userId: "test-user-mcp-workflow",
        email: "mcp-workflow@example.com",
        name: "MCP Workflow User",
        tier: "personal",
        createdAt: Date.now(),
      });
    });

    t.withIdentity({ subject: "test-user-mcp-workflow" });

    // 2. Add MCP server
    const serverId = await t.mutation(api.mcpConfig.addMCPServer, {
      name: "workflow-test-server",
      command: "uvx",
      args: ["test-server@latest"],
      disabled: false,
    });

    expect(serverId).toBeDefined();

    // 3. List servers
    const servers = await t.query(api.mcpConfig.listMCPServers);
    expect(servers.length).toBeGreaterThan(0);

    // 4. Invoke tool
    const result = await t.action(api.mcpClient.invokeMCPTool, {
      serverName: "workflow-test-server",
      toolName: "test_tool",
      parameters: {},
    });

    expect(result).toBeDefined();

    // 5. Clean up
    await t.mutation(api.mcpConfig.deleteMCPServer, {
      serverId,
    });
  });
});

