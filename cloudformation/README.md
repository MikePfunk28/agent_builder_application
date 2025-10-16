# CloudFormation User Onboarding

This CloudFormation template provides a **one-click setup** for Tier 2 users who want to connect their AWS account to the Agent Builder Platform.

## What It Creates

- ✅ VPC with public subnet
- ✅ Internet Gateway and routing
- ✅ Security Group for agents
- ✅ ECS Fargate cluster
- ✅ CloudWatch log group
- ✅ Cross-account IAM role with least-privilege permissions
- ✅ Fargate task execution role

## Prerequisites

- AWS Account
- AWS Console access or AWS CLI
- Platform Account ID (provided by Agent Builder Platform)

## Option 1: AWS Console (Easiest)

### Step 1: Launch Stack

Click this button to launch the stack in your AWS account:

[![Launch Stack](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home#/stacks/create/review?templateURL=https://your-bucket.s3.amazonaws.com/user-onboarding-template.yaml)

Or manually:
1. Go to [AWS CloudFormation Console](https://console.aws.amazon.com/cloudformation)
2. Click **Create Stack** → **With new resources**
3. Choose **Upload a template file**
4. Upload `user-onboarding-template.yaml`
5. Click **Next**

### Step 2: Configure Parameters

Fill in the parameters:

| Parameter | Description | Example |
|-----------|-------------|---------|
| **PlatformAccountId** | AWS Account ID of Agent Builder Platform | `123456789012` |
| **UserIdentifier** | Your email or unique ID | `user@example.com` |
| **ProjectName** | Project name for tagging | `agent-builder` |

### Step 3: Review and Create

1. Review the configuration
2. Check the box: **I acknowledge that AWS CloudFormation might create IAM resources**
3. Click **Create Stack**
4. Wait 2-3 minutes for completion

### Step 4: Get Outputs

1. Go to the **Outputs** tab
2. Copy these values:
   - **RoleArn**: `arn:aws:iam::YOUR_ACCOUNT:role/agent-builder-cross-account-role`
   - **ExternalId**: `user@example.com`
   - **Region**: `us-east-1`

### Step 5: Connect to Platform

1. Go to Agent Builder Platform
2. Click **Settings** → **Connect My AWS Account**
3. Paste the **RoleArn** and **ExternalId**
4. Click **Connect**
5. Start deploying agents! 🚀

---

## Option 2: AWS CLI

### Step 1: Download Template

```bash
# Download the template
curl -O https://raw.githubusercontent.com/your-repo/cloudformation/user-onboarding-template.yaml
```

### Step 2: Create Stack

```bash
aws cloudformation create-stack \
  --stack-name agent-builder-onboarding \
  --template-body file://user-onboarding-template.yaml \
  --parameters \
    ParameterKey=PlatformAccountId,ParameterValue=123456789012 \
    ParameterKey=UserIdentifier,ParameterValue=user@example.com \
    ParameterKey=ProjectName,ParameterValue=agent-builder \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```

### Step 3: Wait for Completion

```bash
aws cloudformation wait stack-create-complete \
  --stack-name agent-builder-onboarding \
  --region us-east-1
```

### Step 4: Get Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name agent-builder-onboarding \
  --region us-east-1 \
  --query 'Stacks[0].Outputs'
```

Example output:
```json
[
  {
    "OutputKey": "RoleArn",
    "OutputValue": "arn:aws:iam::987654321098:role/agent-builder-cross-account-role"
  },
  {
    "OutputKey": "ExternalId",
    "OutputValue": "user@example.com"
  },
  {
    "OutputKey": "Region",
    "OutputValue": "us-east-1"
  }
]
```

---

## Option 3: PowerShell Script (Alternative)

If you prefer PowerShell over CloudFormation:

```powershell
.\scripts\user-aws-onboarding.ps1 `
  -PlatformAccountId "123456789012" `
  -Region "us-east-1" `
  -UserIdentifier "user@example.com"
```

---

## Verification

### Check Stack Status
```bash
aws cloudformation describe-stacks \
  --stack-name agent-builder-onboarding \
  --query 'Stacks[0].StackStatus'
```

### List Created Resources
```bash
aws cloudformation list-stack-resources \
  --stack-name agent-builder-onboarding
```

### Test Role Assumption
```bash
aws sts assume-role \
  --role-arn "arn:aws:iam::YOUR_ACCOUNT:role/agent-builder-cross-account-role" \
  --role-session-name "test-session" \
  --external-id "user@example.com"
```

---

## Cost Estimate

### One-Time Setup
- **CloudFormation**: Free
- **VPC**: Free (within free tier)
- **IAM Roles**: Free

### Ongoing Costs (When Deploying Agents)
- **ECS Fargate**: ~$0.04/hour per agent
- **CloudWatch Logs**: ~$0.50/GB ingested
- **Data Transfer**: ~$0.09/GB outbound

**Estimated Monthly Cost**: $5-20 for light usage

---

## Security

### What Permissions Does the Platform Get?

The cross-account role has **least-privilege** permissions:

✅ **Can Do:**
- Create and run ECS tasks
- Push Docker images to ECR
- Write CloudWatch logs
- Create resources with `agent-builder-*` prefix

❌ **Cannot Do:**
- Access your S3 buckets
- Modify existing resources
- Create IAM users
- Access other AWS services
- Delete resources outside agent deployment

### External ID Protection

The **External ID** prevents the [confused deputy problem](https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html):
- Only requests with your External ID can assume the role
- Platform cannot access your account without it
- You can change it anytime by updating the trust policy

### Revoke Access Anytime

To revoke platform access:

```bash
# Delete the stack
aws cloudformation delete-stack \
  --stack-name agent-builder-onboarding

# Or just delete the role
aws iam delete-role \
  --role-name agent-builder-cross-account-role
```

---

## Troubleshooting

### Stack Creation Failed

**Error**: `User is not authorized to perform: iam:CreateRole`

**Solution**: Your AWS user needs IAM permissions. Add the `IAMFullAccess` policy or ask your admin.

---

**Error**: `Parameter validation failed: Invalid length for parameter PlatformAccountId`

**Solution**: Platform Account ID must be exactly 12 digits. Check the value.

---

**Error**: `Role with name agent-builder-cross-account-role already exists`

**Solution**: Delete the existing role or use a different ProjectName parameter.

---

### Role Assumption Failed

**Error**: `User is not authorized to perform: sts:AssumeRole`

**Solution**: 
1. Verify the External ID matches
2. Check the Platform Account ID is correct
3. Wait a few minutes for IAM propagation

---

### Agent Deployment Failed

**Error**: `No space left on device`

**Solution**: Increase Fargate task memory in the task definition.

---

**Error**: `CannotPullContainerError`

**Solution**: 
1. Verify ECR repository exists
2. Check Fargate execution role has ECR permissions
3. Ensure Docker image was pushed successfully

---

## Updates

### Update Stack Parameters

```bash
aws cloudformation update-stack \
  --stack-name agent-builder-onboarding \
  --use-previous-template \
  --parameters \
    ParameterKey=PlatformAccountId,UsePreviousValue=true \
    ParameterKey=UserIdentifier,ParameterValue=newemail@example.com \
    ParameterKey=ProjectName,UsePreviousValue=true \
  --capabilities CAPABILITY_NAMED_IAM
```

### Update Template

```bash
aws cloudformation update-stack \
  --stack-name agent-builder-onboarding \
  --template-body file://user-onboarding-template.yaml \
  --parameters \
    ParameterKey=PlatformAccountId,UsePreviousValue=true \
    ParameterKey=UserIdentifier,UsePreviousValue=true \
    ParameterKey=ProjectName,UsePreviousValue=true \
  --capabilities CAPABILITY_NAMED_IAM
```

---

## Cleanup

### Delete Everything

```bash
# Delete the CloudFormation stack
aws cloudformation delete-stack \
  --stack-name agent-builder-onboarding

# Wait for deletion
aws cloudformation wait stack-delete-complete \
  --stack-name agent-builder-onboarding
```

This removes:
- ✅ Cross-account IAM role
- ✅ Deployment policy
- ✅ ECS cluster
- ✅ VPC and networking
- ✅ Security groups
- ✅ CloudWatch log groups

---

## Support

- **AWS CloudFormation Docs**: https://docs.aws.amazon.com/cloudformation/
- **IAM Cross-Account Access**: https://docs.aws.amazon.com/IAM/latest/UserGuide/tutorial_cross-account-with-roles.html
- **ECS Fargate**: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html

---

## Comparison: CloudFormation vs PowerShell Script

| Feature | CloudFormation | PowerShell Script |
|---------|----------------|-------------------|
| **Ease of Use** | ⭐⭐⭐⭐⭐ One-click | ⭐⭐⭐⭐ Requires AWS CLI |
| **Rollback** | ✅ Automatic | ❌ Manual cleanup |
| **Updates** | ✅ Easy | ⚠️ Re-run script |
| **Visibility** | ✅ AWS Console | ⚠️ Terminal output |
| **Customization** | ⚠️ Template editing | ✅ Script parameters |
| **Speed** | ~3 minutes | ~2 minutes |

**Recommendation**: Use CloudFormation for production, PowerShell for testing.
