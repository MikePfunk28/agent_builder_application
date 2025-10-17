import { query } from "./_generated/server";

export const getOAuthConfig = query({
  handler: async () => {
    const providers = [
      {
        id: "github",
        name: "GitHub",
        configured: !!(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET),
        envVars: {
          clientId: process.env.AUTH_GITHUB_ID ? "✓ Set" : "✗ Missing",
          clientSecret: process.env.AUTH_GITHUB_SECRET ? "✓ Set" : "✗ Missing",
        },
      },
      {
        id: "google",
        name: "Google",
        configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        envVars: {
          clientId: process.env.GOOGLE_CLIENT_ID ? "✓ Set" : "✗ Missing",
          clientSecret: process.env.GOOGLE_CLIENT_SECRET ? "✓ Set" : "✗ Missing",
        },
      },
      {
        id: "cognito",
        name: "AWS Cognito",
        configured: !!(
          process.env.COGNITO_ISSUER_URL &&
          process.env.COGNITO_CLIENT_ID &&
          process.env.COGNITO_CLIENT_SECRET
        ),
        envVars: {
          issuerUrl: process.env.COGNITO_ISSUER_URL ? "✓ Set" : "✗ Missing",
          clientId: process.env.COGNITO_CLIENT_ID ? "✓ Set" : "✗ Missing",
          clientSecret: process.env.COGNITO_CLIENT_SECRET ? "✓ Set" : "✗ Missing",
        },
      },
    ];

    // Convex Auth handles OAuth callbacks through the Convex backend
    const convexSiteUrl = process.env.CONVEX_SITE_URL || "https://resolute-kudu-325.convex.site";

    const environments = [
      {
        name: "OAuth Callback URLs (Configure in OAuth Provider)",
        url: convexSiteUrl,
        note: "All OAuth providers should redirect to your Convex backend URL",
        callbackUrls: providers.map((p) => ({
          provider: p.id,
          url: `${convexSiteUrl}/api/auth/callback/${p.id}`,
        })),
      },
    ];

    return {
      providers,
      environments,
    };
  },
});
