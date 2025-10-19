import GitHub from "@auth/core/providers/github";
import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

// Build providers array with all authentication methods
const providers: any[] = [
  Anonymous, // Continue as guest
  Password,  // Email/password authentication
  GitHub,    // GitHub OAuth
  Google,    // Google OAuth
];

// AWS Cognito OAuth - OIDC provider for AWS Federated Identity
// When users sign in with Cognito, they can exchange their ID token for AWS credentials
// This enables deployment to their own AWS accounts
if (process.env.COGNITO_ISSUER_URL && process.env.COGNITO_CLIENT_ID && process.env.COGNITO_CLIENT_SECRET) {
  const Cognito = {
    id: "cognito",
    name: "AWS Cognito",
    type: "oidc",
    issuer: process.env.COGNITO_ISSUER_URL,
    clientId: process.env.COGNITO_CLIENT_ID,
    clientSecret: process.env.COGNITO_CLIENT_SECRET,
    authorization: {
      params: {
        scope: "openid email profile aws.cognito.signin.user.admin",
      },
    },
    profile(profile: any) {
      return {
        id: profile.sub,
        name: profile.name ?? profile.email,
        email: profile.email,
        image: profile.picture,
        cognitoUsername: profile["cognito:username"],
      };
    },
  };
  providers.push(Cognito as any);
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers,
});

export const loggedInUser = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get(userId);
    return user ?? null;
  },
});