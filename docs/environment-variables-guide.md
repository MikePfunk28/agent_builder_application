# Environment Variables Guide

## Required Environment Variables for Cross-Account Architecture

### Platform Environment Variables (Convex)

Add these to your Convex dashboard under Settings → Environment Variables:

```bash
# AWS Platform Account (YOUR account)
AWS_ACCOUNT_ID=123456789012  # Your AWS account ID
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...  # Your AWS access key
AWS_SECRET_ACCESS_KEY=...  # Your AWS secret key

# ECS Fargate Configuration (YOUR infrastructure)
ECS_CLUSTER_NAME=agent-builder-testing-cluster
ECS_TASK_FAMILY=agent-builder-agent-tester
ECS_SUBNET_ID=subnet-abc123
ECS_SECURITY_GROUP_ID=sg-abc123

# Convex Configuration
CONVEX_SITE_URL=https://your-deployment.convex.site
AWS_API_SECRET=generate-a-random-secret-here  # For securing HTTP actions

# Optional: Cognito (if using)
COGNITO_USER_POOL_ID=us-east-1_ABC123
COGNITO_CLIENT_ID=abc123def456
COGNITO_CLIENT_SECRET=secret123
```

### How to Get These Values

#### 1. AWS_ACCOUNT_ID
```powershell
# Run this command
aws sts get-caller-identity --query Account --output text
```

#### 2. AWS Credentials
```powershell
# Create IAM user with programmatic access
aws iam create-user --user-name agent-builder-platform

# Attach policy
aws iam attach-user-policy `
  --user-name agent-builder-platform `
  --policy-arn arn:aws:iam::aws:policy/PowerUserAccess

# Create access key
aws iam create-access-key --user-name agent-builder-platform
```

#### 3. ECS Configuration
These are output by the setup script in `.env.aws`:
```powershell
.\scripts\setup-aws-infrastructure.ps1
# Check .env.aws for these values
```

#### 4. AWS_API_SECRET
```bash
# Generate a random secret
openssl rand -base64 32
```

Or in PowerShell:
```powershell
# Generate random secret
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

### Frontend Environment Variables (.env.local)

```bash
# Convex
VITE_CONVEX_URL=https://your-deployment.convex.cloud

# Auth (Google/GitHub OAuth)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
AUTH_GITHUB_ID=your-github-client-id
AUTH_GITHUB_SECRET=your-github-client-secret

# Optional: AWS Cognito
COGNITO_ISSUER_URL=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123
COGNITO_CLIENT_ID=abc123def456
COGNITO_CLIENT_SECRET=secret123
```

## Security Best Practices

### 1. Never Commit Secrets
```bash
# Add to .gitignore
.env
.env.local
.env.aws
.env.production
aws-config-*.json
```

### 2. Use Least-Privilege IAM Policies

Instead of `PowerUserAccess`, create a custom policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sts:AssumeRole",
        "ecs:RunTask",
        "ecs:DescribeTasks",
        "ecs:StopTask",
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

### 3. Rotate Credentials Regularly

```powershell
# Create new access key
aws iam create-access-key --user-name agent-builder-platform

# Update Convex environment variables

# Delete old access key
aws iam delete-access-key `
  --user-name agent-builder-platform `
  --access-key-id OLD_KEY_ID
```

### 4. Use AWS Secrets Manager (Production)

For production, store secrets in AWS Secrets Manager:

```typescript
// In your Convex action
const AWS = await import("@aws-sdk/client-secrets-manager");
const client = new AWS.SecretsManagerClient({ region: "us-east-1" });

const command = new AWS.GetSecretValueCommand({
  SecretId: "agent-builder/production",
});

const response = await client.send(command);
const secrets = JSON.parse(response.SecretString!);
```

## Verification

### Check Convex Environment Variables

```bash
# List all environment variables
npx convex env list

# Check specific variable
npx convex env get AWS_ACCOUNT_ID
```

### Test AWS Credentials

```powershell
# Test YOUR AWS credentials
aws sts get-caller-identity

# Should show:
# {
#   "UserId": "AIDAI...",
#   "Account": "123456789012",
#   "Arn": "arn:aws:iam::123456789012:user/agent-builder-platform"
# }
```

### Test Cross-Account AssumeRole

```powershell
# Test assuming a user's role
aws sts assume-role `
  --role-arn "arn:aws:iam::USER_ACCOUNT:role/AgentBuilderCrossAccountRole" `
  --role-session-name "test" `
  --external-id "user-external-id"

# Should return temporary credentials
```

## Troubleshooting

### Error: "Credentials not found"

```bash
# Check if AWS credentials are set
echo $AWS_ACCESS_KEY_ID
echo $AWS_SECRET_ACCESS_KEY

# Or in PowerShell
$env:AWS_ACCESS_KEY_ID
$env:AWS_SECRET_ACCESS_KEY
```

**Solution**: Add credentials to Convex environment variables.

### Error: "Access Denied"

```bash
# Check IAM permissions
aws iam get-user-policy `
  --user-name agent-builder-platform `
  --policy-name agent-builder-policy
```

**Solution**: Attach required IAM policies.

### Error: "Invalid External ID"

**Solution**: Ensure the External ID in the user's CloudFormation matches the one generated by your platform.

### Error: "Cannot assume role"

```bash
# Check trust relationship
aws iam get-role --role-name AgentBuilderCrossAccountRole
```

**Solution**: Verify the trust policy includes your platform's AWS account ID.

## Environment Variable Checklist

Before deploying:

- [ ] `AWS_ACCOUNT_ID` - Your AWS account ID
- [ ] `AWS_REGION` - Your AWS region
- [ ] `AWS_ACCESS_KEY_ID` - Your AWS access key
- [ ] `AWS_SECRET_ACCESS_KEY` - Your AWS secret key
- [ ] `ECS_CLUSTER_NAME` - From setup script
- [ ] `ECS_TASK_FAMILY` - From setup script
- [ ] `ECS_SUBNET_ID` - From setup script
- [ ] `ECS_SECURITY_GROUP_ID` - From setup script
- [ ] `CONVEX_SITE_URL` - Your Convex deployment URL
- [ ] `AWS_API_SECRET` - Generated random secret
- [ ] `GOOGLE_CLIENT_ID` - Google OAuth
- [ ] `GOOGLE_CLIENT_SECRET` - Google OAuth
- [ ] `AUTH_GITHUB_ID` - GitHub OAuth
- [ ] `AUTH_GITHUB_SECRET` - GitHub OAuth

## Next Steps

1. Run setup script: `.\scripts\setup-aws-infrastructure.ps1`
2. Copy values from `.env.aws` to Convex dashboard
3. Generate `AWS_API_SECRET` and add to Convex
4. Test with: `.\scripts\verify-aws-setup.ps1`
5. Deploy Convex: `npx convex deploy --prod`

---

**Security Note**: Never share your AWS credentials or commit them to version control!
