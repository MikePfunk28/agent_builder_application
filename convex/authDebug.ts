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

    // All deployment environments that need OAuth callback URLs configured
    // Uses env vars where available, falls back to known deployment URLs
    const convexSiteUrl = process.env.CONVEX_SITE_URL || "https://resolute-kudu-325.convex.site";
    const cloudflareUrl = process.env.CLOUDFLARE_PAGES_URL || "https://633051e6.agent-builder-application.pages.dev";
    const customDomainUrl = process.env.CUSTOM_DOMAIN_URL || "https://ai-forge.mikepfunk.com";
    const deploymentUrls = [
      {
        name: "Local Development",
        url: "http://localhost:4000",
        description: "For local testing during development",
      },
      {
        name: "Convex Production",
        url: convexSiteUrl,
        description: "Primary Convex backend deployment",
      },
      {
        name: "Cloudflare Pages",
        url: cloudflareUrl,
        description: "Cloudflare Pages deployment",
      },
      {
        name: "Custom Domain",
        url: customDomainUrl,
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
