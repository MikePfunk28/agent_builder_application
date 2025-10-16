# AWS Amplify Deployment Guide

## Prerequisites
1. AWS Account with Amplify access
2. GitHub repository connected
3. Run `setup-aws-infrastructure.ps1` first

## Step 1: Connect Repository to Amplify

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Click "New app" → "Host web app"
3. Select GitHub and authorize
4. Choose your repository: `MikePfunk28/agent_builder_application`
5. Select branch: `main`

## Step 2: Configure Build Settings

Amplify will auto-detect `amplify.yml`. Verify it shows:
- Build command: `npm run build`
- Output directory: `dist`

## Step 3: Add Environment Variables

In Amplify Console → App Settings → Environment variables, add:

```
VITE_CONVEX_URL=https://api.mikepfunk.com
CONVEX_SITE_URL=https://resolute-kudu-325.convex.site
GOOGLE_CLIENT_ID=89369419857-jmqp714gpkr10tjp2i7acioml3d3u8ko.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GITHUB_CLIENT_ID=Ov23liUe2U4dpqlFQch3
GITHUB_CLIENT_SECRET=8cd92ac09f06ac6e553535f23e30cc767d6f5dc5
LANGSMITH_API_KEY=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
AWS_REGION=us-east-1

# Add these after running setup-aws-infrastructure.ps1:
COGNITO_ISSUER_URL=<from script output>
COGNITO_CLIENT_ID=<from script output>
COGNITO_CLIENT_SECRET=<from script output>
COGNITO_USER_POOL_ID=<from script output>
```

## Step 4: Update Cognito Callback URLs

After Amplify deployment, update Cognito with your Amplify URL:

```powershell
aws cognito-idp update-user-pool-client \
  --user-pool-id <YOUR_POOL_ID> \
  --client-id <YOUR_CLIENT_ID> \
  --callback-urls "https://main.d1234567890.amplifyapp.com/auth/callback" "http://localhost:3000/auth/callback" \
  --logout-urls "https://main.d1234567890.amplifyapp.com/auth/logout" "http://localhost:3000/auth/logout"
```

## Step 5: Deploy

1. Click "Save and deploy"
2. Wait for build to complete (~5 minutes)
3. Access your app at: `https://main.d1234567890.amplifyapp.com`

## Architecture

```
User → AWS Amplify (Frontend)
       ↓
       Convex (Database + Auth)
       ↓
       AWS Fargate (Agent Testing)
       ↓
       AWS Bedrock (AI Models)
```

## Cost Estimate

- **Amplify**: $0.01 per build minute + $0.15/GB served
- **Convex**: Free tier or $25/month
- **Fargate**: Pay per second when testing agents
- **Bedrock**: Pay per API call
- **Total**: ~$5-30/month depending on usage

## Monitoring

- **Amplify Console**: Build logs and deployment status
- **Convex Dashboard**: Database and function logs
- **LangSmith**: Agent metrics and traces
- **CloudWatch**: AWS resource monitoring

## Troubleshooting

### Build fails with "Module not found"
- Check `package.json` dependencies
- Clear Amplify cache: App Settings → Clear cache

### Environment variables not working
- Ensure they start with `VITE_` for frontend access
- Redeploy after adding variables

### Cognito authentication fails
- Verify callback URLs match Amplify domain
- Check Cognito client secret is correct
