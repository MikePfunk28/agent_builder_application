# Quick Deploy Reference

## Your Deployment URLs

```
Backend:  https://resolute-kudu-325.convex.cloud
Frontend: https://ai-forge.mikepfunk.com
```

## The Answer to Your Question

### ❌ WRONG Build Command
```
npx convex deploy --cmd 'npm run build'
```
**Why?** This combines two separate deployments. Don't use it!

### ✅ CORRECT Build Command (for Cloudflare)
```
npm run build
```
**Set this in:** Cloudflare Dashboard > Pages > Settings > Builds & deployments

### ✅ CORRECT Convex Deploy (run locally)
```bash
npx convex deploy --prod
```
**This deploys backend only.** Run from your local machine, NOT in Cloudflare.

## Won't This Create Another Link?

**No!** Each deployment goes to a fixed URL:

- `npx convex deploy --prod` → Always `resolute-kudu-325.convex.cloud`
- Cloudflare Pages build → Always `ai-forge.mikepfunk.com`

You have **ONE** Convex deployment and **ONE** Cloudflare deployment.

## Two-Step Deploy Process

```bash
# Step 1: Deploy backend (local)
npx convex deploy --prod

# Step 2: Deploy frontend (triggers automatically)
git push origin main
```

## Cloudflare Settings

### Environment Variables
```
VITE_CONVEX_URL = https://resolute-kudu-325.convex.cloud
SITE_URL = https://ai-forge.mikepfunk.com
```
Set for: ✓ Production ✓ Preview

### Build Settings
```
Build command: npm run build
Output directory: dist
```

## Convex Settings (run locally)

```bash
npx convex env set CONVEX_SITE_URL "https://ai-forge.mikepfunk.com"
```

## Verify It Works

```javascript
// On https://ai-forge.mikepfunk.com, open console (F12):
console.log(import.meta.env.VITE_CONVEX_URL);
// Should show: https://resolute-kudu-325.convex.cloud
```

## Common Mistakes

1. ❌ Using `npx convex deploy --cmd 'npm run build'`
2. ❌ Using `npx convex deploy` as Cloudflare build command
3. ❌ Forgetting to set environment variables in Cloudflare
4. ❌ Using old URL: `unique-kookabura-922.convex.app`

## Full Documentation

- Complete workflow: `DEPLOYMENT_WORKFLOW.md`
- Login issues: `docs/LOGIN_TROUBLESHOOTING.md`
- Cloudflare setup: `CLOUDFLARE_SETUP.md`
