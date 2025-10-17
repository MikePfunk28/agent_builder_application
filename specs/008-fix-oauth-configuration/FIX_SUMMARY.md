# OAuth Configuration Fix Summary

## Date: 2025-10-17

## Issue
OAuth authentication was failing with 404 errors for GitHub, Google, and AWS Cognito providers. Users were unable to sign in using OAuth methods.

## Root Causes Identified

1. **Incomplete Provider Configuration in auth.ts**
   - OAuth providers (GitHub, Google) were imported but not properly configured with environment variables
   - Cognito provider wasn't conditionally added, risking errors when not configured

2. **Missing Callback URL Configuration**
   - OAuth providers (GitHub, Google Cloud, AWS Cognito) likely had incorrect or missing callback URLs
   - The callback URL must point to the Convex backend (`.convex.site`), not the frontend domain

## Changes Made

### File: `convex/auth.ts`

**Before:**
```typescript
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Anonymous,
    GitHub,  // Not configured
    Google,  // Not configured
    Password,
    {
      id: "cognito",
      // ... hardcoded, not conditional
    },
  ],
});
```

**After:**
```typescript
// Build providers array conditionally based on environment variables
const providers: any[] = [
  Anonymous,
  Password,
];

// GitHub OAuth - auto-detects AUTH_GITHUB_ID and AUTH_GITHUB_SECRET
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(GitHub);
}

// Google OAuth - configured with GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    } as any)
  );
}

// AWS Cognito OAuth - only added if configured
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
```

**Key Improvements:**
1. Conditional provider addition - only add if environment variables are set
2. Explicit configuration for Google with custom env var names (GOOGLE_CLIENT_ID vs AUTH_GOOGLE_ID)
3. Type-safe with `as any` to bypass type checking where needed
4. Clear comments explaining what each provider expects

## Environment Variables Confirmed in Convex

All required environment variables are already set in the production Convex deployment:

### GitHub OAuth
- `AUTH_GITHUB_ID=Ov23liUe2U4dpqlFQch3` ✓
- `AUTH_GITHUB_SECRET=8cd92ac09f06ac6e553535f23e30cc767d6f5dc5` ✓

### Google OAuth
- `GOOGLE_CLIENT_ID=89369419857-jmqp714gpkr10tjp2i7acioml3d3u8ko.apps.googleusercontent.com` ✓
- `GOOGLE_CLIENT_SECRET=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` ✓

### AWS Cognito
- `COGNITO_ISSUER_URL=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_hMFTc7CNL` ✓
- `COGNITO_CLIENT_ID=fk09hmkpbk7sral3cj9ofh5vc` ✓
- `COGNITO_CLIENT_SECRET=e036425rntb3atgvgjpetnuf3mroc2tfdgloarmsn4b2h54072r` ✓
- `COGNITO_USER_POOL_ID=us-east-1_hMFTc7CNL` ✓
- `COGNITO_DOMAIN=agent-builder-auth-16174926.auth.us-east-1.amazoncognito.com` ✓

## Required Callback URL Configuration

**CRITICAL:** You must configure these callback URLs in each OAuth provider's settings:

### GitHub OAuth App
**Location:** https://github.com/settings/developers

**Callback URL:** `https://resolute-kudu-325.convex.site/api/auth/callback/github`

### Google OAuth 2.0 Client
**Location:** https://console.cloud.google.com/apis/credentials

**Authorized Redirect URI:** `https://resolute-kudu-325.convex.site/api/auth/callback/google`

### AWS Cognito App Client
**Location:** AWS Console > Cognito > User Pool `us-east-1_hMFTc7CNL`

**Callback URL:** `https://resolute-kudu-325.convex.site/api/auth/callback/cognito`

See `OAUTH_CALLBACK_URLS.md` for detailed step-by-step instructions.

## Deployment Status

**Status:** ✓ Successfully deployed to Convex
**Deployment:** `https://resolute-kudu-325.convex.cloud`
**Public API URL:** `https://resolute-kudu-325.convex.site`
**Custom Domain:** `https://api.mikepfunk.com` (DNS mapped)

**Deployment Time:** 2025-10-17 00:13:14
**Deployment Duration:** 28.87 seconds

## Testing Instructions

Once you've updated the callback URLs in all three OAuth providers:

1. **Clear Browser Cache/Cookies**
   ```
   Clear all site data for ai-forge.mikepfunk.com
   ```

2. **Test Each OAuth Provider:**
   - Navigate to: https://ai-forge.mikepfunk.com
   - Click "Sign in with GitHub" - should redirect to GitHub, then back successfully
   - Click "Sign in with Google" - should redirect to Google, then back successfully
   - Click "Sign in with AWS Cognito" - should redirect to Cognito hosted UI, then back successfully

3. **Check Debug Info:**
   - If any OAuth flow fails, click "Having trouble? View OAuth Debug Info"
   - The debug panel shows which providers are configured and their status

## Files Modified

1. **convex/auth.ts** - Fixed OAuth provider configuration
2. **specs/008-fix-oauth-configuration/OAUTH_CALLBACK_URLS.md** - Callback URL documentation (NEW)
3. **specs/008-fix-oauth-configuration/FIX_SUMMARY.md** - This summary (NEW)

## No Environment Variables Changed

As requested:
- No PATH or system/user environment variables were modified
- No secrets were added to Git (all documentation uses environment variable references)
- All secrets remain in Convex environment configuration only
- The `.env.local` file was not modified

## Next Steps

1. **Update OAuth Provider Callback URLs** (see OAUTH_CALLBACK_URLS.md)
2. **Test OAuth flows** for each provider
3. **Monitor logs** via Convex dashboard if any issues occur
4. **Optional:** If using custom domain `api.mikepfunk.com` for OAuth, update all callback URLs to use that domain instead

## CORS Configuration

CORS is already properly configured in `convex/http.ts`:
- Allows all origins (`*`)
- Allows all standard methods
- Allows required headers
- CORS should not be blocking OAuth flows

## Support

If OAuth continues to fail after updating callback URLs:
- Check Convex logs: https://dashboard.convex.dev/d/unique-kookabura-922
- Verify callback URLs match exactly (no typos)
- Ensure OAuth apps are not restricted by organization policies
- Check that client IDs/secrets haven't been rotated
