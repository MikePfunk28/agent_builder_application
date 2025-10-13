# Cloudflare Pages Setup - Quick Reference

## TL;DR - Fix Login Issues Now

### Step 1: Cloudflare Pages Environment Variables

**Location:** Cloudflare Dashboard > Pages > Your Project > Settings > Environment variables

Add this variable:
```
Variable name: VITE_CONVEX_URL
Value: https://resolute-kudu-325.convex.cloud
Environment: Production and Preview
```

### Step 2: Cloudflare Build Settings

**Location:** Cloudflare Dashboard > Pages > Your Project > Settings > Builds & deployments

```
Build command: npm run build
Build output directory: dist
Root directory: /
Node version: 18
```

### Step 3: Convex Site URL

Run this command locally:
```bash
npx convex env set CONVEX_SITE_URL "https://YOUR-PROJECT.pages.dev"
```

Replace `YOUR-PROJECT` with your actual Cloudflare Pages project name.

### Step 4: Deploy

```bash
# Deploy Convex backend
npx convex deploy --prod

# Push to git (triggers Cloudflare build)
git push origin main
```

## Verify Everything Works

### 1. Check Environment Variable

Open browser DevTools (F12) on your deployed site and run:
```javascript
console.log(import.meta.env.VITE_CONVEX_URL)
// Should show: https://resolute-kudu-325.convex.cloud
```

### 2. Check Convex Site URL

Locally, run:
```bash
npx convex env get CONVEX_SITE_URL
# Should match your Cloudflare Pages URL
```

### 3. Check Convex Functions

```bash
npx convex functions list
# Should show: auth:signIn, auth:signOut, loggedInUser, etc.
```

### 4. Test Login

1. Go to your deployed site
2. Try to sign up/sign in
3. Check browser console for errors

## Common Mistakes

❌ **Wrong:** `CONVEX_URL` (missing VITE_ prefix)
✅ **Right:** `VITE_CONVEX_URL`

❌ **Wrong:** Build command is `npx convex deploy`  
❌ **Wrong:** Build command is `npx convex deploy --cmd 'npm run build'`  
✅ **Right:** Build command is `npm run build`

❌ **Wrong:** CONVEX_SITE_URL is `http://localhost:5173`
✅ **Right:** CONVEX_SITE_URL is `https://your-project.pages.dev`

❌ **Wrong:** Only set environment variable for Production
✅ **Right:** Set for both Production and Preview

## Still Having Issues?

### Check Cloudflare Build Logs

1. Cloudflare Dashboard > Pages > Your Project
2. Click latest deployment
3. View build log
4. Look for errors

### Check Browser Console

1. Open DevTools (F12)
2. Go to Console tab
3. Look for errors (red text)
4. Common errors:
   - "Failed to fetch" → VITE_CONVEX_URL is wrong or missing
   - "CORS policy" → CONVEX_SITE_URL mismatch

### Check Network Tab

1. Open DevTools (F12)
2. Go to Network tab
3. Try to sign in
4. Look for requests to Convex URL
5. Check if they return errors

## Get Your Cloudflare Pages URL

Don't know your Cloudflare Pages URL?

1. Go to Cloudflare Dashboard > Pages
2. Click your project
3. Look for the URL (usually `https://PROJECT-NAME.pages.dev`)
4. Or check custom domain if you set one up

## Full Documentation

For detailed information, see: `docs/cloudflare_deployment.md`
