# OAuth Callback URL Configuration

## Critical: Configure These Callback URLs in Your OAuth Providers

Your Convex deployment is at: `https://resolute-kudu-325.convex.site`

For Convex Auth to work, you MUST configure the following callback URLs in each OAuth provider's settings:

---

## GitHub OAuth App Settings

**Location**: https://github.com/settings/developers (or your organization's OAuth Apps)

**Required Configuration**:
- **Authorization callback URL**: `https://resolute-kudu-325.convex.site/api/auth/callback/github`

**Current Environment Variables** (already set in Convex):
- `AUTH_GITHUB_ID=Ov23liUe2U4dpqlFQch3`
- `AUTH_GITHUB_SECRET=8cd92ac09f06ac6e553535f23e30cc767d6f5dc5`

**Steps to Fix**:
1. Go to your GitHub OAuth App settings
2. Find the "Authorization callback URL" field
3. Set it to: `https://resolute-kudu-325.convex.site/api/auth/callback/github`
4. Save changes

---

## Google OAuth 2.0 Client Settings

**Location**: https://console.cloud.google.com/apis/credentials

**Required Configuration**:
- **Authorized redirect URIs**: `https://resolute-kudu-325.convex.site/api/auth/callback/google`

**Current Environment Variables** (already set in Convex):
- `GOOGLE_CLIENT_ID=89369419857-jmqp714gpkr10tjp2i7acioml3d3u8ko.apps.googleusercontent.com`
- `GOOGLE_CLIENT_SECRET=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`

**Steps to Fix**:
1. Go to Google Cloud Console > APIs & Services > Credentials
2. Click on your OAuth 2.0 Client ID
3. Under "Authorized redirect URIs", add: `https://resolute-kudu-325.convex.site/api/auth/callback/google`
4. Save changes

---

## AWS Cognito User Pool App Client Settings

**Location**: AWS Console > Cognito > User Pool: `us-east-1_hMFTc7CNL` > App integration

**Required Configuration**:
- **Callback URLs**: `https://resolute-kudu-325.convex.site/api/auth/callback/cognito`

**Current Environment Variables** (already set in Convex):
- `COGNITO_ISSUER_URL=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_hMFTc7CNL`
- `COGNITO_CLIENT_ID=fk09hmkpbk7sral3cj9ofh5vc`
- `COGNITO_CLIENT_SECRET=e036425rntb3atgvgjpetnuf3mroc2tfdgloarmsn4b2h54072r`
- `COGNITO_DOMAIN=agent-builder-auth-16174926.auth.us-east-1.amazoncognito.com`

**Steps to Fix**:
1. Go to AWS Console > Cognito > User Pools
2. Select your user pool: `us-east-1_hMFTc7CNL`
3. Go to "App integration" tab
4. Click on your app client
5. Under "Hosted UI" settings, add to "Callback URLs": `https://resolute-kudu-325.convex.site/api/auth/callback/cognito`
6. Save changes

---

## Why This Fixes the 404 Error

The 404 error you're seeing happens because:

1. When a user clicks "Sign in with GitHub/Google/Cognito", they're redirected to the OAuth provider
2. After authentication, the provider redirects back to the callback URL
3. If the callback URL doesn't match what's configured in the provider, you get a 404 or error

**The callback URL MUST be your Convex deployment URL** (`.convex.site`), NOT your frontend domain (`ai-forge.mikepfunk.com`). This is because Convex Auth handles the OAuth flow on the backend.

---

## Code Changes Made

### File: `convex/auth.ts`

Updated to properly configure each OAuth provider with environment variables:

- **GitHub**: Now uses `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`
- **Google**: Now uses `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- **Cognito**: Now uses `COGNITO_ISSUER_URL`, `COGNITO_CLIENT_ID`, and `COGNITO_CLIENT_SECRET`

All providers are conditionally added only if their environment variables are set, preventing errors.

---

## Testing After Configuration

Once you've updated the callback URLs in all three OAuth providers:

1. Clear your browser cache/cookies
2. Go to https://ai-forge.mikepfunk.com
3. Try signing in with each provider:
   - Click "Sign in with GitHub" - should redirect to GitHub, then back successfully
   - Click "Sign in with Google" - should redirect to Google, then back successfully
   - Click "Sign in with AWS Cognito" - should redirect to Cognito hosted UI, then back successfully

---

## CORS Configuration

Your `convex/http.ts` already has CORS configured to allow all origins (`*`), so CORS should not be an issue.

---

## Custom Domain (api.mikepfunk.com)

If you want to use your custom domain `api.mikepfunk.com` for OAuth callbacks instead:

1. You'll need to update ALL callback URLs to use `https://api.mikepfunk.com/api/auth/callback/{provider}`
2. Verify that `api.mikepfunk.com` correctly points to your Convex deployment
3. This is optional - using the `.convex.site` domain should work fine
