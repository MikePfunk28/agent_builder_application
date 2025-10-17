# Complete AWS Setup Guide - 3-Tier SaaS Architecture

## 🎯 What You Have Now

A complete, production-ready AWS infrastructure supporting a **3-tier SaaS model**:

1. **Tier 1 (Freemium)**: Users test agents on YOUR infrastructure (free for them)
2. **Tier 2 (Self-Service)**: Users deploy to THEIR AWS accounts (they pay)
3. **Tier 3 (Enterprise)**: AWS SSO integration for organizations

## 📁 Files Created

### Scripts
- ✅ `scripts/setup-aws-infrastructure.ps1` - Setup YOUR platform infrastructure
- ✅ `scripts/user-aws-onboarding.ps1` - Users connect THEIR AWS accounts
- ✅ `scripts/teardown-aws-infrastructure.ps1` - Clean shutdown after hackathon

### CloudFormation
- ✅ `cloudformation/user-onboarding-template.yaml` - One-click user onboarding
- ✅ `cloudformation/README.md` - CloudFormation usage guide

### Documentation
- ✅ `docs/3-tier-architecture-guide.md` - Complete architecture explanation
- ✅ `docs/quick-start-commands.md` - Command reference
- ✅ `COMPLETE-SETUP-GUIDE.md` - This file

## 🚀 Quick Start (5 Minutes)

### Step 1: Setup Your Platform (Run Once)

```powershell
.\scripts\setup-aws-infrastructure.ps1 `
  -ProjectName "agent-builder" `
  -Region "us-east-1" `
  -ProductionDomain "https://ai-forge.mikepfunk.com" `
  -ConvexSiteUrl "https://api.mikepfunk.com"
```

**What this creates:**
- ECS Fargate cluster (Tier 1 testing)
- ECR repository (Docker images)
- S3 bucket (deployments)
- IAM roles (cross-account access)
- VPC with networking
- CloudWatch monitoring
- Cognito user pool

**Output files:**
- `.env.aws` - Copy to your `.env`
- `aws-config.json` - Use in frontend
- `deploy-to-aws.sh` - Deployment script

### Step 2: Update Your Environment

```bash
# Copy AWS configuration to your .env
cat .env.aws >> .env

# Or manually add the values from .env.aws
```

### Step 3: Test Tier 1 (Freemium)

```typescript
// In your Convex function
export const testAgent = mutation({
  handler: async (ctx, args) => {
    // Deploy to YOUR Fargate cluster
    const result = await deployToYourFargate(ctx, args.agentId);
    return result;
  },
});
```

### Step 4: Enable Tier 2 (Self-Service)

Users run this in THEIR AWS account:

```powershell
.\scripts\user-aws-onboarding.ps1 `
  -PlatformAccountId "YOUR_ACCOUNT_ID" `
  -Region "us-east-1" `
  -UserIdentifier "user@example.com"
```

Or use CloudFormation (one-click):
- Upload `cloudformation/user-onboarding-template.yaml`
- Fill in parameters
- Get Role ARN and External ID

### Step 5: Implement Cross-Account Deployment

```typescript
// In your Convex function
export const deployToUserAccount = mutation({
  handler: async (ctx, args) => {
    // Get user's AWS credentials
    const awsAccount = await getUserAWSAccount(ctx);
    
    // Assume role in their account
    const credentials = await assumeRole({
      roleArn: awsAccount.roleArn,
      externalId: awsAccount.externalId,
    });
    
    // Deploy to THEIR Fargate
    const result = await deployToFargate({
      credentials,
      agentId: args.agentId,
    });
    
    return result;
  },
});
```

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              Your Platform (Convex)                      │
│                                                          │
│  User Authentication:                                    │
│  • Google OAuth                                          │
│  • GitHub OAuth                                          │
│  • AWS Cognito (optional)                               │
│                                                          │
│  Deployment Router:                                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │ if (tier === "freemium")                         │  │
│  │   → Deploy to YOUR Fargate                       │  │
│  │                                                   │  │
│  │ else if (tier === "personal")                    │  │
│  │   → Assume role in user's account                │  │
│  │   → Deploy to THEIR Fargate                      │  │
│  │                                                   │  │
│  │ else if (tier === "enterprise")                  │  │
│  │   → Use AWS SSO credentials                      │  │
│  │   → Deploy to THEIR organization                 │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  AWS Infrastructure                      │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Your Account │  │ User Account │  │ Enterprise   │ │
│  │  (Tier 1)    │  │  (Tier 2)    │  │  (Tier 3)    │ │
│  │              │  │              │  │              │ │
│  │ • Fargate    │  │ • Fargate    │  │ • Fargate    │ │
│  │ • ECR        │  │ • ECR        │  │ • ECR        │ │
│  │ • S3         │  │ • S3         │  │ • S3         │ │
│  │              │  │              │  │              │ │
│  │ You pay      │  │ They pay     │  │ They pay     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 💰 Cost Breakdown

### Your Costs (Tier 1)
- **ECS Fargate**: $0.04/hour per test × 10 tests/user × 100 users = ~$40/month
- **Bedrock API**: $0.01 per 1K tokens × usage = ~$10-50/month
- **CloudWatch**: $0.30/month for logs
- **ECR**: $0.10/GB/month for images = ~$5/month
- **S3**: $0.023/GB/month = ~$2/month

**Total Tier 1**: ~$60-100/month for 100 free users

### User Costs (Tier 2)
- Same as above, but THEY pay
- You pay: $0

### Enterprise Costs (Tier 3)
- Same as above, but THEY pay
- You pay: $0

## 🔒 Security Features

### Tier 1 (Your Infrastructure)
- ✅ Isolated Fargate tasks per user
- ✅ Resource limits (CPU, memory, time)
- ✅ CloudWatch monitoring
- ✅ Automatic cleanup

### Tier 2 (Cross-Account)
- ✅ External ID prevents confused deputy
- ✅ Least-privilege IAM policies
- ✅ Scoped resource creation (`agent-builder-*`)
- ✅ User can revoke access anytime
- ✅ Audit trail in CloudWatch

### Tier 3 (Enterprise SSO)
- ✅ AWS SSO integration
- ✅ Organization-level policies
- ✅ Centralized access management
- ✅ Compliance controls

## 📊 Monitoring & Alerts

### Cost Monitoring
```powershell
# Already set up by the script
aws cloudwatch describe-alarms --alarm-names "agent-builder-cost-alarm"
```

Alert triggers when estimated charges exceed $50/month.

### Usage Monitoring
```typescript
// Track user usage in Convex
export const trackUsage = mutation({
  handler: async (ctx, args) => {
    await ctx.db.insert("usage", {
      userId: args.userId,
      tier: args.tier,
      action: "agent_test",
      cost: 0.04, // Fargate cost
      timestamp: Date.now(),
    });
  },
});
```

### Resource Monitoring
- CloudWatch Logs: `/ecs/agent-builder-agent-tester`
- ECS Task metrics: CPU, memory, network
- Bedrock API metrics: Invocations, errors, latency

## 🧹 Cleanup After Hackathon

### Preview What Will Be Deleted
```powershell
.\scripts\teardown-aws-infrastructure.ps1 `
  -ProjectName "agent-builder" `
  -Region "us-east-1" `
  -DryRun
```

### Actually Delete Everything
```powershell
.\scripts\teardown-aws-infrastructure.ps1 `
  -ProjectName "agent-builder" `
  -Region "us-east-1" `
  -Force
```

**What gets deleted:**
- ✅ All ECS clusters and tasks
- ✅ All ECR repositories
- ✅ All S3 buckets (emptied first)
- ✅ All CloudWatch logs and alarms
- ✅ All Secrets Manager secrets
- ✅ All VPC resources
- ✅ All IAM roles and policies
- ✅ All Cognito user pools

**What's safe:**
- ✅ Your other AWS resources (unaffected)
- ✅ User AWS accounts (they keep their resources)
- ✅ Your Convex database (separate service)

## 🎓 Implementation Checklist

### Phase 1: Platform Setup (30 minutes)
- [ ] Run `setup-aws-infrastructure.ps1`
- [ ] Copy `.env.aws` to `.env`
- [ ] Update Convex environment variables
- [ ] Test Tier 1 deployment locally

### Phase 2: Tier 1 Implementation (2 hours)
- [ ] Implement `deployToYourFargate()` function
- [ ] Add usage tracking
- [ ] Set up rate limiting (10 tests/month)
- [ ] Add "Upgrade" call-to-action
- [ ] Test with real users

### Phase 3: Tier 2 Implementation (4 hours)
- [ ] Create user onboarding flow
- [ ] Implement `assumeRole()` function
- [ ] Implement `deployToUserAccount()` function
- [ ] Add AWS account validation
- [ ] Test cross-account deployment
- [ ] Create user documentation

### Phase 4: Tier 3 Implementation (Optional, 6 hours)
- [ ] Set up AWS SSO integration
- [ ] Implement SSO authentication
- [ ] Add organization management
- [ ] Implement team features
- [ ] Test with enterprise account

### Phase 5: Polish (2 hours)
- [ ] Add error handling
- [ ] Improve user feedback
- [ ] Add deployment status tracking
- [ ] Create admin dashboard
- [ ] Write user documentation

## 🐛 Troubleshooting

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

### Cross-Account Deployment Fails
```typescript
// Add detailed error logging
try {
  const credentials = await assumeRole({
    roleArn: awsAccount.roleArn,
    externalId: awsAccount.externalId,
  });
} catch (error) {
  console.error("AssumeRole failed:", error);
  // Check:
  // 1. Role ARN is correct
  // 2. External ID matches
  // 3. Trust policy is correct
  // 4. IAM propagation completed (wait 60s)
}
```

### Fargate Task Fails
```powershell
# Check task logs
aws logs tail /ecs/agent-builder-agent-tester --follow

# Describe task
aws ecs describe-tasks --cluster agent-builder-testing-cluster --tasks TASK_ID

# Common issues:
# - Image not found in ECR
# - Insufficient memory/CPU
# - Network configuration error
# - IAM permissions missing
```

## 📚 Additional Resources

### Documentation
- [3-Tier Architecture Guide](docs/3-tier-architecture-guide.md)
- [Quick Start Commands](docs/quick-start-commands.md)
- [CloudFormation Guide](cloudformation/README.md)

### AWS Documentation
- [ECS Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html)
- [Cross-Account Access](https://docs.aws.amazon.com/IAM/latest/UserGuide/tutorial_cross-account-with-roles.html)
- [Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html)

### Cost Calculators
- [AWS Pricing Calculator](https://calculator.aws/)
- [Fargate Pricing](https://aws.amazon.com/fargate/pricing/)
- [Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/)

## 🎉 You're Ready!

You now have:
1. ✅ Complete AWS infrastructure
2. ✅ 3-tier SaaS architecture
3. ✅ User onboarding scripts
4. ✅ Teardown script for cleanup
5. ✅ Comprehensive documentation

**Next Steps:**
1. Run the setup script
2. Implement Tier 1 (freemium)
3. Test with real users
4. Add Tier 2 (self-service)
5. Launch your platform! 🚀

**Questions?** Check the documentation or AWS support.

**Good luck with your hackathon!** 🎊
