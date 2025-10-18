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

// GitHub OAuth with custom profile handler
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(
    GitHub({
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.name ?? profile.login,
          email: profile.email,
          image: profile.avatar_url,
          login: profile.login, // GitHub username - custom field
        };
      },
    })
  );
}

// Google OAuth with custom profile handler
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          locale: profile.locale, // User's locale preference - custom field
        };
      },
    })
  );
} else if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      profile(profile: any) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          locale: profile.locale, // User's locale preference - custom field
        };
      },
    } as any)
  );
}

// AWS Cognito OAuth - OIDC provider for AWS Federated Identity
// When users sign in with Cognito, they can exchange their ID token for AWS credentials
// This enables deployment to their own AWS accounts
if (process.env.COGNITO_CLIENT_ID && process.env.COGNITO_CLIENT_SECRET && process.env.COGNITO_ISSUER_URL) {
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
        // Store the ID token for AWS credential exchange
        cognitoIdToken: profile.id_token,
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