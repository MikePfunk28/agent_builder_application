# Login Troubleshooting Visual Guide

## The Problem: Login Gets Stuck

```
User clicks "Sign in" → Form submits → Nothing happens → Stuck 😞
```

## Root Cause Analysis

```
┌─────────────────────────────────────────────────────────────────┐
│                        Login Flow                                │
└─────────────────────────────────────────────────────────────────┘

Step 1: User submits login form
   ↓
Step 2: React app reads VITE_CONVEX_URL
   ↓
   ├─ ✅ VITE_CONVEX_URL is set → Continue
   └─ ❌ VITE_CONVEX_URL is undefined → FAIL (stuck here)
   ↓
Step 3: Send auth request to Convex
   ↓
   ├─ ✅ Request reaches Convex → Continue
   └─ ❌ Network error → FAIL (CORS or wrong URL)
   ↓
Step 4: Convex checks CONVEX_SITE_URL
   ↓
   ├─ ✅ Matches origin → Continue
   └─ ❌ Mismatch → FAIL (CORS error)
   ↓
Step 5: Convex processes authentication
   ↓
   ├─ ✅ Valid credentials → Return token
   └─ ❌ Invalid → Return error
   ↓
Step 6: Browser stores auth token
   ↓
✅ User is logged in!
```

## Diagnostic Steps

### 1. Is VITE_CONVEX_URL Set?

**Test on deployed site:**
```javascript
// Open browser console (F12) on https://your-project.pages.dev
console.log(import.meta.env.VITE_CONVEX_URL);
```

**Expected result:**
```
https://resolute-kudu-325.convex.cloud
```

**If it shows `undefined`:**
```
Problem: Environment variable not set in Cloudflare Pages
Solution: Add VITE_CONVEX_URL in Cloudflare settings
```

### 2. Is Convex Backend Reachable?

**Test in browser console:**
```javascript
fetch('https://resolute-kudu-325.convex.cloud')
  .then(r => console.log('✅ Convex reachable'))
  .catch(e => console.log('❌ Convex unreachable:', e));
```

**Expected result:**
```
✅ Convex reachable
```

**If unreachable:**
```
Problem: Network issue or wrong URL
Solution: Check VITE_CONVEX_URL value
```

### 3. Is CONVEX_SITE_URL Correct?

**Test locally:**
```bash
npx convex env get CONVEX_SITE_URL
```

**Expected result:**
```
https://your-project.pages.dev
```

**If different:**
```
Problem: CORS will block auth requests
Solution: Set correct URL with:
  npx convex env set CONVEX_SITE_URL "https://your-project.pages.dev"
```

### 4. Are Convex Functions Deployed?

**Test locally:**
```bash
npx convex functions list
```

**Expected result:**
```
✅ auth:signIn
✅ auth:signOut
✅ loggedInUser
```

**If missing:**
```
Problem: Backend not deployed
Solution: Run: npx convex deploy --prod
```

## Visual Checklist

```
┌──────────────────────────────────────────────────────────────┐
│                     Pre-Deployment                            │
└──────────────────────────────────────────────────────────────┘

☐ Code is committed to git
☐ Convex functions deployed: npx convex deploy --prod
☐ CONVEX_SITE_URL is set correctly

┌──────────────────────────────────────────────────────────────┐
│                  Cloudflare Configuration                     │
└──────────────────────────────────────────────────────────────┘

☐ VITE_CONVEX_URL environment variable set
☐ Set for both Production AND Preview
☐ Value: https://resolute-kudu-325.convex.cloud
☐ Build command: npm run build
☐ Build output: dist
☐ Node version: 18+

┌──────────────────────────────────────────────────────────────┐
│                    Post-Deployment                            │
└──────────────────────────────────────────────────────────────┘

☐ Cloudflare build succeeded
☐ Site is accessible at your-project.pages.dev
☐ Browser console shows VITE_CONVEX_URL correctly
☐ No CORS errors in browser console
☐ Login/signup works
```

## Error Messages Guide

### "Failed to fetch"

```
Error in browser console:
  Failed to fetch

What it means:
  - VITE_CONVEX_URL is wrong or undefined
  - Network connectivity issue
  - Convex is down (rare)

How to fix:
  1. Check VITE_CONVEX_URL in browser console
  2. Verify it matches: https://resolute-kudu-325.convex.cloud
  3. Check Cloudflare environment variables
  4. Redeploy after adding/fixing variable
```

### "CORS policy blocked"

```
Error in browser console:
  Access to fetch at 'https://resolute-kudu-325.convex.cloud'
  from origin 'https://your-project.pages.dev' has been blocked
  by CORS policy

What it means:
  - CONVEX_SITE_URL doesn't match your Cloudflare Pages URL
  - Missing https:// protocol

How to fix:
  1. Get your exact Cloudflare Pages URL
  2. Run: npx convex env set CONVEX_SITE_URL "https://your-project.pages.dev"
  3. Include the https:// protocol
  4. Redeploy Convex: npx convex deploy --prod
```

### "Auth provider not found"

```
Error in browser console:
  Auth provider 'password' not found

What it means:
  - Convex auth configuration is wrong
  - Functions not deployed

How to fix:
  1. Check convex/auth.ts exists
  2. Run: npx convex deploy --prod
  3. Verify: npx convex functions list
```

### Environment variable is undefined

```
Error in browser console:
  import.meta.env.VITE_CONVEX_URL is undefined

What it means:
  - Environment variable not set in Cloudflare
  - Variable name is wrong (missing VITE_ prefix)
  - Need to redeploy after setting variable

How to fix:
  1. Go to Cloudflare Pages settings
  2. Add VITE_CONVEX_URL (exact name)
  3. Value: https://resolute-kudu-325.convex.cloud
  4. Save and redeploy (or git push)
```

## Quick Test Script

Run this in your deployed site's browser console:

```javascript
// Login Diagnostics Script
console.log('=== Login Diagnostics ===');

// 1. Check VITE_CONVEX_URL
const convexUrl = import.meta.env.VITE_CONVEX_URL;
if (convexUrl) {
  console.log('✅ VITE_CONVEX_URL:', convexUrl);
} else {
  console.log('❌ VITE_CONVEX_URL is undefined!');
}

// 2. Check Convex connectivity
if (convexUrl) {
  fetch(convexUrl)
    .then(r => console.log('✅ Convex is reachable'))
    .catch(e => console.log('❌ Convex unreachable:', e.message));
}

// 3. Check current origin
console.log('📍 Current origin:', window.location.origin);
console.log('   (This should match CONVEX_SITE_URL in Convex)');

console.log('=== End Diagnostics ===');
```

## The Nuclear Option (Complete Reset)

If nothing works, try this:

### 1. Clear Everything

```bash
# Locally
rm -rf node_modules package-lock.json
npm install

# Redeploy Convex
npx convex deploy --prod
```

### 2. Reset Cloudflare

1. Delete all environment variables
2. Re-add VITE_CONVEX_URL
3. Clear build cache (in settings)
4. Trigger new deployment

### 3. Verify Settings

```bash
# Check Convex
npx convex env get CONVEX_SITE_URL
npx convex functions list

# Should match your Cloudflare URL
```

### 4. Test Locally First

```bash
# Make sure it works locally
npm run dev
# Visit http://localhost:5173
# Try login/signup
```

### 5. Deploy Again

```bash
git add .
git commit -m "Reset deployment"
git push origin main
```

## Contact Info

If you've tried everything and it still doesn't work:

1. **Check Cloudflare Pages build logs** (most issues are here)
2. **Check browser console** (network tab especially)
3. **Verify Convex dashboard** (functions deployed?)
4. **Check status pages**:
   - https://status.convex.dev
   - https://cloudflarestatus.com

## Summary

Most login issues are caused by:

1. **Missing VITE_CONVEX_URL** (60% of issues)
2. **Wrong CONVEX_SITE_URL** (30% of issues)
3. **Convex not deployed** (10% of issues)

Fix these three things and login will work! 🎉
