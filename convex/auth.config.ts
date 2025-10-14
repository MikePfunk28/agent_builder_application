export default {
  providers: [
    // This is the default provider for Convex email/passwordless auth
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
    // Add this provider for GitHub OAuth
    {
      domain: "https://github.com",
      applicationID: "github",
      clientID: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  ],
};