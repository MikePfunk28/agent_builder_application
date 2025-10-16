# 🚀 Simple Setup Guide (3 Steps)

## Step 1: Push CloudFormation Template to GitHub (2 minutes)

```bash
# Add and commit the template
git add cloudformation/user-onboarding-template.yaml
git commit -m "Add CloudFormation template"
git push
```

Then:

1. Go to your GitHub repo
2. Navigate to `cloudformation/user-onboarding-template.yaml`
3. Click the **"Raw"** button
4. Copy the URL (looks like this):
   ```
   https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/cloudformation/user-onboarding-template.yaml
   ```

## Step 2: Add Environment Variables to Convex (5 minutes)

Go to [Convex Dashboard](https://dashboard.convex.dev) → Your Project → Settings → Environment Variables

Add these:

```bash
# Your GitHub raw URL from Step 1
CLOUDFORMATION_TEMPLATE_URL=https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/cloudformation/user-onboarding-template.yaml

# Get your AWS Account ID
AWS_ACCOUNT_ID=<run: aws sts get-caller-identity --query Account --output text>

# AWS credentials (create IAM user with programmatic access)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# From setup script output (if you ran it)
ECS_CLUSTER_NAME=agent-builder-testing-cluster
ECS_TASK_FAMILY=agent-builder-agent-tester
ECS_SUBNET_ID=subnet-...
ECS_SECURITY_GROUP_ID=sg-...

# Your Convex deployment URL
CONVEX_SITE_URL=https://your-deployment.convex.site

# Generate a random secret (32 characters)
AWS_API_SECRET=<random-32-char-string>
```

**Generate AWS_API_SECRET:**

```powershell
# PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

## Step 3: Install Dependencies & Deploy (2 minutes)

```bash
# Install AWS SDK
npm install @aws-sdk/client-sts @aws-sdk/client-ecs

# Deploy to Convex
npx convex deploy --prod
```

---

## ✅ That's It!

Test it works:

```bash
npx convex run userAWSAccounts:generateExternalId
```

Should return:

```json
{
  "externalId": "agent-builder-...",
  "platformAccountId": "123456789012",
  "cloudFormationUrl": "https://console.aws.amazon.com/cloudformation/..."
}
```

---

## 🆘 Don't Have GitHub?

**Alternative: Use S3**

```powershell
# Upload to S3
aws s3 cp cloudformation/user-onboarding-template.yaml `
  s3://YOUR-BUCKET/user-onboarding-template.yaml `
  --acl public-read

# Add to Convex env vars:
CLOUDFORMATION_TEMPLATE_URL=https://YOUR-BUCKET.s3.amazonaws.com/user-onboarding-template.yaml
```

---

## 📋 Quick Checklist

```
[ ] Push cloudformation template to GitHub
[ ] Copy raw GitHub URL
[ ] Add CLOUDFORMATION_TEMPLATE_URL to Convex
[ ] Add AWS credentials to Convex
[ ] Generate and add AWS_API_SECRET
[ ] Install AWS SDK: npm install @aws-sdk/client-sts @aws-sdk/client-ecs
[ ] Deploy: npx convex deploy --prod
[ ] Test: npx convex run userAWSAccounts:generateExternalId
```

**Total Time: ~10 minutes** ⏱️
