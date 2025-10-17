# Cloudflare Pages Deployment (FREE Alternative)

## Why Cloudflare Pages?
- ✅ **FREE** unlimited bandwidth
- ✅ **FREE** unlimited builds
- ✅ **FREE** SSL certificates
- ✅ **Faster** global CDN
- ✅ **Simpler** setup than Amplify

## Cost Comparison
| Service | Amplify | Cloudflare Pages |
|---------|---------|------------------|
| Hosting | $5-15/month | **FREE** |
| Builds | $0.01/min | **FREE** |
| Bandwidth | $0.15/GB | **FREE** |
| SSL | Included | **FREE** |

## Deployment Steps

### 1. Connect GitHub to Cloudflare

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Pages → Create a project
3. Connect to Git → Select GitHub
4. Choose repository: `MikePfunk28/agent_builder_application`
5. Select branch: `main`

### 2. Configure Build Settings

```yaml
Build command: npm run build
Build output directory: dist
Root directory: (leave empty)
```

### 3. Add Environment Variables

In Cloudflare Pages → Settings → Environment variables:

```
VITE_CONVEX_URL=https://api.mikepfunk.com
CONVEX_SITE_URL=https://resolute-kudu-325.convex.site
GOOGLE_CLIENT_ID=89369419857-jmqp714gpkr10tjp2i7acioml3d3u8ko.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GITHUB_CLIENT_ID=Ov23liUe2U4dpqlFQch3
GITHUB_CLIENT_SECRET=8cd92ac09f06ac6e553535f23e30cc767d6f5dc5
LANGSMITH_API_KEY=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
AWS_REGION=us-east-1
```

### 4. Update Cognito Callback URLs

After deployment, update Cognito with your Cloudflare Pages URL:

```powershell
aws cognito-idp update-user-pool-client \
  --user-pool-id <YOUR_POOL_ID> \
  --client-id <YOUR_CLIENT_ID> \
  --callback-urls "https://agent-builder.pages.dev/auth/callback" "http://localhost:3000/auth/callback" \
  --logout-urls "https://agent-builder.pages.dev/auth/logout" "http://localhost:3000/auth/logout"
```

### 5. Custom Domain (Optional)

1. Cloudflare Pages → Custom domains
2. Add your domain (e.g., `app.mikepfunk.com`)
3. Cloudflare automatically handles SSL

## Architecture (Same as Amplify)

```
User → Cloudflare Pages (Frontend) - FREE
       ↓
       Convex (Database + Auth) - FREE tier
       ↓
       AWS Fargate (Agent Testing) - Pay per use
       ↓
       AWS Bedrock (AI Models) - Pay per call
```

## Total Cost Breakdown

### Hackathon Usage (Light):
- **Cloudflare Pages**: $0
- **Convex Free Tier**: $0 (1M function calls/month)
- **Fargate**: ~$2-5 (testing only)
- **Bedrock**: ~$5-10 (API calls)
- **Total**: **$7-15/month**

### Production Usage (Heavy):
- **Cloudflare Pages**: $0
- **Convex Pro**: $25/month
- **Fargate**: ~$10-20 (more testing)
- **Bedrock**: ~$20-50 (more API calls)
- **Total**: **$55-95/month**

## Advantages Over Amplify

1. **Cost**: FREE vs $5-15/month
2. **Speed**: Faster global CDN
3. **Simplicity**: Easier setup
4. **Bandwidth**: Unlimited vs metered
5. **Builds**: Unlimited vs metered

## Deployment

```bash
# Automatic on git push
git add .
git commit -m "Deploy to Cloudflare Pages"
git push origin main
```

Cloudflare automatically builds and deploys in ~2 minutes!

## Monitoring

- **Cloudflare Analytics**: FREE traffic analytics
- **Convex Dashboard**: Database and function logs
- **LangSmith**: Agent metrics
- **CloudWatch**: AWS resource monitoring

## Recommendation

**Use Cloudflare Pages for hackathon** - it's FREE and faster than Amplify!
