import GitHub from "@auth/core/providers/github";
import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

// Build providers array conditionally based on environment variables
const providers: any[] = [
  Anonymous,
  Password,
];

// GitHub OAuth - auto-detects AUTH_GITHUB_ID and AUTH_GITHUB_SECRET
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(GitHub);
}

// Google OAuth - needs to check GOOGLE_CLIENT_ID since that's what's set
// Convex Auth expects AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET by default
// But we can configure it explicitly
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    } as any)
  );
}

// AWS Cognito OAuth - OIDC provider
if (process.env.COGNITO_ISSUER_URL && process.env.COGNITO_CLIENT_ID && process.env.COGNITO_CLIENT_SECRET) {
  providers.push({
    id: "cognito",
    name: "AWS Cognito",
    type: "oidc",
    issuer: process.env.COGNITO_ISSUER_URL,
    clientId: process.env.COGNITO_CLIENT_ID,
    clientSecret: process.env.COGNITO_CLIENT_SECRET,
    authorization: {
      params: {
        scope: "openid profile email",
      },
    },
  } as any);
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