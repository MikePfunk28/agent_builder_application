# 3-Tier SaaS Architecture Guide

## Overview

This platform implements a sophisticated 3-tier SaaS model that allows users to build and deploy AI agents with flexible deployment options:

- **Tier 1 (Freemium)**: Test agents on platform infrastructure
- **Tier 2 (Self-Service)**: Deploy to personal AWS accounts
- **Tier 3 (Enterprise)**: AWS SSO integration for organizations

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Platform (Convex)                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐ │
│  │   Google   │  │   GitHub   │  │      AWS Cognito       │ │
│  │   OAuth    │  │   OAuth    │  │    (Optional SSO)      │ │
│  └─────┬──────┘  └─────┬──────┘  └──────────┬─────────────┘ │
│        │               │                     │                │
│        └───────────────┴─────────────────────┘                │
│                        │                                      │
│              ┌─────────▼──────────┐                          │
│              │   User Session     │                          │
│              │   (Convex Auth)    │                          │
│              └─────────┬──────────┘                          │
│                        │                                      │
│         ┌──────────────┼──────────────┐                      │
│         │              │              │                      │
│    ┌────▼────┐   ┌────▼────┐   ┌────▼────┐                 │
│    │ Tier 1  │   │ Tier 2  │   │ Tier 3  │                 │
│    │Freemium │   │Personal │   │Enterprise│                │
│    └────┬────┘   └────┬────┘   └────┬────┘                 │
└─────────┼─────────────┼─────────────┼──────────────────────┘
          │             │             │
          │             │             │
┌─────────▼─────────────▼─────────────▼──────────────────────┐
│                    AWS Infrastructure                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Your Fargate │  │ User Fargate │  │ Enterprise AWS   │  │
│  │  (Tier 1)    │  │  (Tier 2)    │  │ Organization     │  │
│  │              │  │              │  │  (Tier 3)        │  │
│  │ You pay      │  │ They pay     │  │ They pay         │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Tier 1: Freemium (No AWS Account)

### User Experience
1. User signs up with Google/GitHub OAuth
2. Builds agent in the platform
3. Clicks "Test Agent"
4. Agent runs on **your** AWS Fargate cluster
5. Limited to 10 tests/month (configurable)
6. See results in real-time

### Implementation
```typescript
// convex/agentTesting.ts
export const testAgent = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");
    
    // Check tier and limits
    const userProfile = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", user.subject))
      .first();
    
    if (userProfile?.tier === "freemium") {
      // Check usage limits
      const testsThisMonth = await getTestCount(ctx, user.subject);
      if (testsThisMonth >= 10) {
        throw new Error("Free tier limit reached. Upgrade to continue.");
      }
    }
    
    // Deploy to YOUR Fargate
    const result = await deployToYourFargate(ctx, args.agentId);
    return result;
  },
});
```

### Cost Control
- Set hard limits on test duration (5 minutes max)
- Automatic cleanup after tests
- Monitor costs with CloudWatch alarms
- Rate limiting per user

### Setup
```powershell
# Run the main setup script
.\scripts\setup-aws-infrastructure.ps1 `
  -ProjectName "agent-builder" `
  -Region "us-east-1" `
  -ProductionDomain "https://ai-forge.mikepfunk.com" `
  -ConvexSiteUrl "https://api.mikepfunk.com"
```

This creates:
- ✅ ECS Fargate cluster (for Tier 1 testing)
- ✅ ECR repository (for agent images)
- ✅ S3 bucket (for agent artifacts)
- ✅ IAM roles (for cross-account access)
- ✅ VPC with public subnet
- ✅ CloudWatch monitoring

---

## Tier 2: Personal AWS Account (Self-Service)

### User Experience
1. User clicks "Connect My AWS Account"
2. Downloads/runs CloudFormation template OR PowerShell script
3. Copies Role ARN and External ID
4. Pastes into platform settings
5. Platform validates connection
6. User can now deploy to **their** AWS account
7. They pay their own AWS costs

### Implementation

#### Step 1: User Runs Onboarding Script
```powershell
# User runs this in THEIR AWS account
.\scripts\user-aws-onboarding.ps1 `
  -PlatformAccountId "123456789012" `  # Your AWS account ID
  -Region "us-east-1" `
  -UserIdentifier "user-email@example.com"
```

This creates in **their** account:
- Cross-account IAM role
- ECS Fargate cluster
- VPC (if needed)
- Security groups
- Permissions for agent deployment

#### Step 2: Platform Stores Credentials
```typescript
// convex/userAWS.ts
export const connectAWSAccount = mutation({
  args: {
    roleArn: v.string(),
    externalId: v.string(),
    region: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");
    
    // Validate the role by attempting to assume it
    const isValid = await validateCrossAccountRole(
      args.roleArn,
      args.externalId
    );
    
    if (!isValid) {
      throw new Error("Invalid role or external ID");
    }
    
    // Store in database
    await ctx.db.insert("userAWSAccounts", {
      userId: user.subject,
      roleArn: args.roleArn,
      externalId: args.externalId,
      region: args.region,
      tier: "personal",
      createdAt: Date.now(),
    });
    
    // Upgrade user tier
    await ctx.db.patch(userProfile._id, { tier: "personal" });
    
    return { success: true };
  },
});
```

#### Step 3: Deploy to User's Account
```typescript
// convex/crossAccountDeployment.ts
export const deployToUserAccount = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");
    
    // Get user's AWS credentials
    const awsAccount = await ctx.db
      .query("userAWSAccounts")
      .withIndex("by_user_id", (q) => q.eq("userId", user.subject))
      .first();
    
    if (!awsAccount) {
      throw new Error("No AWS account connected");
    }
    
    // Assume role in user's account
    const credentials = await assumeRole({
      roleArn: awsAccount.roleArn,
      externalId: awsAccount.externalId,
      sessionName: `agent-deployment-${Date.now()}`,
    });
    
    // Deploy using their credentials
    const result = await deployToFargate({
      credentials,
      region: awsAccount.region,
      agentId: args.agentId,
    });
    
    return result;
  },
});
```

### Security Features
- **External ID**: Prevents confused deputy problem
- **Least Privilege**: Role only has permissions for agent deployment
- **Scoped Resources**: Can only create resources with `agent-builder-*` prefix
- **Audit Trail**: All actions logged in CloudWatch
- **Revocable**: User can delete role anytime

---

## Tier 3: Enterprise AWS SSO (Enterprise)

### User Experience
1. Enterprise admin configures AWS SSO integration
2. Employees sign in with corporate AWS SSO
3. Automatic AWS permissions based on SSO role
4. Deploy to organization's AWS accounts
5. Team management and compliance features
6. Centralized billing and cost allocation

### Implementation

#### Step 1: Enterprise Setup
```typescript
// convex/enterpriseSSO.ts
export const configureEnterpriseSSO = mutation({
  args: {
    ssoStartUrl: v.string(),
    ssoRegion: v.string(),
    accountId: v.string(),
    roleName: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");
    
    // Verify user is admin
    const userProfile = await getUserProfile(ctx, user.subject);
    if (userProfile?.role !== "admin") {
      throw new Error("Admin access required");
    }
    
    // Store SSO configuration
    await ctx.db.insert("enterpriseSSO", {
      organizationId: userProfile.organizationId,
      ssoStartUrl: args.ssoStartUrl,
      ssoRegion: args.ssoRegion,
      accountId: args.accountId,
      roleName: args.roleName,
      createdAt: Date.now(),
    });
    
    return { success: true };
  },
});
```

#### Step 2: SSO Authentication Flow
```typescript
// convex/auth.config.ts
export default {
  providers: [
    Google,
    GitHub,
    {
      id: "aws-sso",
      type: "oauth",
      domain: process.env.AWS_SSO_DOMAIN,
      authorization: {
        url: process.env.AWS_SSO_START_URL,
        params: {
          scope: "openid profile email",
        },
      },
      token: {
        url: `${process.env.AWS_SSO_START_URL}/token`,
      },
      userinfo: {
        url: `${process.env.AWS_SSO_START_URL}/userinfo`,
      },
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          tier: "enterprise",
        };
      },
    },
  ],
};
```

#### Step 3: Deploy with SSO Credentials
```typescript
// convex/enterpriseDeployment.ts
export const deployWithSSO = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");
    
    // Get SSO configuration
    const userProfile = await getUserProfile(ctx, user.subject);
    const ssoConfig = await ctx.db
      .query("enterpriseSSO")
      .withIndex("by_org", (q) => 
        q.eq("organizationId", userProfile.organizationId)
      )
      .first();
    
    if (!ssoConfig) {
      throw new Error("Enterprise SSO not configured");
    }
    
    // Get SSO credentials
    const credentials = await getSSOCredentials({
      accountId: ssoConfig.accountId,
      roleName: ssoConfig.roleName,
      ssoToken: user.ssoToken, // From SSO login
    });
    
    // Deploy to enterprise account
    const result = await deployToFargate({
      credentials,
      region: ssoConfig.ssoRegion,
      agentId: args.agentId,
    });
    
    return result;
  },
});
```

### Enterprise Features
- **Team Management**: Multiple users per organization
- **Role-Based Access**: Admin, Developer, Viewer roles
- **Cost Allocation**: Tag resources by team/project
- **Compliance**: Audit logs, data residency controls
- **Support**: Priority support, SLA guarantees

---

## User Flow Decision Tree

```typescript
// convex/deploymentRouter.ts
export const deployAgent = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");
    
    const userProfile = await getUserProfile(ctx, user.subject);
    
    // Route based on tier
    switch (userProfile?.tier) {
      case "freemium":
        // Tier 1: Deploy to platform infrastructure
        return await deployToYourFargate(ctx, args.agentId);
      
      case "personal":
        // Tier 2: Deploy to user's AWS account
        return await deployToUserAccount(ctx, args.agentId);
      
      case "enterprise":
        // Tier 3: Deploy with SSO credentials
        return await deployWithSSO(ctx, args.agentId);
      
      default:
        throw new Error("Invalid user tier");
    }
  },
});
```

---

## Cost Breakdown

### Tier 1 (Your Costs)
- **ECS Fargate**: ~$0.04/hour per test
- **Bedrock API**: ~$0.01 per 1K tokens
- **CloudWatch**: ~$0.30/month for logs
- **ECR**: ~$0.10/GB/month for images

**Estimated**: $5-20/month for 100 free tier users

### Tier 2 (User Pays)
- User pays their own AWS costs
- Same pricing as Tier 1
- You pay $0

### Tier 3 (Enterprise Pays)
- Enterprise pays their own AWS costs
- Volume discounts available
- You pay $0

---

## Teardown After Hackathon

When you're done, clean up everything:

```powershell
# Dry run first (see what would be deleted)
.\scripts\teardown-aws-infrastructure.ps1 `
  -ProjectName "agent-builder" `
  -Region "us-east-1" `
  -DryRun

# Actually delete everything
.\scripts\teardown-aws-infrastructure.ps1 `
  -ProjectName "agent-builder" `
  -Region "us-east-1" `
  -Force
```

This deletes:
- ✅ All ECS clusters and tasks
- ✅ All ECR repositories
- ✅ All S3 buckets (emptied first)
- ✅ All CloudWatch logs and alarms
- ✅ All Secrets Manager secrets
- ✅ All VPC resources (subnets, IGW, security groups)
- ✅ All IAM roles and policies
- ✅ All Cognito user pools

**Important**: Only deletes resources with `agent-builder` in the name. Your other AWS resources are safe!

---

## Next Steps

1. **Run Setup Script**: Create your platform infrastructure
2. **Implement Tier 1**: Get freemium working first
3. **Add Tier 2**: Implement cross-account deployment
4. **Test Thoroughly**: Verify all tiers work correctly
5. **Add Tier 3**: Enterprise SSO (optional for hackathon)
6. **Monitor Costs**: Set up billing alerts
7. **Launch**: Start onboarding users!

---

## Support

For issues or questions:
- Check AWS CloudWatch logs
- Review IAM permissions
- Verify cross-account trust relationships
- Test with dry-run mode first
