export default {
  providers: [
    // This is the default provider for Convex email/passwordless auth
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
    // GitHub OAuth
    {
      domain: "https://github.com",
      applicationID: "github",
      clientID: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    },
    // Google OAuth
    {
      domain: "https://accounts.google.com",
      applicationID: "google",
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    // AWS Cognito OAuth (optional - only enabled if configured)
    ...(process.env.COGNITO_ISSUER_URL && process.env.COGNITO_CLIENT_ID ? [{
      domain: process.env.COGNITO_ISSUER_URL,
      applicationID: "cognito",
      clientID: process.env.COGNITO_CLIENT_ID,
      clientSecret: process.env.COGNITO_CLIENT_SECRET || "",
    }] : []),
  ],
};