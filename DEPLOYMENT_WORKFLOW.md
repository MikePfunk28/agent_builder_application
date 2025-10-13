# Deployment Workflow - Convex + Cloudflare Pages

## Understanding Your Architecture

You have **TWO SEPARATE** systems that need to be deployed independently:

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Application                          │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
    ┌──────────────────┐    ┌──────────────────────┐
    │  Convex Backend  │    │ Cloudflare Frontend  │
    │  (Functions)     │    │  (React App)         │
    └──────────────────┘    └──────────────────────┘
           │                           │
           ▼                           ▼
    resolute-kudu-325       ai-forge.mikepfunk.com
    .convex.cloud           (or *.pages.dev)
```

## ❌ INCORRECT Build Command

**DO NOT USE THIS:**
```bash
npx convex deploy --cmd 'npm run build'
```

**Why?** This tries to combine both deployments into one, which:
- Creates confusion about which deployment you're updating
- Can create multiple Convex deployments (dev vs prod)
- Makes debugging harder

## ✅ CORRECT Deployment Process

### Two-Step Deployment

#### Step 1: Deploy Convex Backend

```bash
# From your local machine
npm run build
```

**What this does:**
- Deploys your Convex functions (auth, queries, mutations, actions)
- Deploys to: `https://resolute-kudu-325.convex.cloud`
- Does NOT build your frontend
- Does NOT deploy to Cloudflare

**When to run:**
- When you change any file in `convex/` folder
- When you add new functions
- When you modify auth configuration

#### Step 2: Deploy Frontend to Cloudflare

```bash
# Commit your changes
git add .
git commit -m "Update frontend"
git push origin main
```

**What this does:**
- Triggers Cloudflare Pages build automatically
- Runs `npm run build` on Cloudflare's servers
- Deploys to: `https://ai-forge.mikepfunk.com`
- Does NOT deploy Convex functions

**When to run:**
- When you change any frontend code (src/ folder)
- When you update UI/components
- When you modify React code

## Cloudflare Pages Configuration

### Environment Variables

Go to: **Cloudflare Dashboard > Pages > Your Project > Settings > Environment variables**

Add these variables:

```
Variable name: VITE_CONVEX_URL
Value: https://resolute-kudu-325.convex.cloud
Environment: ✓ Production ✓ Preview
```

```
Variable name: SITE_URL
Value: https://ai-forge.mikepfunk.com
Environment: ✓ Production ✓ Preview
```

### Build Settings

Go to: **Cloudflare Dashboard > Pages > Your Project > Settings > Builds & deployments**

```yaml
Framework preset: None (or Vite)
Build command: npm run build
Build output directory: dist
Root directory: /
Node version: 18
```

## Convex Configuration

### Required Environment Variables (Set via CLI)

```bash
# Set your Cloudflare Pages URL
npx convex env set CONVEX_SITE_URL "https://ai-forge.mikepfunk.com"

# Verify it's set correctly
npx convex env get CONVEX_SITE_URL
# Should show: https://ai-forge.mikepfunk.com
```

**Why?** This enables CORS so your frontend can talk to your backend.

## Complete Deployment Workflow

### When You Make Changes

```bash
# 1. Make your changes
# Edit files in src/ or convex/

# 2. Test locally
npm run dev
# Visit http://localhost:5173 and test

# 3. Deploy Convex (if you changed convex/ files)
npx convex deploy --prod

# 4. Commit and push (triggers Cloudflare build)
git add .
git commit -m "Your changes"
git push origin main

# 5. Wait for Cloudflare to build
# Check: Cloudflare Dashboard > Pages > Your Project > Deployments
```

## Troubleshooting

### "Which deployment command should I use?"

**For Convex Backend:**
```bash
npx convex deploy --prod
```

**For Frontend:**
- Just push to git: `git push origin main`
- Or manually trigger in Cloudflare Dashboard

**Never use:**
- `npx convex deploy --cmd 'npm run build'`
- `npx convex deploy` in Cloudflare build command

### "Will deploying create another link?"

No! Each command deploys to its fixed location:

- `npx convex deploy --prod` → Always deploys to `resolute-kudu-325.convex.cloud`
- Cloudflare build → Always deploys to `ai-forge.mikepfunk.com`

You won't create duplicate deployments.

### "How do I know if my deployment worked?"

**Check Convex:**
```bash
# List deployed functions
npx convex functions list

# Should show all your functions:
# - auth:signIn
# - auth:signOut
# - loggedInUser
# - generateAgent
# - etc.
```

**Check Cloudflare:**
1. Go to Cloudflare Dashboard
2. Pages > Your Project > Deployments
3. Latest deployment should be green ✓
4. Click to view build logs

**Check Frontend:**
```javascript
// Visit https://ai-forge.mikepfunk.com
// Open browser console (F12)
console.log(import.meta.env.VITE_CONVEX_URL);
// Should show: https://resolute-kudu-325.convex.cloud
```

## Your Current URLs

```
Convex Backend:      https://resolute-kudu-325.convex.cloud
Convex Dashboard:    https://dashboard.convex.dev
Frontend (Custom):   https://ai-forge.mikepfunk.com
Cloudflare Pages:    https://[your-project].pages.dev
```

## Environment Files Reference

### .env.production (Your Local File)
```bash
VITE_CONVEX_URL=https://resolute-kudu-325.convex.cloud
SITE_URL=https://ai-forge.mikepfunk.com
CONVEX_SITE_URL=https://resolute-kudu-325.convex.cloud
```

### Cloudflare Pages Environment Variables
```bash
VITE_CONVEX_URL=https://resolute-kudu-325.convex.cloud
SITE_URL=https://ai-forge.mikepfunk.com
```

### Convex Environment (via npx convex env)
```bash
CONVEX_SITE_URL=https://ai-forge.mikepfunk.com
```

## Quick Commands Cheat Sheet

```bash
# Deploy backend only
npx convex deploy --prod

# Deploy frontend only
git push origin main

# Check Convex deployment
npx convex functions list
npx convex dashboard

# Check Convex environment
npx convex env list
npx convex env get CONVEX_SITE_URL

# Test locally
npm run dev

# Build locally (to test build process)
npm run build
```

## Common Mistakes to Avoid

1. ❌ Using `npx convex deploy` in Cloudflare build command
2. ❌ Using `npx convex deploy --cmd 'npm run build'`
3. ❌ Forgetting to set VITE_CONVEX_URL in Cloudflare
4. ❌ Forgetting to set CONVEX_SITE_URL in Convex
5. ❌ Using development URL instead of production URL
6. ❌ Not redeploying after changing environment variables

## When to Deploy What

| You Changed...               | Run This...                    |
|------------------------------|--------------------------------|
| Files in `convex/`           | `npx convex deploy --prod`     |
| Files in `src/`              | `git push origin main`         |
| Both                         | Both commands (in that order)  |
| Environment variables        | Update in Cloudflare + Convex  |
| `package.json` dependencies  | Both commands                  |

## Final Checklist

Before launching to production:

- ✅ VITE_CONVEX_URL set in Cloudflare Pages
- ✅ SITE_URL set in Cloudflare Pages
- ✅ CONVEX_SITE_URL set in Convex (matches custom domain)
- ✅ Convex functions deployed: `npx convex deploy --prod`
- ✅ Cloudflare build succeeded
- ✅ Custom domain configured (ai-forge.mikepfunk.com)
- ✅ SSL certificate active
- ✅ Can login/signup on production
- ✅ No console errors in browser

## Need Help?

If login still doesn't work, check:
1. Browser console for errors
2. Network tab in DevTools
3. Cloudflare build logs
4. Convex dashboard for function errors

See `docs/LOGIN_TROUBLESHOOTING.md` for detailed debugging steps.
