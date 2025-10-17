# ⚡ Action Items - Quick Checklist

## 🔴 **CRITICAL** (Must Do Before Testing)

### 1. Upload CloudFormation Template (5 minutes)
**File**: `cloudformation/user-onboarding-template.yaml`

**Option A - GitHub** (Easiest):
```bash
# Push to GitHub, then update userAWSAccounts.ts line 172:
const templateUrl = encodeURIComponent(
  `https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/cloudformation/user-onboarding-template.yaml`
);
```

**Option B - S3** (Recommended):
```powershell
# Upload to S3
aws s3 cp cloudformation/user-onboarding-template.yaml `
  s3://YOUR-BUCKET/user-onboarding-template.yaml `
  --acl public-read

# Update userAWSAccounts.ts line 172:
const templateUrl = encodeURIComponent(
  `https://YOUR-BUCKET.s3.amazonaws.com/user-onboarding-template.yaml`
);
```

### 2. Install AWS SDK Dependencies (1 minute)
```bash
npm install @aws-sdk/client-sts @aws-sdk/client-ecs
```

### 3. Verify Agents Query (2 minutes)
**Check**: `convex/agents.ts` has this query:
```typescript
export const get = query({
  args: { id: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
```

If missing, add it.

---

## 🟡 **IMPORTANT** (Before Deployment)

### 4. Add Environment Variables to Convex (10 minutes)
Go to Convex Dashboard → Settings → Environment Variables:

```bash
AWS_ACCOUNT_ID=<from: aws sts get-caller-identity>
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<from: .env.aws>
AWS_SECRET_ACCESS_KEY=<from: .env.aws>
ECS_CLUSTER_NAME=<from: .env.aws>
ECS_TASK_FAMILY=<from: .env.aws>
ECS_SUBNET_ID=<from: .env.aws>
ECS_SECURITY_GROUP_ID=<from: .env.aws>
CONVEX_SITE_URL=https://your-deployment.convex.site
AWS_API_SECRET=<generate random 32-char string>
```

**Generate AWS_API_SECRET**:
```powershell
# PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

### 5. Deploy Convex Backend (2 minutes)
```bash
npx convex deploy --prod
```

---

## 🟢 **TESTING** (Verify Everything Works)

### 6. Test External ID Generation (1 minute)
```bash
npx convex run userAWSAccounts:generateExternalId
```

**Expected**: Returns External ID and CloudFormation URL

### 7. Test CloudFormation URL (2 minutes)
- Click the CloudFormation URL from step 6
- Verify it opens AWS Console with pre-filled parameters
- Verify template loads correctly

### 8. Test Role Validation (3 minutes)
```bash
# After user deploys CloudFormation stack
npx convex run awsCrossAccount:validateRole \
  --roleArn "arn:aws:iam::USER_ACCOUNT:role/agent-builder-cross-account-role" \
  --externalId "agent-builder-..."
```

**Expected**: Returns `{ "valid": true }`

---

## 🔵 **FRONTEND** (Build User Interface)

### 9. Create AWS Connection Component (30 minutes)
**File**: `src/components/AWSAccountConnection.tsx`

```typescript
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";

export function AWSAccountConnection() {
  const [roleArn, setRoleArn] = useState("");
  const [externalId, setExternalId] = useState("");
  const [region, setRegion] = useState("us-east-1");
  
  const generateExternalId = useMutation(api.userAWSAccounts.generateExternalId);
  const connectAccount = useMutation(api.userAWSAccounts.connectAWSAccount);
  const awsAccount = useQuery(api.userAWSAccounts.getUserAWSAccount);
  
  const handleGenerate = async () => {
    const result = await generateExternalId();
    setExternalId(result.externalId);
    window.open(result.cloudFormationUrl, '_blank');
  };
  
  const handleConnect = async () => {
    await connectAccount({
      roleArn,
      externalId,
      region,
      awsAccountId: roleArn.split(":")[4],
    });
  };
  
  if (awsAccount) {
    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded">
        <h3 className="text-lg font-bold">✅ AWS Account Connected</h3>
        <p>Account: {awsAccount.awsAccountId}</p>
        <p>Region: {awsAccount.region}</p>
      </div>
    );
  }
  
  return (
    <div className="p-4 border rounded">
      <h3 className="text-lg font-bold mb-4">Connect Your AWS Account</h3>
      
      <button 
        onClick={handleGenerate}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        1. Generate External ID & Open CloudFormation
      </button>
      
      {externalId && (
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              External ID (auto-generated)
            </label>
            <input
              type="text"
              value={externalId}
              readOnly
              className="w-full px-3 py-2 border rounded bg-gray-50"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              Role ARN (from CloudFormation outputs)
            </label>
            <input
              type="text"
              placeholder="arn:aws:iam::123456789012:role/agent-builder-cross-account-role"
              value={roleArn}
              onChange={(e) => setRoleArn(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              AWS Region
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="us-east-1">US East (N. Virginia)</option>
              <option value="us-west-2">US West (Oregon)</option>
              <option value="eu-west-1">EU (Ireland)</option>
              <option value="ap-southeast-2">Asia Pacific (Sydney)</option>
            </select>
          </div>
          
          <button
            onClick={handleConnect}
            disabled={!roleArn}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
          >
            2. Connect AWS Account
          </button>
        </div>
      )}
    </div>
  );
}
```

### 10. Add Deployment UI with Tier Indicator (20 minutes)
**File**: `src/components/DeploymentButton.tsx`

```typescript
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function DeploymentButton({ agentId }: { agentId: string }) {
  const deployAgent = useMutation(api.deploymentRouter.deployAgent);
  const userTier = useQuery(api.deploymentRouter.getUserTier);
  const [deploying, setDeploying] = useState(false);
  
  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const result = await deployAgent({ agentId });
      
      if (result.success) {
        alert(`✅ ${result.message}`);
      } else {
        alert(`❌ ${result.error || result.message}`);
      }
    } finally {
      setDeploying(false);
    }
  };
  
  return (
    <div>
      <div className="mb-2 text-sm">
        {userTier?.tier === "freemium" && (
          <span className="text-orange-600">
            🆓 Free Tier: {userTier.testsThisMonth || 0}/10 tests used this month
          </span>
        )}
        {userTier?.tier === "personal" && (
          <span className="text-green-600">
            ✅ Personal Tier: Unlimited deployments to your AWS
          </span>
        )}
        {userTier?.tier === "enterprise" && (
          <span className="text-blue-600">
            🏢 Enterprise Tier: Unlimited deployments
          </span>
        )}
      </div>
      
      <button
        onClick={handleDeploy}
        disabled={deploying}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
      >
        {deploying ? "Deploying..." : "Deploy Agent"}
      </button>
    </div>
  );
}
```

---

## 📋 **QUICK CHECKLIST**

Copy this to track your progress:

```
[ ] 1. Upload CloudFormation template to S3/GitHub
[ ] 2. Update userAWSAccounts.ts with template URL
[ ] 3. Install AWS SDK dependencies
[ ] 4. Verify agents.get query exists
[ ] 5. Add environment variables to Convex
[ ] 6. Deploy Convex backend
[ ] 7. Test External ID generation
[ ] 8. Test CloudFormation URL
[ ] 9. Test role validation
[ ] 10. Create AWS connection component
[ ] 11. Add deployment UI
[ ] 12. Test end-to-end flow
```

---

## ⏱️ **TIME ESTIMATE**

- **Critical Items (1-3)**: 10 minutes
- **Important Items (4-5)**: 15 minutes
- **Testing (6-8)**: 10 minutes
- **Frontend (9-10)**: 50 minutes

**Total**: ~1.5 hours to fully functional cross-account deployment system!

---

## 🆘 **TROUBLESHOOTING**

### "Cannot find module '@aws-sdk/client-sts'"
```bash
npm install @aws-sdk/client-sts @aws-sdk/client-ecs
```

### "Template URL returns 404"
- Verify S3 bucket is public
- Or use GitHub raw URL instead

### "Cannot assume role"
- Check trust policy includes your AWS account ID
- Verify External ID matches

### "Access Denied"
- Check IAM permissions for platform user
- Verify AWS credentials in Convex env vars

---

**Start with items 1-3, then deploy and test! 🚀**
