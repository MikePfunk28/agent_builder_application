# Cross-Account Setup Checklist

## ✅ Complete Implementation Checklist for Tier 2

### Phase 1: AWS Infrastructure Setup (30 minutes)

- [ ] **1.1 Run Setup Script**
  ```powershell
  .\scripts\setup-aws-infrastructure.ps1 `
    -ProjectName "agent-builder" `
    -ProductionDomain "https://ai-forge.mikepfunk.com" `
    -ConvexSiteUrl "https://api.mikepfunk.com"
  ```

- [ ] **1.2 Verify Setup**
  ```powershell
  .\scripts\verify-aws-setup.ps1
  ```

- [ ] **1.3 Get Your AWS Account ID**
  ```powershell
  aws sts get-caller-identity --query Account --output text
  ```
  Save this - users will need it!

- [ ] **1.4 Create IAM User for Platform**
  ```powershell
  aws iam create-user --user-name agent-builder-platform
  aws iam create-access-key --user-name agent-builder-platform
  ```
  Save the Access Key ID and Secret Access Key

### Phase 2: Convex Backend Setup (1 hour)

- [ ] **2.1 Install AWS SDK**
  ```bash
  npm install @aws-sdk/client-sts @aws-sdk/client-ecs
  ```

- [ ] **2.2 Add Environment Variables to Convex**
  
  Go to Convex Dashboard → Settings → Environment Variables:
  
  ```bash
  AWS_ACCOUNT_ID=123456789012  # From step 1.3
  AWS_REGION=us-east-1
  AWS_ACCESS_KEY_ID=AKIA...  # From step 1.4
  AWS_SECRET_ACCESS_KEY=...  # From step 1.4
  ECS_CLUSTER_NAME=agent-builder-testing-cluster  # From .env.aws
  ECS_TASK_FAMILY=agent-builder-agent-tester  # From .env.aws
  ECS_SUBNET_ID=subnet-abc123  # From .env.aws
  ECS_SECURITY_GROUP_ID=sg-abc123  # From .env.aws
  CONVEX_SITE_URL=https://your-deployment.convex.site
  AWS_API_SECRET=<generate-random-32-char-string>
  ```

- [ ] **2.3 Generate AWS_API_SECRET**
  ```powershell
  # PowerShell
  -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
  ```

- [ ] **2.4 Deploy Convex Backend**
  ```bash
  npx convex deploy --prod
  ```

- [ ] **2.5 Verify Convex Functions**
  ```bash
  npx convex function list
  ```
  Should see:
  - `userAWSAccounts:generateExternalId`
  - `userAWSAccounts:connectAWSAccount`
  - `awsCrossAccount:assumeUserRole`
  - `deploymentRouter:deployAgent`

### Phase 3: Frontend Integration (2 hours)

- [ ] **3.1 Create AWS Connection UI Component**
  
  Create `src/components/AWSAccountConnection.tsx`:
  ```typescript
  import { useMutation, useQuery } from "convex/react";
  import { api } from "../../convex/_generated/api";
  
  export function AWSAccountConnection() {
    const generateExternalId = useMutation(api.userAWSAccounts.generateExternalId);
    const connectAccount = useMutation(api.userAWSAccounts.connectAWSAccount);
    const awsAccount = useQuery(api.userAWSAccounts.getUserAWSAccount);
    
    // Implementation here
  }
  ```

- [ ] **3.2 Add "Connect AWS Account" Button**
  
  In your settings page or deployment panel

- [ ] **3.3 Display CloudFormation URL**
  
  Show users the one-click CloudFormation link

- [ ] **3.4 Add Role ARN Input Form**
  
  Let users paste their Role ARN and External ID

- [ ] **3.5 Show Connection Status**
  
  Display whether AWS account is connected

### Phase 4: Testing (1 hour)

- [ ] **4.1 Test Tier 1 (Freemium)**
  ```typescript
  // Should deploy to YOUR Fargate
  await deployAgent({ agentId: "..." });
  ```

- [ ] **4.2 Test External ID Generation**
  ```typescript
  const result = await generateExternalId();
  console.log(result.externalId);
  console.log(result.platformAccountId);
  console.log(result.cloudFormationUrl);
  ```

- [ ] **4.3 Test User Onboarding Flow**
  
  1. User clicks "Connect My AWS Account"
  2. Platform generates External ID
  3. User runs CloudFormation template
  4. User pastes Role ARN back
  5. Platform validates role
  6. User upgraded to Tier 2

- [ ] **4.4 Test Cross-Account Deployment**
  ```typescript
  // Should deploy to USER's Fargate
  await deployAgent({ agentId: "..." });
  ```

- [ ] **4.5 Test Role Validation**
  ```typescript
  const isValid = await validateRole({
    roleArn: "arn:aws:iam::USER_ACCOUNT:role/...",
    externalId: "agent-builder-..."
  });
  ```

### Phase 5: User Documentation (30 minutes)

- [ ] **5.1 Create User Guide**
  
  Document the onboarding process for users

- [ ] **5.2 Add Troubleshooting Section**
  
  Common errors and solutions

- [ ] **5.3 Create Video Tutorial** (Optional)
  
  Screen recording of the onboarding process

- [ ] **5.4 Add FAQ**
  
  Answer common questions about AWS costs, security, etc.

### Phase 6: Monitoring & Alerts (30 minutes)

- [ ] **6.1 Set Up CloudWatch Alarms**
  
  Already done by setup script

- [ ] **6.2 Add Deployment Tracking**
  
  Log all deployments to database

- [ ] **6.3 Add Error Tracking**
  
  Monitor failed deployments

- [ ] **6.4 Add Usage Analytics**
  
  Track Tier 1 vs Tier 2 usage

## 🔍 Verification Steps

### Verify AWS Infrastructure

```powershell
.\scripts\verify-aws-setup.ps1 -Detailed
```

Should show:
- ✅ AWS credentials configured
- ✅ ECR repository exists
- ✅ S3 bucket exists
- ✅ IAM roles configured
- ✅ VPC and networking ready
- ✅ ECS cluster ready

### Verify Convex Backend

```bash
# Test External ID generation
npx convex run userAWSAccounts:generateExternalId

# Should return:
# {
#   externalId: "agent-builder-...",
#   platformAccountId: "123456789012",
#   cloudFormationUrl: "https://console.aws.amazon.com/..."
# }
```

### Verify Cross-Account Role

```powershell
# Test assuming a role
aws sts assume-role `
  --role-arn "arn:aws:iam::USER_ACCOUNT:role/AgentBuilderCrossAccountRole" `
  --role-session-name "test" `
  --external-id "agent-builder-..."
```

Should return temporary credentials.

## 🐛 Common Issues

### Issue: "Cannot assume role"

**Cause**: Trust policy doesn't include your platform account ID

**Solution**:
```powershell
# Check trust policy
aws iam get-role --role-name AgentBuilderCrossAccountRole

# Should include:
# "Principal": {
#   "AWS": "arn:aws:iam::YOUR_PLATFORM_ACCOUNT:root"
# }
```

### Issue: "Invalid External ID"

**Cause**: External ID mismatch

**Solution**: Ensure the External ID in CloudFormation matches the one generated by your platform.

### Issue: "Access Denied"

**Cause**: Missing IAM permissions

**Solution**: Attach required policies to your platform IAM user.

### Issue: "Task failed to start"

**Cause**: VPC/networking misconfiguration

**Solution**: Verify subnet and security group IDs are correct.

## 📊 Success Metrics

After implementation, you should see:

- [ ] Users can generate External IDs
- [ ] Users can deploy CloudFormation template
- [ ] Users can connect their AWS account
- [ ] Platform can assume user roles
- [ ] Deployments work in user accounts
- [ ] Tier 1 users see upgrade prompts
- [ ] Tier 2 users deploy to their AWS
- [ ] All deployments are logged
- [ ] Costs are tracked per tier

## 🎯 What You Have Now

### Backend Functions ✅
- `userAWSAccounts.ts` - External ID generation, account connection
- `awsCrossAccount.ts` - STS AssumeRole, cross-account deployment
- `awsHttpActions.ts` - AWS SDK HTTP actions
- `deploymentRouter.ts` - Tier routing logic
- `tier1Deployment.ts` - Freemium deployment
- `deployments.ts` - Deployment tracking

### Database Schema ✅
- `userAWSAccounts` table - Store user AWS credentials
- `deployments` table - Track all deployments
- `users` table - User profiles with tier info

### Scripts ✅
- `setup-aws-infrastructure.ps1` - Setup YOUR infrastructure
- `user-aws-onboarding.ps1` - Users setup THEIR infrastructure
- `verify-aws-setup.ps1` - Verify everything works
- `teardown-aws-infrastructure.ps1` - Clean shutdown

### CloudFormation ✅
- `user-onboarding-template.yaml` - One-click user setup

### Documentation ✅
- Environment variables guide
- Architecture diagrams
- Quick start commands
- Complete setup guide

## 🚀 Next Steps

1. **Complete Phase 1-2** (Infrastructure + Backend)
2. **Build Frontend UI** (Phase 3)
3. **Test End-to-End** (Phase 4)
4. **Write User Docs** (Phase 5)
5. **Launch!** 🎉

## 📞 Support

- Check `docs/environment-variables-guide.md` for env var help
- Check `docs/quick-start-commands.md` for command reference
- Run `.\scripts\verify-aws-setup.ps1` for diagnostics

---

**You're ready to implement cross-account deployment!** 🎊

Start with Phase 1 and work through the checklist systematically.
