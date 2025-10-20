import { DEPLOYMENT_URLS } from "./constants";

export default {
  providers: [
    {
      // IMPORTANT: Must match production Convex site URL for OAuth callbacks
      // Uses centralized deployment URL constant
      domain: DEPLOYMENT_URLS.PRODUCTION,
      applicationID: "convex",
    },
    // AWS Cognito removed - users will sign in with AWS directly when deploying
    // GitHub/Google OAuth handled by Convex Auth for app access
  ],
};
