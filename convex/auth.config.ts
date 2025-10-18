export default {
  providers: [
    // GitHub OAuth
    {
      domain: "https://github.com",
      applicationID: "github",
    },
    // Google OAuth
    {
      domain: "https://accounts.google.com",
      applicationID: "google",
    },
    // AWS Cognito OAuth (optional - only enabled if configured)
    ...(process.env.COGNITO_ISSUER_URL && process.env.COGNITO_CLIENT_ID ? [{
      domain: process.env.COGNITO_ISSUER_URL,
      applicationID: process.env.COGNITO_CLIENT_ID,
    }] : []),
  ],
};