# Quick Start Commands

## Setup (Run Once)

### 1. Setup Your Platform Infrastructure
```powershell
# Creates Tier 1 infrastructure in YOUR AWS account
.\scripts\setup-aws-infrastructure.ps1 `
  -ProjectName "agent-builder" `
  -Region "us-east-1" `
  -ProductionDomain "https://ai-forge.mikepfunk.com" `
  -ConvexSiteUrl "https://api.mikepfunk.com"
```

**Creates:**
- ECS Fargate cluster (for free tier testing)
- ECR repository (for Docker images)
- S3 bucket (for deployments)
- IAM roles (for cross-account access)
- VPC with networking
- CloudWatch monitoring
- Cognito user pool (optional)

**Output Files:**
- `.env.aws` - Environment variables
- `aws-config.json` - Frontend configuration
- `deploy-to-aws.sh` - Deployment script
- `aws-config-[timestamp].json` - Full backup

---

## User Onboarding (Tier 2)

### 2. User Connects Their AWS Account
```powershell
# User runs this in THEIR AWS account
.\scripts\user-aws-onboarding.ps1 `
  -PlatformAccountId "YOUR_ACCOUNT_ID" `
  -Region "us-east-1" `
  -UserIdentifier "user@example.com"
```

**Creates in User's Account:**
- Cross-account IAM role
- ECS Fargate cluster
- VPC (if needed)
- Security groups

**User Gets:**
- Role ARN (to paste in your platform)
- External ID (for security)
- Configuration file

---

## Teardown (After Hackathon)

### 3. Clean Up Everything
```powershell
# Preview what will be deleted (safe)
.\scripts\teardown-aws-infrastructure.ps1 `
  -ProjectName "agent-builder" `
  -Region "us-east-1" `
  -DryRun

# Actually delete everything (requires confirmation)
.\scripts\teardown-aws-infrastructure.ps1 `
  -ProjectName "agent-builder" `
  -Region "us-east-1"

# Force delete without confirmation
.\scripts\teardown-aws-infrastructure.ps1 `
  -ProjectName "agent-builder" `
  -Region "us-east-1" `
  -Force
```

**Deletes:**
- ✅ ECS clusters and tasks
- ✅ ECR repositories
- ✅ S3 buckets (emptied first)
- ✅ CloudWatch logs and alarms
- ✅ Secrets Manager secrets
- ✅ VPC resources
- ✅ IAM roles and policies
- ✅ Cognito user pools

**Safe:** Only deletes resources with project name tag. Other AWS resources unaffected.

---

## Common Scenarios

### Test Setup Without Creating Resources
```powershell
.\scripts\setup-aws-infrastructure.ps1 -DryRun
```

### Setup in Different Region
```powershell
.\scripts\setup-aws-infrastructure.ps1 `
  -Region "us-west-2" `
  -ProjectName "agent-builder"
```

### Skip Cognito Setup
```powershell
.\scripts\setup-aws-infrastructure.ps1 `
  -SkipCognito `
  -ProjectName "agent-builder"
```

### User Onboarding with Custom Region
```powershell
.\scripts\user-aws-onboarding.ps1 `
  -PlatformAccountId "123456789012" `
  -Region "eu-west-1" `
  -UserIdentifier "user@example.com"
```

### Teardown with Config File
```powershell
.\scripts\teardown-aws-infrastructure.ps1 `
  -ProjectName "agent-builder" `
  -ConfigFile "aws-config-20250116.json"
```

---

## Environment Variables

After running setup, add these to your `.env`:

```bash
# From .env.aws file
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012
AWS_S3_BUCKET=agent-builder-deployments-12345678
ECR_REPOSITORY_URI=123456789012.dkr.ecr.us-east-1.amazonaws.com/agent-builder-agents-12345678

# Cognito
COGNITO_USER_POOL_ID=us-east-1_ABC123
COGNITO_CLIENT_ID=abc123def456
COGNITO_CLIENT_SECRET=secret123
COGNITO_DOMAIN=agent-builder-auth-12345678.auth.us-east-1.amazoncognito.com

# ECS Fargate
ECS_CLUSTER_NAME=agent-builder-testing-cluster
ECS_TASK_FAMILY=agent-builder-agent-tester
ECS_SUBNET_ID=subnet-abc123
ECS_SECURITY_GROUP_ID=sg-abc123

# IAM
AGENTCORE_IAM_ROLE_ARN=arn:aws:iam::123456789012:role/agent-builder-agentcore-role-12345678
```

---

## Verification Commands

### Check AWS CLI Configuration
```powershell
aws sts get-caller-identity
```

### List ECS Clusters
```powershell
aws ecs list-clusters --region us-east-1
```

### List ECR Repositories
```powershell
aws ecr describe-repositories --region us-east-1
```

### List S3 Buckets
```powershell
aws s3 ls | Select-String "agent-builder"
```

### Check Cognito User Pools
```powershell
aws cognito-idp list-user-pools --max-results 10 --region us-east-1
```

### View CloudWatch Logs
```powershell
aws logs describe-log-groups --region us-east-1 | Select-String "agent-builder"
```

---

## Troubleshooting

### Setup Script Fails
```powershell
# Check AWS credentials
aws sts get-caller-identity

# Check region support
aws bedrock list-foundation-models --region us-east-1

# Run with verbose output
$VerbosePreference = "Continue"
.\scripts\setup-aws-infrastructure.ps1
```

### User Onboarding Fails
```powershell
# Verify user is in their own account
aws sts get-caller-identity

# Check IAM permissions
aws iam get-user

# Test role assumption
aws sts assume-role `
  --role-arn "arn:aws:iam::PLATFORM_ACCOUNT:role/test" `
  --role-session-name "test" `
  --external-id "user@example.com"
```

### Teardown Fails
```powershell
# Run dry-run to see what's blocking
.\scripts\teardown-aws-infrastructure.ps1 -DryRun

# Check for dependencies
aws ecs list-tasks --cluster agent-builder-testing-cluster

# Force delete stuck resources manually
aws ecs delete-cluster --cluster agent-builder-testing-cluster --force
```

---

## Cost Monitoring

### Set Up Billing Alerts
```powershell
# Already created by setup script
aws cloudwatch describe-alarms --alarm-names "agent-builder-cost-alarm"
```

### Check Current Costs
```powershell
# View estimated charges
aws cloudwatch get-metric-statistics `
  --namespace AWS/Billing `
  --metric-name EstimatedCharges `
  --dimensions Name=Currency,Value=USD `
  --start-time (Get-Date).AddDays(-7) `
  --end-time (Get-Date) `
  --period 86400 `
  --statistics Maximum
```

### Tag Resources for Cost Tracking
All resources are automatically tagged with:
- `Project: agent-builder`
- `ManagedBy: setup-script`
- `Environment: production`

---

## Security Best Practices

### Rotate Secrets
```powershell
# Update Cognito client secret
aws cognito-idp update-user-pool-client `
  --user-pool-id us-east-1_ABC123 `
  --client-id abc123def456 `
  --generate-secret

# Update Secrets Manager
aws secretsmanager update-secret `
  --secret-id agent-builder/production `
  --secret-string '{"newSecret":"value"}'
```

### Review IAM Permissions
```powershell
# List role policies
aws iam list-attached-role-policies `
  --role-name agent-builder-agentcore-role-12345678

# Get policy document
aws iam get-policy-version `
  --policy-arn "arn:aws:iam::123456789012:policy/agent-builder-policy" `
  --version-id v1
```

### Audit Cross-Account Access
```powershell
# List all roles that can be assumed
aws iam list-roles | Select-String "AgentBuilderCrossAccountRole"

# Check trust relationships
aws iam get-role --role-name AgentBuilderCrossAccountRole-12345678
```

---

## Support

- **AWS Documentation**: https://docs.aws.amazon.com/
- **Bedrock Regions**: https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html
- **ECS Fargate Pricing**: https://aws.amazon.com/fargate/pricing/
- **Cost Calculator**: https://calculator.aws/

---

## Quick Reference

| Task | Command |
|------|---------|
| Setup platform | `.\scripts\setup-aws-infrastructure.ps1` |
| User onboarding | `.\scripts\user-aws-onboarding.ps1 -PlatformAccountId "123"` |
| Teardown | `.\scripts\teardown-aws-infrastructure.ps1 -Force` |
| Dry run | Add `-DryRun` to any script |
| Check identity | `aws sts get-caller-identity` |
| List clusters | `aws ecs list-clusters` |
| View logs | `aws logs tail /ecs/agent-builder-agent-tester --follow` |
