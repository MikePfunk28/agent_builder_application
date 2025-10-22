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
        configured: !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
        envVars: {
          clientId: process.env.AUTH_GOOGLE_ID ? "✓ Set" : "✗ Missing",
          clientSecret: process.env.AUTH_GOOGLE_SECRET ? "✓ Set" : "✗ Missing",
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

    // All 4 deployment environments that need OAuth callback URLs configured
    const deploymentUrls = [
      {
        name: "Local Development",
        url: "http://localhost:3000",
        description: "For local testing during development",
      },
      {
        name: "Convex Production",
        url: "https://resolute-kudu-325.convex.site",
        description: "Primary Convex backend deployment",
      },
      {
        name: "Cloudflare Pages",
        url: "https://633051e6.agent-builder-application.pages.dev",
        description: "Cloudflare Pages deployment",
      },
      {
        name: "Custom Domain",
        url: "https://ai-forge.mikepfunk.com",
        description: "Production custom domain",
      },
    ];

    const environments = deploymentUrls.map((env) => ({
      name: env.name,
      url: env.url,
      description: env.description,
      callbackUrls: providers.map((p) => ({
        provider: p.id,
        providerName: p.name,
        url: `${env.url}/api/auth/callback/${p.id}`,
      })),
    }));

    return {
      providers,
      environments,
    };
  },
});
