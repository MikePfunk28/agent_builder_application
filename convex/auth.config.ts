export default {
  providers: [
    {
      // IMPORTANT: Must match production Convex site URL for OAuth callbacks
      // Production: https://resolute-kudu-325.convex.site
      domain: process.env.CONVEX_SITE_URL || "https://resolute-kudu-325.convex.site",
      applicationID: "convex",
    },
    // AWS Cognito - Custom OIDC Provider
    // The domain must match the 'iss' field in Cognito's JWT
    // The applicationID must match the 'aud' field in Cognito's JWT
    ...(process.env.COGNITO_ISSUER_URL && process.env.COGNITO_CLIENT_ID
      ? [
          {
            domain: process.env.COGNITO_ISSUER_URL,
            applicationID: process.env.COGNITO_CLIENT_ID,
          },
        ]
      : []),
  ],
};
