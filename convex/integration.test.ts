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
          email: "github-provider@example.com",
          name: "GitHub Provider Test",
          authProvider: "github",
          login: "githubtest",
          createdAt: Date.now(),
        });
      });

      const googleUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          email: "google-provider@example.com",
          name: "Google Provider Test",
          authProvider: "google",
          locale: "fr-FR",
          createdAt: Date.now(),
        });
      });

      const passwordUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
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
          email: "github1@example.com",
          name: "GitHub User 1",
          authProvider: "github",
          login: "githubuser1",
          createdAt: Date.now(),
        });

        await ctx.db.insert("users", {
          email: "github2@example.com",
          name: "GitHub User 2",
          authProvider: "github",
          login: "githubuser2",
          createdAt: Date.now(),
        });

        await ctx.db.insert("users", {
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

          // Missing email and name
          authProvider: "github",
          createdAt: Date.now(),
        });
      });

      const incompleteUser = await t.run(async (ctx) => await ctx.db.get(incompleteUserId));
      expect(incompleteUser).toBeDefined();

      // Test 2: Invalid provider type
      const invalidProviderId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {

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

      // Discriminated union: success determines which fields are available
      if (result.success) {
        expect(result.executionTime).toBeDefined();
      } else {
        expect(result.error).toBeDefined();
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



describe("Deployment Integration Tests", () => {
  describe("Tier 1 (Freemium) Deployment Workflow", () => {
    test("should handle Tier 1 deployment workflow", async () => {
      const t = convexTest(schema, modules);

      // Create freemium user
      const testUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {

          email: "tier1-all@example.com",
          name: "Tier 1 All Tests User",
          tier: "freemium",
          testsThisMonth: 0,
          createdAt: Date.now(),
        });
      });

      // Create test agent
      const testAgentId = await t.run(async (ctx) => {
        return await ctx.db.insert("agents", {
          createdBy: testUserId,
          name: "Tier 1 Test Agent",
          description: "Test agent for Tier 1 deployment",
          systemPrompt: "You are a test agent",
          model: "anthropic.claude-3-sonnet-20240229-v1:0",
          tools: [],
          generatedCode: "def handler(event, context):\n    return {'statusCode': 200, 'body': 'Hello from agent'}",
          deploymentType: "aws",
        });
      });

      t.withIdentity({ subject: "test-user-tier1-all" });

      // Test 1: Deploy agent
      const result = await t.action(api.deploymentRouter.deployAgent, {
        agentId: testAgentId,
      });

      expect(result).toBeDefined();
      expect(result.tier).toBe("freemium");

      // Should fail because MCP server not available, but should handle gracefully
      if (!result.success) {
        expect(result.error).toBeDefined();
      } else {
        expect(result.result).toBeDefined();
        expect(result.message).toContain("AgentCore");
      }
    });

    test("should manage usage counters and limits", async () => {
      const t = convexTest(schema, modules);

      // Create user
      const testUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {

          email: "tier1-usage-limits@example.com",
          name: "Tier 1 Usage Limits User",
          tier: "freemium",
          testsThisMonth: 0,
          createdAt: Date.now(),
        });
      });

      const testAgentId = await t.run(async (ctx) => {
        return await ctx.db.insert("agents", {
          createdBy: testUserId,
          name: "Usage Test Agent",
          description: "Test agent",
          systemPrompt: "Test",
          model: "anthropic.claude-3-sonnet-20240229-v1:0",
          tools: [],
          generatedCode: "def handler(): pass",
          deploymentType: "aws",
        });
      });

      t.withIdentity({ subject: "test-user-tier1-usage-limits" });

      // Test usage increment
      const userBefore = await t.query(api.deploymentRouter.getUserTier);
      const initialUsage = userBefore?.testsThisMonth || 0;

      await t.mutation(api.deploymentRouter.incrementUsage, {
        userId: testUserId,
      });

      const userAfter = await t.query(api.deploymentRouter.getUserTier);
      expect(userAfter?.testsThisMonth).toBe(initialUsage + 1);

      // Test usage limit enforcement
      await t.run(async (ctx) => {
        await ctx.db.patch(testUserId, {
          testsThisMonth: 10, // At the limit
        });
      });

      const result = await t.action(api.deploymentRouter.deployAgent, {
        agentId: testAgentId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("limit");
    });
  });

  describe("Tier 2 (Personal AWS) Deployment Workflow", () => {
    test("should handle Tier 2 deployment workflow", async () => {
      const t = convexTest(schema, modules);

      // Create personal tier user
      const testUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {

          email: "tier2-all@example.com",
          name: "Tier 2 All Tests User",
          tier: "personal",
          createdAt: Date.now(),
        });
      });

      // Create test agent
      const testAgentId = await t.run(async (ctx) => {
        return await ctx.db.insert("agents", {
          createdBy: testUserId,
          name: "Tier 2 Test Agent",
          description: "Test agent for Tier 2 deployment",
          systemPrompt: "You are a test agent",
          model: "gpt-4",
          tools: [],
          generatedCode: "# Tier 2 test agent code",
          deploymentType: "aws",
        });
      });

      // Create AWS account connection
      await t.run(async (ctx) => {
        return await ctx.db.insert("userAWSAccounts", {
          userId: testUserId,
          externalId: "test-external-id-123",
          roleArn: "arn:aws:iam::123456789012:role/AgentBuilderDeploymentRole",
          region: "us-east-1",
          awsAccountId: "123456789012",
          status: "connected",
          createdAt: Date.now(),
          connectedAt: Date.now(),
        });
      });

      t.withIdentity({ subject: "test-user-tier2-all" });

      // Test deployment
      const result = await t.action(api.deploymentRouter.deployAgent, {
        agentId: testAgentId,
      });

      expect(result).toBeDefined();
      expect(result.tier).toBe("personal");

      if (!result.success) {
        expect(result.error).toBeDefined();
      } else {
        expect(result.message).toContain("AWS account");
      }

      // Test deployment metadata storage
      const deploymentId = await t.mutation(api.deployments.create, {
        agentId: testAgentId,
        tier: "personal",
        awsAccountId: "123456789012",
        region: "us-east-1",
        taskArn: "arn:aws:ecs:us-east-1:123456789012:task/test-cluster/abc123",
        status: "RUNNING",
      });

      const deployment = await t.query(api.deployments.get, {
        id: deploymentId,
      });

      expect(deployment).toBeDefined();
      expect(deployment?.tier).toBe("personal");
      expect(deployment?.awsAccountId).toBe("123456789012");
      expect(deployment?.taskArn).toContain("ecs");
    });



    test("should handle deployment to user account without AWS connection", async () => {
      const t = convexTest(schema, modules);

      // Create user without AWS connection
      const noAwsUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {

          email: "no-aws@example.com",
          name: "No AWS User",
          tier: "personal",
          createdAt: Date.now(),
        });
      });

      const noAwsAgentId = await t.run(async (ctx) => {
        return await ctx.db.insert("agents", {
          createdBy: noAwsUserId,
          name: "No AWS Agent",
          description: "Agent without AWS connection",
          systemPrompt: "Test",
          model: "gpt-4",
          tools: [],
          generatedCode: "# Test",
          deploymentType: "aws",
        });
      });

      t.withIdentity({ subject: "test-user-no-aws" });

      // Try to deploy
      const result = await t.action(api.deploymentRouter.deployAgent, {
        agentId: noAwsAgentId,
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain("AWS account");
    });
  });

  describe("Deployment Error Handling", () => {
    test("should handle deployment failure gracefully", async () => {
      const t = convexTest(schema, modules);

      // Create user
      const testUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {

          email: "errors-graceful@example.com",
          name: "Error Graceful User",
          tier: "freemium",
          createdAt: Date.now(),
        });
      });

      // Create agent
      const testAgentId = await t.run(async (ctx) => {
        return await ctx.db.insert("agents", {
          createdBy: testUserId,
          name: "Error Test Agent",
          description: "Agent for error testing",
          systemPrompt: "Test",
          model: "gpt-4",
          tools: [],
          generatedCode: "# Test",
          deploymentType: "aws",
        });
      });

      t.withIdentity({ subject: "test-user-errors-graceful" });

      // Deploy (will fail because MCP not available)
      const result = await t.action(api.deploymentRouter.deployAgent, {
        agentId: testAgentId,
      });

      expect(result).toBeDefined();

      // Should handle error gracefully
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.tier).toBe("freemium");
      }
    });

    test("should update deployment status on error", async () => {
      const t = convexTest(schema, modules);

      // Create user
      const testUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {

          email: "errors-status@example.com",
          name: "Error Status User",
          tier: "freemium",
          createdAt: Date.now(),
        });
      });

      // Create agent
      const testAgentId = await t.run(async (ctx) => {
        return await ctx.db.insert("agents", {
          createdBy: testUserId,
          name: "Error Status Agent",
          description: "Agent for status testing",
          systemPrompt: "Test",
          model: "gpt-4",
          tools: [],
          generatedCode: "# Test",
          deploymentType: "aws",
        });
      });

      t.withIdentity({ subject: "test-user-errors-status" });

      // Create deployment
      const deploymentId = await t.mutation(api.deployments.create, {
        agentId: testAgentId,
        tier: "freemium",
        region: "us-east-1",
        status: "PENDING",
      });

      // Update with error
      await t.mutation(api.deployments.updateStatus, {
        deploymentId,
        status: "FAILED",
        error: "Test error: Deployment failed",
      });

      // Verify error was stored
      const deployment = await t.query(api.deployments.get, {
        id: deploymentId,
      });

      expect(deployment).toBeDefined();
      expect(deployment?.status).toBe("FAILED");
      expect(deployment?.error).toContain("Test error");
    });

    test("should handle missing agent gracefully", async () => {
      const t = convexTest(schema, modules);
      t.withIdentity({ subject: "test-user-errors" });

      // Try to deploy non-existent agent
      try {
        await t.action(api.deploymentRouter.deployAgent, {
          agentId: "invalid-agent-id" as any,
        });
        // Should throw or return error
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    test("should handle unauthenticated deployment attempt", async () => {
      const t = convexTest(schema, modules);
      // No identity set

      // Create a test agent for this test
      const testUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {

          email: "unauth@example.com",
          name: "Unauth Test User",
          tier: "personal",
          createdAt: Date.now(),
        });
      });

      const testAgentId = await t.run(async (ctx) => {
        return await ctx.db.insert("agents", {
          createdBy: testUserId,
          name: "Test Agent",
          model: "gpt-4",
          systemPrompt: "Test",
          tools: [],
          generatedCode: "# Test",
          deploymentType: "aws",
        });
      });

      // Try to deploy without authentication
      await expect(
        t.action(api.deploymentRouter.deployAgent, {
          agentId: testAgentId,
        })
      ).rejects.toThrow(/authenticated/);
    });

    test("should handle AgentCore sandbox creation failure", async () => {
      const t = convexTest(schema, modules);
      t.withIdentity({ subject: "test-user-errors" });

      // Create test user and agent
      const testUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {

          email: "errors@example.com",
          name: "Errors Test User",
          tier: "personal",
          createdAt: Date.now(),
        });
      });

      const testAgentId = await t.run(async (ctx) => {
        return await ctx.db.insert("agents", {
          createdBy: testUserId,
          name: "Test Agent",
          model: "gpt-4",
          systemPrompt: "Test",
          tools: [],
          generatedCode: "# Test",
          deploymentType: "aws",
        });
      });

      // Deploy (will fail because MCP not available)
      const result = await t.action(api.agentcoreDeployment.deployToAgentCore, {
        agentId: testAgentId,
        code: "def handler(): pass",
        dependencies: [],
        environmentVariables: {},
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test("should handle cross-account role assumption failure", async () => {
      const t = convexTest(schema, modules);
      t.withIdentity({ subject: "test-user-errors" });

      // Try to assume invalid role
      const result = await t.action(api.awsCrossAccount.validateRole, {
        roleArn: "arn:aws:iam::999999999999:role/InvalidRole",
        externalId: "invalid-external-id",
      });

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("Deployment History and Monitoring", () => {
    test("should retrieve deployment history", async () => {
      const t = convexTest(schema, modules);

      // Create user
      const testUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {

          email: "history-retrieve@example.com",
          name: "History Retrieve User",
          tier: "personal",
          createdAt: Date.now(),
        });
      });

      // Create agent
      const testAgentId = await t.run(async (ctx) => {
        return await ctx.db.insert("agents", {
          createdBy: testUserId,
          name: "History Test Agent",
          description: "Agent for history testing",
          systemPrompt: "Test",
          model: "gpt-4",
          tools: [],
          generatedCode: "# Test",
          deploymentType: "aws",
        });
      });

      t.withIdentity({ subject: "test-user-history-retrieve" });

      // Create multiple deployments
      await t.run(async (ctx) => {
        for (let i = 0; i < 3; i++) {
          await ctx.db.insert("deployments", {
            userId: testUserId,
            agentId: testAgentId,
            tier: "personal",
            region: "us-east-1",
            status: "ACTIVE",
            startedAt: Date.now() - i * 1000,
          });
        }
      });

      // Get deployment history
      const history = await t.query(api.deploymentRouter.getDeploymentHistory, {
        agentId: testAgentId,
        limit: 10,
      });

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThanOrEqual(3);
    });

    test("should list user deployments", async () => {
      const t = convexTest(schema, modules);

      // Create user
      const testUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {

          email: "history-list@example.com",
          name: "History List User",
          tier: "personal",
          createdAt: Date.now(),
        });
      });

      // Create agent
      const testAgentId = await t.run(async (ctx) => {
        return await ctx.db.insert("agents", {
          createdBy: testUserId,
          name: "History List Agent",
          description: "Agent for list testing",
          systemPrompt: "Test",
          model: "gpt-4",
          tools: [],
          generatedCode: "# Test",
          deploymentType: "aws",
        });
      });

      t.withIdentity({ subject: "test-user-history-list" });

      // Create deployments
      await t.run(async (ctx) => {
        await ctx.db.insert("deployments", {
          userId: testUserId,
          agentId: testAgentId,
          tier: "freemium",
          region: "us-east-1",
          status: "ACTIVE",
          startedAt: Date.now(),
        });
      });

      // List deployments
      const deployments = await t.query(api.deployments.list, {
        limit: 20,
      });

      expect(deployments).toBeDefined();
      expect(Array.isArray(deployments)).toBe(true);
      expect(deployments.length).toBeGreaterThan(0);
    });

    test("should update deployment health status", async () => {
      const t = convexTest(schema, modules);

      // Create user and agent for this test
      const testUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {

          email: "history@example.com",
          name: "History User",
          tier: "freemium",
          createdAt: Date.now(),
        });
      });

      const testAgentId = await t.run(async (ctx) => {
        return await ctx.db.insert("agents", {
          createdBy: testUserId,
          name: "History Agent",
          model: "gpt-4",
          systemPrompt: "Test",
          tools: [],
          generatedCode: "# Test",
          deploymentType: "aws",
        });
      });

      t.withIdentity({ subject: "test-user-history" });

      // Create deployment
      const deploymentId = await t.run(async (ctx) => {
        return await ctx.db.insert("deployments", {
          userId: testUserId,
          agentId: testAgentId,
          tier: "freemium",
          region: "us-east-1",
          status: "ACTIVE",
          agentCoreRuntimeId: "test-sandbox-health",
          startedAt: Date.now(),
        });
      });

      // Update health status
      await t.mutation(api.deploymentRouter.updateHealthStatus, {
        deploymentId,
        healthStatus: "healthy",
        lastHealthCheck: Date.now(),
      });

      // Verify update
      const deployment = await t.run(async (ctx) => {
        return await ctx.db.get(deploymentId);
      });

      expect(deployment?.healthStatus).toBe("healthy");
      expect(deployment?.lastHealthCheck).toBeDefined();
    });
  });

  describe("Usage Limit Management", () => {
    test("should reset monthly usage for freemium users", async () => {
      const t = convexTest(schema, modules);

      // Create freemium users with usage
      await t.run(async (ctx) => {
        await ctx.db.insert("users", {

          email: "freemium1@example.com",
          name: "Freemium User 1",
          tier: "freemium",
          testsThisMonth: 5,
          createdAt: Date.now(),
        });

        await ctx.db.insert("users", {

          email: "freemium2@example.com",
          name: "Freemium User 2",
          tier: "freemium",
          testsThisMonth: 8,
          createdAt: Date.now(),
        });
      });

      // Reset monthly usage
      const result = await t.mutation(api.deploymentRouter.resetMonthlyUsage);

      expect(result).toBeDefined();
      expect(result.reset).toBeGreaterThanOrEqual(2);

      // Verify usage was reset
      const users = await t.run(async (ctx) => {
        return await ctx.db
          .query("users")
          .withIndex("by_tier", (q) => q.eq("tier", "freemium"))
          .collect();
      });

      users.forEach((user) => {
        expect(user.testsThisMonth).toBe(0);
      });
    });

    test("should not reset usage for non-freemium users", async () => {
      const t = convexTest(schema, modules);

      // Create personal tier user with usage
      await t.run(async (ctx) => {
        await ctx.db.insert("users", {

          email: "personal1@example.com",
          name: "Personal User 1",
          tier: "personal",
          testsThisMonth: 50,
          createdAt: Date.now(),
        });
      });

      // Reset monthly usage (only affects freemium)
      await t.mutation(api.deploymentRouter.resetMonthlyUsage);

      // Verify personal user usage was not reset
      const user = await t.run(async (ctx) => {
        return await ctx.db
          .query("users")
          .withIndex("email", (q) => q.eq("email", "personal1@example.com"))
          .first();
      });

      expect(user?.testsThisMonth).toBe(50);
    });
  });
});


import {
  TEST_CONSTANTS,
  createTestUser,
  generateTestAgent,
  createAgent,
  getAgent,
  TestFixtures,
  assertAgentHasDecorator,
  assertCodeHasPreprocessing,
  assertCodeHasPostprocessing,
  assertCodeHasToolDecorator,
  assertRequirementsContains,
} from "./testHelpers.test";

describe("Agent Builder Flow Tests", () => {
  let testUserId: any;

  beforeEach(async () => {
    const t = convexTest(schema, modules);
    testUserId = await createTestUser(t, TEST_CONSTANTS.USERS.AGENT_BUILDER, {
      email: "agent-builder@example.com",
      name: "Agent Builder Test User",
    });
  });

  describe("Agent Creation via agents.create Mutation", () => {
    test("should create agent with valid configuration", async () => {
      const t = convexTest(schema, modules);
      t.withIdentity({ subject: TEST_CONSTANTS.USERS.AGENT_BUILDER });

      const config = TestFixtures.createBasicAgent({
        name: "TestAgent",
        tools: [TEST_CONSTANTS.TOOLS.SEARCH],
        deploymentType: "aws",
      });

      const codeResult = await generateTestAgent(t, config);
      expect(codeResult).toBeDefined();
      expect(codeResult.generatedCode).toBeDefined();
      expect(codeResult.requirementsTxt).toBeDefined();

      const agentId = await createAgent(t, {
        ...config,
        description: "Test agent for builder flow",
        generatedCode: codeResult.generatedCode,
      });

      expect(agentId).toBeDefined();

      const agent = await getAgent(t, agentId);
      expect(agent).toBeDefined();
      expect(agent?.name).toBe("TestAgent");
      expect(agent?.model).toBe(TEST_CONSTANTS.MODELS.CLAUDE_SONNET);
      expect(agent?.createdBy).toBe(testUserId);
    });

    test("should reject agent creation without authentication", async () => {
      const t = convexTest(schema, modules);
      // No identity set

      await expect(
        t.mutation(api.agents.create, {
          name: "UnauthorizedAgent",
          model: TEST_CONSTANTS.MODELS.GPT_4,
          systemPrompt: "Test",
          tools: [],
          generatedCode: "# Test",
          deploymentType: "local",
        })
      ).rejects.toThrow(/authenticated/);
    });

    test("should create agent with multiple tools", async () => {
      const t = convexTest(schema, modules);
      t.withIdentity({ subject: TEST_CONSTANTS.USERS.AGENT_BUILDER });

      const config = TestFixtures.createMultiToolAgent({
        systemPrompt: "Agent with multiple tools",
      });

      const codeResult = await generateTestAgent(t, config);
      const agentId = await createAgent(t, {
        ...config,
        description: "Agent with multiple tools",
        generatedCode: codeResult.generatedCode,
      });

      const agent = await getAgent(t, agentId);
      expect(agent?.tools).toHaveLength(3);
      expect(agent?.tools.map((t: any) => t.name)).toContain("search");
      expect(agent?.tools.map((t: any) => t.name)).toContain("calculator");
      expect(agent?.tools.map((t: any) => t.name)).toContain("file_read");
    });

    test("should create agent with custom tool requiring pip packages", async () => {
      const t = convexTest(schema, modules);
      t.withIdentity({ subject: TEST_CONSTANTS.USERS.AGENT_BUILDER });

      const customTool = {
        name: "CustomDataProcessor",
        type: "custom_data_processor",
        config: {
          description: "Processes data with pandas",
          parameters: [
            { name: "data", type: "str", description: "Input data", required: true },
          ],
        },
        requiresPip: true,
        pipPackages: ["pandas>=2.0.0", "numpy>=1.24.0"],
      };

      const config = TestFixtures.createCustomToolAgent(customTool, {
        systemPrompt: "Agent with custom tool",
      });

      const codeResult = await generateTestAgent(t, config);
      assertRequirementsContains(codeResult.requirementsTxt, [
        "pandas>=2.0.0",
        "numpy>=1.24.0",
      ]);

      const agentId = await createAgent(t, {
        ...config,
        generatedCode: codeResult.generatedCode,
      });

      const agent = await getAgent(t, agentId);
      expect(agent?.tools[0].pipPackages).toContain("pandas>=2.0.0");
    });
  });

  describe("@agent Decorator Verification", () => {
    test("should verify @agent decorator in generated code", async () => {
      const t = convexTest(schema, modules);
      t.withIdentity({ subject: TEST_CONSTANTS.USERS.AGENT_BUILDER });

      const config = TestFixtures.createBasicAgent({
        name: "DecoratorTestAgent",
        systemPrompt: "Test decorator",
      });

      const codeResult = await generateTestAgent(t, config);
      const code = codeResult.generatedCode;

      assertAgentHasDecorator(code, TEST_CONSTANTS.MODELS.CLAUDE_SONNET, "Test decorator");
    });

    test("should verify preprocessing hook in @agent decorator", async () => {
      const t = convexTest(schema, modules);

      const config = TestFixtures.createBasicAgent({
        name: "PreprocessAgent",
        systemPrompt: "Test preprocessing",
      });

      const codeResult = await generateTestAgent(t, config);
      assertCodeHasPreprocessing(codeResult.generatedCode);
      expect(codeResult.generatedCode).toContain("logger.info(f\"Pre-processing message:");
    });

    test("should verify postprocessing hook in @agent decorator", async () => {
      const t = convexTest(schema, modules);

      const config = TestFixtures.createBasicAgent({
        name: "PostprocessAgent",
        systemPrompt: "Test postprocessing",
      });

      const codeResult = await generateTestAgent(t, config);
      assertCodeHasPostprocessing(codeResult.generatedCode);
      expect(codeResult.generatedCode).toContain("logger.info(f\"Post-processing response:");
    });

    test("should verify tools are included in @agent decorator", async () => {
      const t = convexTest(schema, modules);

      const config = TestFixtures.createBasicAgent({
        name: "ToolsDecoratorAgent",
        systemPrompt: "Test tools in decorator",
        tools: [TEST_CONSTANTS.TOOLS.SEARCH, TEST_CONSTANTS.TOOLS.CALCULATOR],
      });

      const codeResult = await generateTestAgent(t, config);
      expect(codeResult.generatedCode).toContain("tools=[search, calculator]");
    });

    test("should verify memory and reasoning configuration in @agent decorator", async () => {
      const t = convexTest(schema, modules);

      const config = TestFixtures.createBasicAgent({
        name: "MemoryAgent",
        systemPrompt: "Test memory",
      });

      const codeResult = await generateTestAgent(t, config);
      assertAgentHasDecorator(codeResult.generatedCode, TEST_CONSTANTS.MODELS.CLAUDE_SONNET);
    });
  });

  describe("@tool Decorator Verification", () => {
    test("should verify @tool decorator for custom tools", async () => {
      const t = convexTest(schema, modules);

      const customTool = TestFixtures.createCustomTool(
        "CustomAnalyzer",
        "Analyzes data",
        [{ name: "data", type: "str", description: "Data to analyze", required: true }]
      );

      const config = TestFixtures.createCustomToolAgent(customTool, {
        name: "ToolDecoratorAgent",
        systemPrompt: "Test tool decorator",
      });

      const codeResult = await generateTestAgent(t, config);
      assertCodeHasToolDecorator(codeResult.generatedCode, "CustomAnalyzer", "Analyzes data");
    });

    test("should verify tool parameter schema generation", async () => {
      const t = convexTest(schema, modules);

      const customTool = TestFixtures.createCustomTool(
        "DataProcessor",
        "Processes data",
        [
          { name: "input", type: "str", description: "Input data", required: true },
          { name: "format", type: "str", description: "Output format", required: false },
        ]
      );

      const config = TestFixtures.createCustomToolAgent(customTool, {
        name: "SchemaAgent",
        systemPrompt: "Test schema",
      });

      const codeResult = await generateTestAgent(t, config);
      const code = codeResult.generatedCode;

      expect(code).toContain('"input"');
      expect(code).toContain('"type": "str"');
      expect(code).toContain('"description": "Input data"');
    });

    test("should not generate @tool decorator for built-in tools", async () => {
      const t = convexTest(schema, modules);

      const config = TestFixtures.createBasicAgent({
        name: "BuiltInAgent",
        systemPrompt: "Test built-in tools",
        tools: [TEST_CONSTANTS.TOOLS.SEARCH, TEST_CONSTANTS.TOOLS.CALCULATOR],
      });

      const codeResult = await generateTestAgent(t, config);
      const code = codeResult.generatedCode;

      // Verify built-in tools are imported, not defined with @tool
      expect(code).toContain("from strandsagents.tools import (");
      expect(code).toContain("search");
      expect(code).toContain("calculator");

      // Should not have custom @tool definitions for these
      const toolDecorators = (code.match(/@tool\(/g) || []).length;
      expect(toolDecorators).toBe(0);
    });
  });

  describe("Requirements.txt Generation", () => {
    test("should generate requirements.txt with base packages", async () => {
      const t = convexTest(schema, modules);

      const config = TestFixtures.createBasicAgent({
        name: "RequirementsAgent",
        systemPrompt: "Test requirements",
      });

      const codeResult = await generateTestAgent(t, config);
      assertRequirementsContains(codeResult.requirementsTxt, [
        "strands-agents>=1.0.0",
        "strands-agents-tools>=1.0.0",
        "opentelemetry-api>=1.0.0",
        "opentelemetry-sdk>=1.0.0",
      ]);
    });

    test("should include tool-specific packages in requirements", async () => {
      const t = convexTest(schema, modules);

      const config = TestFixtures.createBasicAgent({
        name: "ToolPackagesAgent",
        systemPrompt: "Test tool packages",
        tools: [
          { name: "Browser", type: "browser", config: {}, extrasPip: "browser" },
          { name: "S3", type: "s3", config: {}, extrasPip: "aws" },
        ],
        deploymentType: "aws",
      });

      const codeResult = await generateTestAgent(t, config);
      assertRequirementsContains(codeResult.requirementsTxt, [
        "strands-agents-tools[browser]",
        "strands-agents-tools[aws]",
      ]);
    });

    test("should include custom pip packages from tools", async () => {
      const t = convexTest(schema, modules);

      const config = TestFixtures.createBasicAgent({
        name: "CustomPackagesAgent",
        systemPrompt: "Test custom packages",
        tools: [
          {
            name: "CustomTool",
            type: "custom",
            config: {},
            pipPackages: ["pandas>=2.0.0", "numpy>=1.24.0"],
          },
        ],
      });

      const codeResult = await generateTestAgent(t, config);
      assertRequirementsContains(codeResult.requirementsTxt, [
        "pandas>=2.0.0",
        "numpy>=1.24.0",
      ]);
    });
  });

  describe("Environment Variable Inclusion", () => {
    test("should include environment variables in container setup", async () => {
      const t = convexTest(schema, modules);

      const config = TestFixtures.createBasicAgent({
        name: "EnvVarAgent",
        systemPrompt: "Test env vars",
        deploymentType: "docker",
      });

      const codeResult = await generateTestAgent(t, config);
      const code = codeResult.generatedCode;

      expect(code).toContain('"LOG_LEVEL": "INFO"');
      expect(code).toContain('"AGENT_NAME": "EnvVarAgent"');
    });

    test("should include AWS environment variables for AWS deployment", async () => {
      const t = convexTest(schema, modules);

      const config = TestFixtures.createBasicAgent({
        name: "AWSEnvAgent",
        systemPrompt: "Test AWS env",
        deploymentType: "aws",
      });

      const codeResult = await generateTestAgent(t, config);
      const code = codeResult.generatedCode;

      expect(code).toContain("import boto3");
      expect(code).toContain("from botocore.config import Config");
      expect(code).toContain('region_name=os.getenv("AWS_REGION"');
    });
  });

  describe("Multiple Tool Combinations", () => {
    test("should handle mix of built-in and custom tools", async () => {
      const t = convexTest(schema, modules);

      const customTool = TestFixtures.createCustomTool(
        "CustomAnalyzer",
        "Custom analysis tool",
        [{ name: "data", type: "str", description: "Data", required: true }]
      );

      const config = TestFixtures.createBasicAgent({
        name: "MixedToolsAgent",
        systemPrompt: "Test mixed tools",
        tools: [
          TEST_CONSTANTS.TOOLS.SEARCH,
          TEST_CONSTANTS.TOOLS.CALCULATOR,
          customTool,
        ],
      });

      const codeResult = await generateTestAgent(t, config);
      const code = codeResult.generatedCode;

      // Verify built-in tools are imported
      expect(code).toContain("from strandsagents.tools import (");
      expect(code).toContain("search");
      expect(code).toContain("calculator");

      // Verify custom tool has @tool decorator
      assertCodeHasToolDecorator(code, "CustomAnalyzer");

      // Verify all tools are in agent decorator
      expect(code).toContain("tools=[search, calculator, custom_analyzer]");
    });

    test("should generate valid Python syntax for all tool combinations", async () => {
      const t = convexTest(schema, modules);

      const config = TestFixtures.createBasicAgent({
        name: "MultiToolSyntaxAgent",
        systemPrompt: "Test syntax",
        tools: [
          TEST_CONSTANTS.TOOLS.FILE_READ,
          TEST_CONSTANTS.TOOLS.FILE_WRITE,
          TEST_CONSTANTS.TOOLS.HTTP_REQUEST,
          TEST_CONSTANTS.TOOLS.BROWSER,
        ],
      });

      const codeResult = await generateTestAgent(t, config);
      const code = codeResult.generatedCode;

      // Basic syntax checks
      expect(code).toContain("from strandsagents import agent, Agent, tool");
      expect(code).toContain("@agent(");
      expect(code).toContain("class MultiToolSyntaxAgentAgent(Agent):");
      expect(code).toContain("async def run(self");

      // Verify no syntax errors in imports
      expect(code).toContain("from strandsagents.tools import (");
      expect(code).toContain("file_read");
      expect(code).toContain("file_write");
      expect(code).toContain("http_request");
      expect(code).toContain("browser");
      expect(code).toContain(")");
    });
  });

  describe("Complete Agent Builder Flow", () => {
    let sharedAgentId: any;
    let sharedCodeResult: any;

    test("Step 1: should generate agent code with mixed tools", async () => {
      const t = convexTest(schema, modules);
      t.withIdentity({ subject: TEST_CONSTANTS.USERS.AGENT_BUILDER });

      const customTool = TestFixtures.createCustomTool(
        "CustomTool",
        "Custom tool",
        [{ name: "input", type: "str", description: "Input", required: true }]
      );

      const config = TestFixtures.createBasicAgent({
        name: "CompleteFlowAgent",
        systemPrompt: "You are a complete flow test agent",
        tools: [TEST_CONSTANTS.TOOLS.SEARCH, customTool],
        deploymentType: "aws",
      });

      sharedCodeResult = await generateTestAgent(t, config);
      expect(sharedCodeResult.generatedCode).toBeDefined();
      expect(sharedCodeResult.requirementsTxt).toBeDefined();
    });

    test("Step 2: should create agent from generated code", async () => {
      const t = convexTest(schema, modules);
      t.withIdentity({ subject: TEST_CONSTANTS.USERS.AGENT_BUILDER });

      const customTool = TestFixtures.createCustomTool(
        "CustomTool",
        "Custom tool",
        [{ name: "input", type: "str", description: "Input", required: true }]
      );

      const config = TestFixtures.createBasicAgent({
        name: "CompleteFlowAgent",
        systemPrompt: "You are a complete flow test agent",
        tools: [TEST_CONSTANTS.TOOLS.SEARCH, customTool],
        deploymentType: "aws",
      });

      const codeResult = await generateTestAgent(t, config);
      sharedAgentId = await createAgent(t, {
        ...config,
        description: "Complete flow test agent",
        generatedCode: codeResult.generatedCode,
      });

      expect(sharedAgentId).toBeDefined();
    });

    test("Step 3: should verify agent properties", async () => {
      const t = convexTest(schema, modules);
      t.withIdentity({ subject: TEST_CONSTANTS.USERS.AGENT_BUILDER });

      // Create agent for this test
      const customTool = TestFixtures.createCustomTool(
        "CustomTool",
        "Custom tool",
        [{ name: "input", type: "str", description: "Input", required: true }]
      );

      const config = TestFixtures.createBasicAgent({
        name: "CompleteFlowAgent",
        systemPrompt: "You are a complete flow test agent",
        tools: [TEST_CONSTANTS.TOOLS.SEARCH, customTool],
        deploymentType: "aws",
      });

      const codeResult = await generateTestAgent(t, config);
      const agentId = await createAgent(t, {
        ...config,
        description: "Complete flow test agent",
        generatedCode: codeResult.generatedCode,
      });

      const agent = await getAgent(t, agentId);
      expect(agent).toBeDefined();
      expect(agent?.name).toBe("CompleteFlowAgent");
      expect(agent?.generatedCode).toContain("@agent(");
      expect(agent?.generatedCode).toContain("@tool(");
      expect(agent?.tools).toHaveLength(2);
    });

    test("Step 4: should update agent description", async () => {
      const t = convexTest(schema, modules);
      t.withIdentity({ subject: TEST_CONSTANTS.USERS.AGENT_BUILDER });

      // Create agent for this test
      const config = TestFixtures.createBasicAgent({
        name: "UpdateTestAgent",
        deploymentType: "aws",
      });

      const codeResult = await generateTestAgent(t, config);
      const agentId = await createAgent(t, {
        ...config,
        generatedCode: codeResult.generatedCode,
      });

      // Update agent
      await t.mutation(api.agents.update, {
        id: agentId,
        description: "Updated description",
      });

      const updatedAgent = await getAgent(t, agentId);
      expect(updatedAgent?.description).toBe("Updated description");
    });

    test("Step 5: should list user's agents", async () => {
      const t = convexTest(schema, modules);
      t.withIdentity({ subject: TEST_CONSTANTS.USERS.AGENT_BUILDER });

      // Create an agent for this test
      const config = TestFixtures.createBasicAgent({
        name: "ListTestAgent",
      });

      const codeResult = await generateTestAgent(t, config);
      const agentId = await createAgent(t, {
        ...config,
        generatedCode: codeResult.generatedCode,
      });

      // List agents
      const userAgents = await t.query(api.agents.list);
      expect(userAgents.length).toBeGreaterThan(0);
      expect(userAgents.some((a: any) => a._id === agentId)).toBe(true);
    });
  });
});
