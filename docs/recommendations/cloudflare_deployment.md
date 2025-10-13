# Cloudflare Pages Deployment Guide

## Overview

This application uses Convex for the backend and Cloudflare Pages for the frontend. The authentication is handled by Convex Auth.

## Prerequisites

1. Convex account and deployment URL
2. Cloudflare account with Pages enabled
3. Git repository connected to Cloudflare Pages

## Environment Variables

### Cloudflare Pages Environment Variables

Set these in **Cloudflare Dashboard > Pages > Your Project > Settings > Environment variables**:

#### Required Variables

```bash
# Production Environment
VITE_CONVEX_URL=https://resolute-kudu-325.convex.cloud

# Preview Environment (same as production for now)
VITE_CONVEX_URL=https://resolute-kudu-325.convex.cloud
```

#### Important Notes:
- ✅ Variable name must be **exactly** `VITE_CONVEX_URL` (case-sensitive)
- ✅ Set for both **Production** and **Preview** environments
- ✅ No quotes around the URL
- ✅ Must include `https://` protocol
- ❌ Don't use `CONVEX_URL` - it must have the `VITE_` prefix

### How to Add Environment Variables in Cloudflare

1. Go to **Cloudflare Dashboard**
2. Select **Pages**
3. Click on your project
4. Go to **Settings** > **Environment variables**
5. Click **Add variable**
6. Set:
   - **Variable name**: `VITE_CONVEX_URL`
   - **Value**: `https://resolute-kudu-325.convex.cloud`
   - **Environment**: Select both **Production** and **Preview**
7. Click **Save**

## Build Configuration

### Cloudflare Pages Build Settings

Set these in **Cloudflare Dashboard > Pages > Your Project > Settings > Builds & deployments**:

```yaml
Build command: npm run build
Build output directory: dist
Root directory: /
Node version: 18 or higher
```

### Important Build Details

1. **Build Command**: Use `npm run build` (NOT `npx convex deploy`)
   - Convex deployment happens separately
   - The build command only builds the frontend

2. **Build Output**: The `dist` directory contains the built frontend

3. **Node Version**: Use Node 18+ (set in Cloudflare Pages settings)

### Current package.json Build Script

```json
{
  "scripts": {
    "build": "npm install @rollup/rollup-linux-x64-gnu --prefer-online --no-save && vite build"
  }
}
```

This is correct for Cloudflare Pages (Linux environment).

## Convex Configuration

### Convex Deployment URL

Your Convex backend is deployed at:
```
https://resolute-kudu-325.convex.cloud
```

### Convex Auth Configuration

The auth is configured in `convex/auth.config.ts`:

```typescript
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
```

### CONVEX_SITE_URL Setup

This is set automatically by Convex, but you need to ensure it matches your Cloudflare Pages URL.

#### In Convex Dashboard:

1. Go to **Convex Dashboard** > **Settings**
2. Set **CONVEX_SITE_URL** to your Cloudflare Pages URL:
   ```
   https://your-project.pages.dev
   ```

3. Or for custom domain:
   ```
   https://yourdomain.com
   ```

#### Via Convex CLI:

```bash
npx convex env set CONVEX_SITE_URL "https://your-project.pages.dev"
```

## Deployment Process

### Step 1: Deploy Convex Backend

```bash
# From your local machine
npx convex deploy --prod
```

This deploys your Convex functions to production.

### Step 2: Deploy Frontend to Cloudflare Pages

#### Option A: Automatic (Git Push)

```bash
git add .
git commit -m "Deploy to production"
git push origin main
```

Cloudflare Pages will automatically:
1. Detect the push
2. Run `npm install`
3. Run `npm run build`
4. Deploy the `dist` folder

#### Option B: Manual (Cloudflare Dashboard)

1. Go to **Cloudflare Pages** > **Your Project**
2. Click **Create deployment**
3. Upload the `dist` folder manually

### Step 3: Verify Deployment

1. Visit your Cloudflare Pages URL
2. Try to sign in or sign up
3. Check browser console for errors
4. Check Cloudflare Pages deployment logs

## Troubleshooting Login Issues

### Issue: "Stuck on Login" or "Login Not Working"

#### Symptom
- Login form submits but nothing happens
- No error message shown
- Page doesn't redirect

#### Common Causes & Solutions

### 1. Missing VITE_CONVEX_URL

**Check:**
```bash
# In browser console
console.log(import.meta.env.VITE_CONVEX_URL)
```

**Should show:**
```
https://resolute-kudu-325.convex.cloud
```

**If undefined:**
- Add `VITE_CONVEX_URL` in Cloudflare Pages environment variables
- Redeploy the site (environment changes require redeploy)

### 2. CORS / CONVEX_SITE_URL Mismatch

**Check Convex Dashboard:**
```bash
npx convex env get CONVEX_SITE_URL
```

**Should match your Cloudflare Pages URL:**
```
https://your-project.pages.dev
```

**If mismatch:**
```bash
npx convex env set CONVEX_SITE_URL "https://your-project.pages.dev"
```

### 3. Convex Functions Not Deployed

**Check:**
```bash
npx convex functions list
```

**Should show:**
- `auth:signIn`
- `auth:signOut`
- `loggedInUser`
- Other functions

**If missing:**
```bash
npx convex deploy --prod
```

### 4. Browser Console Errors

**Open DevTools (F12) and check for:**

#### Error: "Failed to fetch"
- VITE_CONVEX_URL is wrong or missing
- Network connectivity issue
- Convex deployment is down

#### Error: "CORS policy"
- CONVEX_SITE_URL doesn't match your domain
- Missing protocol (https://)

#### Error: "Auth error" or "Invalid flow"
- Convex auth not properly initialized
- Check `convex/auth.ts` configuration

### 5. Cloudflare Build Issues

**Check Cloudflare Pages build logs:**

1. Go to **Deployments** tab
2. Click on latest deployment
3. View **Build log**

**Common build errors:**

```
Error: VITE_CONVEX_URL is not defined
```
**Solution:** Add environment variable in Cloudflare settings

```
Error: Module not found
```
**Solution:** Check `package.json` dependencies are correct

## Testing Locally

### Before Deploying

```bash
# Install dependencies
npm install

# Start Convex dev server
npx convex dev

# In another terminal, start frontend
npm run dev
```

**Visit:** `http://localhost:5173`

**Test:**
1. Sign up with email/password
2. Sign in
3. Sign out
4. Anonymous sign in

## Environment Variables Reference

### Development (.env.local)
```bash
VITE_CONVEX_URL=http://localhost:3000
```

### Production (Cloudflare Pages)
```bash
VITE_CONVEX_URL=https://resolute-kudu-325.convex.cloud
```

### Convex Dashboard (set via CLI or dashboard)
```bash
CONVEX_SITE_URL=https://your-project.pages.dev
```

## Auth Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     User's Browser                               │
│  https://your-project.pages.dev                                  │
│                                                                   │
│  ┌─────────────────────────────────────────────────────┐        │
│  │  React App (Cloudflare Pages)                       │        │
│  │  - SignInForm                                       │        │
│  │  - Uses VITE_CONVEX_URL                            │        │
│  └─────────────────────────────────────────────────────┘        │
│                        │                                          │
│                        │ signIn("password", formData)            │
│                        ▼                                          │
└─────────────────────────────────────────────────────────────────┘
                         │
                         │ HTTPS Request
                         │
┌─────────────────────────────────────────────────────────────────┐
│                   Convex Backend                                 │
│  https://resolute-kudu-325.convex.cloud                         │
│                                                                   │
│  ┌─────────────────────────────────────────────────────┐        │
│  │  Convex Auth                                        │        │
│  │  - Verifies CONVEX_SITE_URL matches origin         │        │
│  │  - Processes authentication                        │        │
│  │  - Returns auth token                              │        │
│  └─────────────────────────────────────────────────────┘        │
│                        │                                          │
│                        │ Auth Token                               │
│                        ▼                                          │
└─────────────────────────────────────────────────────────────────┘
                         │
                         │ Token stored in browser
                         ▼
              User is authenticated ✓
```

## Security Checklist

- ✅ VITE_CONVEX_URL uses HTTPS in production
- ✅ CONVEX_SITE_URL matches your domain exactly
- ✅ No sensitive keys in frontend code
- ✅ Convex auth providers properly configured
- ✅ CORS configured correctly

## Common Deployment Commands

```bash
# Deploy Convex functions
npx convex deploy --prod

# Check Convex deployment status
npx convex dashboard

# View environment variables
npx convex env list

# Set environment variable
npx convex env set VARIABLE_NAME "value"

# Trigger Cloudflare Pages rebuild (via git)
git commit --allow-empty -m "Trigger rebuild"
git push
```

## Quick Fix Checklist

If login is stuck, run through this checklist:

1. ✅ VITE_CONVEX_URL is set in Cloudflare Pages
2. ✅ VITE_CONVEX_URL value is correct (https://resolute-kudu-325.convex.cloud)
3. ✅ CONVEX_SITE_URL in Convex matches Cloudflare Pages URL
4. ✅ Convex functions are deployed (`npx convex deploy --prod`)
5. ✅ Cloudflare Pages build succeeded
6. ✅ Browser console shows no CORS errors
7. ✅ Network tab shows requests to Convex URL

## Support

If still having issues:

1. **Check Convex Status**: https://status.convex.dev
2. **Convex Discord**: https://convex.dev/community
3. **Cloudflare Status**: https://cloudflarestatus.com
4. **Browser DevTools**: Check Console and Network tabs

## Additional Resources

- [Convex Auth Documentation](https://docs.convex.dev/auth)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
