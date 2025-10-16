# AWS Infrastructure Verification Script
# Verifies all AWS resources are properly configured for the 3-tier architecture

param(
    [string]$Region = "us-east-1",
    [string]$ProjectName = "agent-builder",
    [switch]$Detailed
)

Write-Host "🔍 Verifying AWS Infrastructure Setup" -ForegroundColor Green
Write-Host "Region: $Region" -ForegroundColor Yellow
Write-Host "Project: $ProjectName" -ForegroundColor Yellow
Write-Host ""

$errors = @()
$warnings = @()
$info = @()

# 1. Check AWS CLI and credentials
Write-Host "📋 Checking AWS Setup..." -ForegroundColor Cyan
try {
    $identity = aws sts get-caller-identity --output json | ConvertFrom-Json
    Write-Host "  ✅ AWS Identity: $($identity.Arn)" -ForegroundColor Green
    Write-Host "  ✅ Account ID: $($identity.Account)" -ForegroundColor Green
} catch {
    $errors += "AWS CLI not configured or no permissions"
    Write-Host "  ❌ AWS CLI not configured" -ForegroundColor Red
}

# 2. Check Cognito User Pool
Write-Host "`n👤 Checking Cognito User Pool..." -ForegroundColor Cyan
try {
    $userPools = aws cognito-idp list-user-pools --max-items 50 --region $Region --output json 2>$null | ConvertFrom-Json
    $agentPool = $userPools.UserPools | Where-Object { $_.Name -like "*$ProjectName*" }
    
    if ($agentPool) {
        Write-Host "  ✅ User Pool: $($agentPool.Name)" -ForegroundColor Green
        Write-Host "  ✅ Pool ID: $($agentPool.Id)" -ForegroundColor Green
        
        # Check clients
        $clients = aws cognito-idp list-user-pool-clients --user-pool-id $agentPool.Id --region $Region --output json 2>$null | ConvertFrom-Json
        if ($clients.UserPoolClients.Count -gt 0) {
            Write-Host "  ✅ User Pool Clients: $($clients.UserPoolClients.Count)" -ForegroundColor Green
        } else {
            $warnings += "No User Pool Clients configured"
        }
    } else {
        $warnings += "Cognito User Pool not found (optional for Tier 1)"
        Write-Host "  ⚠️  User Pool not found (optional)" -ForegroundColor Yellow
    }
} catch {
    $warnings += "Cannot access Cognito (may not have permissions)"
    Write-Host "  ⚠️  Cannot access Cognito" -ForegroundColor Yellow
}

# 3. Check ECR Repository
Write-Host "`n📦 Checking ECR Repository..." -ForegroundColor Cyan
try {
    $repositories = aws ecr describe-repositories --region $Region --output json 2>$null | ConvertFrom-Json
    $agentRepo = $repositories.repositories | Where-Object { $_.repositoryName -like "*$ProjectName*" }
    
    if ($agentRepo) {
        Write-Host "  ✅ Repository: $($agentRepo.repositoryName)" -ForegroundColor Green
        Write-Host "  ✅ URI: $($agentRepo.repositoryUri)" -ForegroundColor Green
        
        # Check for images
        $images = aws ecr list-images --repository-name $agentRepo.repositoryName --region $Region --output json 2>$null | ConvertFrom-Json
        if ($images.imageIds.Count -gt 0) {
            Write-Host "  ✅ Images: $($images.imageIds.Count)" -ForegroundColor Green
        } else {
            $info += "No Docker images pushed yet"
            Write-Host "  ℹ️  No images yet" -ForegroundColor Blue
        }
    } else {
        $errors += "ECR Repository not found"
        Write-Host "  ❌ Repository not found" -ForegroundColor Red
    }
} catch {
    $errors += "Cannot access ECR"
    Write-Host "  ❌ Cannot access ECR" -ForegroundColor Red
}

# 4. Check S3 Bucket
Write-Host "`n🪣 Checking S3 Bucket..." -ForegroundColor Cyan
try {
    $buckets = aws s3api list-buckets --output json 2>$null | ConvertFrom-Json
    $agentBucket = $buckets.Buckets | Where-Object { $_.Name -like "*$ProjectName*" }
    
    if ($agentBucket) {
        Write-Host "  ✅ Bucket: $($agentBucket.Name)" -ForegroundColor Green
        
        # Check versioning
        $versioning = aws s3api get-bucket-versioning --bucket $agentBucket.Name --output json 2>$null | ConvertFrom-Json
        if ($versioning.Status -eq "Enabled") {
            Write-Host "  ✅ Versioning: Enabled" -ForegroundColor Green
        } else {
            $warnings += "Bucket versioning not enabled"
        }
        
        # Check encryption
        try {
            $encryption = aws s3api get-bucket-encryption --bucket $agentBucket.Name --output json 2>$null | ConvertFrom-Json
            Write-Host "  ✅ Encryption: Enabled" -ForegroundColor Green
        } catch {
            $warnings += "Bucket encryption not enabled"
        }
    } else {
        $errors += "S3 Bucket not found"
        Write-Host "  ❌ Bucket not found" -ForegroundColor Red
    }
} catch {
    $errors += "Cannot access S3"
    Write-Host "  ❌ Cannot access S3" -ForegroundColor Red
}

# 5. Check IAM Roles
Write-Host "`n🔐 Checking IAM Roles..." -ForegroundColor Cyan
try {
    $roles = aws iam list-roles --output json 2>$null | ConvertFrom-Json
    $agentRoles = $roles.Roles | Where-Object { $_.RoleName -like "*$ProjectName*" }
    
    if ($agentRoles.Count -gt 0) {
        Write-Host "  ✅ Found $($agentRoles.Count) role(s)" -ForegroundColor Green
        foreach ($role in $agentRoles) {
            Write-Host "    • $($role.RoleName)" -ForegroundColor Gray
            
            if ($Detailed) {
                # Check attached policies
                $policies = aws iam list-attached-role-policies --role-name $role.RoleName --output json 2>$null | ConvertFrom-Json
                Write-Host "      Policies: $($policies.AttachedPolicies.Count)" -ForegroundColor Gray
            }
        }
    } else {
        $errors += "No IAM Roles found"
        Write-Host "  ❌ No roles found" -ForegroundColor Red
    }
} catch {
    $errors += "Cannot access IAM"
    Write-Host "  ❌ Cannot access IAM" -ForegroundColor Red
}

# 6. Check VPC Resources
Write-Host "`n🌐 Checking VPC Resources..." -ForegroundColor Cyan
try {
    $vpcs = aws ec2 describe-vpcs --filters "Name=tag:Name,Values=*$ProjectName*" --region $Region --output json 2>$null | ConvertFrom-Json
    
    if ($vpcs.Vpcs.Count -gt 0) {
        $vpc = $vpcs.Vpcs[0]
        Write-Host "  ✅ VPC: $($vpc.VpcId)" -ForegroundColor Green
        
        # Check subnets
        $subnets = aws ec2 describe-subnets --filters "Name=vpc-id,Values=$($vpc.VpcId)" --region $Region --output json 2>$null | ConvertFrom-Json
        Write-Host "  ✅ Subnets: $($subnets.Subnets.Count)" -ForegroundColor Green
        
        # Check security groups
        $sgs = aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$($vpc.VpcId)" --region $Region --output json 2>$null | ConvertFrom-Json
        Write-Host "  ✅ Security Groups: $($sgs.SecurityGroups.Count)" -ForegroundColor Green
    } else {
        $warnings += "VPC not found (will use default VPC)"
        Write-Host "  ⚠️  VPC not found (will use default)" -ForegroundColor Yellow
    }
} catch {
    $warnings += "Cannot check VPC resources"
    Write-Host "  ⚠️  Cannot check VPC" -ForegroundColor Yellow
}

# 7. Check ECS Cluster
Write-Host "`n🚀 Checking ECS Cluster..." -ForegroundColor Cyan
try {
    $clusters = aws ecs list-clusters --region $Region --output json 2>$null | ConvertFrom-Json
    $agentCluster = $clusters.clusterArns | Where-Object { $_ -like "*$ProjectName*" }
    
    if ($agentCluster) {
        $clusterName = $agentCluster.Split('/')[-1]
        Write-Host "  ✅ Cluster: $clusterName" -ForegroundColor Green
        
        # Check running tasks
        $tasks = aws ecs list-tasks --cluster $clusterName --region $Region --output json 2>$null | ConvertFrom-Json
        if ($tasks.taskArns.Count -gt 0) {
            Write-Host "  ✅ Running tasks: $($tasks.taskArns.Count)" -ForegroundColor Green
        } else {
            Write-Host "  ℹ️  No running tasks" -ForegroundColor Blue
        }
    } else {
        $info += "ECS Cluster not found (created on first deployment)"
        Write-Host "  ℹ️  Cluster not found (created on first use)" -ForegroundColor Blue
    }
} catch {
    $info += "ECS not accessible"
    Write-Host "  ℹ️  ECS not accessible" -ForegroundColor Blue
}

# 8. Check Bedrock Access
Write-Host "`n🤖 Checking Bedrock Model Access..." -ForegroundColor Cyan
try {
    $models = aws bedrock list-foundation-models --region $Region --output json 2>$null | ConvertFrom-Json
    $claudeModels = $models.modelSummaries | Where-Object { $_.modelId -like "*claude*" }
    
    if ($claudeModels.Count -gt 0) {
        Write-Host "  ✅ Claude models: $($claudeModels.Count)" -ForegroundColor Green
    } else {
        $warnings += "No Claude models found - request access in Bedrock console"
        Write-Host "  ⚠️  No Claude models (request access)" -ForegroundColor Yellow
    }
} catch {
    $warnings += "Cannot access Bedrock - check permissions"
    Write-Host "  ⚠️  Cannot access Bedrock" -ForegroundColor Yellow
}

# 9. Check CloudWatch Logs
Write-Host "`n📊 Checking CloudWatch Logs..." -ForegroundColor Cyan
try {
    $logGroups = aws logs describe-log-groups --region $Region --output json 2>$null | ConvertFrom-Json
    $agentLogs = $logGroups.logGroups | Where-Object { $_.logGroupName -like "*$ProjectName*" -or $_.logGroupName -like "/ecs/$ProjectName*" }
    
    if ($agentLogs.Count -gt 0) {
        Write-Host "  ✅ Log groups: $($agentLogs.Count)" -ForegroundColor Green
    } else {
        $info += "No log groups yet (created on first deployment)"
        Write-Host "  ℹ️  No log groups yet" -ForegroundColor Blue
    }
} catch {
    $info += "Cannot check CloudWatch logs"
}

# 10. Check Configuration Files
Write-Host "`n📁 Checking Configuration Files..." -ForegroundColor Cyan
if (Test-Path ".env.aws") {
    Write-Host "  ✅ .env.aws found" -ForegroundColor Green
} else {
    $warnings += ".env.aws not found - run setup script"
    Write-Host "  ⚠️  .env.aws not found" -ForegroundColor Yellow
}

if (Test-Path "aws-config.json") {
    Write-Host "  ✅ aws-config.json found" -ForegroundColor Green
} else {
    $warnings += "aws-config.json not found - run setup script"
    Write-Host "  ⚠️  aws-config.json not found" -ForegroundColor Yellow
}

# Summary
Write-Host "`n" -NoNewline
Write-Host "===========================================" -ForegroundColor Yellow
Write-Host "📊 VERIFICATION SUMMARY" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Yellow

if ($errors.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-Host "✅ ALL SYSTEMS OPERATIONAL!" -ForegroundColor Green
    Write-Host "`nYour 3-tier architecture is ready:" -ForegroundColor Cyan
    Write-Host "  • Tier 1 (Freemium): ✅ Ready" -ForegroundColor Green
    Write-Host "  • Tier 2 (Self-Service): ✅ Ready" -ForegroundColor Green
    Write-Host "  • Tier 3 (Enterprise): ✅ Ready" -ForegroundColor Green
} elseif ($errors.Count -eq 0) {
    Write-Host "✅ Core infrastructure operational" -ForegroundColor Green
    Write-Host "⚠️  $($warnings.Count) warning(s) found" -ForegroundColor Yellow
} else {
    Write-Host "❌ $($errors.Count) critical issue(s) found" -ForegroundColor Red
    if ($warnings.Count -gt 0) {
        Write-Host "⚠️  $($warnings.Count) warning(s) found" -ForegroundColor Yellow
    }
}

if ($errors.Count -gt 0) {
    Write-Host "`n❌ Critical Issues:" -ForegroundColor Red
    foreach ($error in $errors) {
        Write-Host "  • $error" -ForegroundColor Red
    }
}

if ($warnings.Count -gt 0) {
    Write-Host "`n⚠️  Warnings:" -ForegroundColor Yellow
    foreach ($warning in $warnings) {
        Write-Host "  • $warning" -ForegroundColor Yellow
    }
}

if ($info.Count -gt 0 -and $Detailed) {
    Write-Host "`nℹ️  Info:" -ForegroundColor Blue
    foreach ($i in $info) {
        Write-Host "  • $i" -ForegroundColor Blue
    }
}

# Next Steps
Write-Host "`n🚀 Next Steps:" -ForegroundColor Cyan
if ($errors.Count -gt 0) {
    Write-Host "  1. Run setup script: .\scripts\setup-aws-infrastructure.ps1" -ForegroundColor White
    Write-Host "  2. Fix critical issues above" -ForegroundColor White
    Write-Host "  3. Re-run verification" -ForegroundColor White
} elseif ($warnings.Count -gt 0) {
    Write-Host "  1. Review warnings above" -ForegroundColor White
    Write-Host "  2. Update .env with AWS credentials" -ForegroundColor White
    Write-Host "  3. Test Tier 1 deployment" -ForegroundColor White
} else {
    Write-Host "  1. Test Tier 1: Deploy agent to YOUR Fargate" -ForegroundColor White
    Write-Host "  2. Test Tier 2: User onboarding flow" -ForegroundColor White
    Write-Host "  3. Monitor costs in CloudWatch" -ForegroundColor White
}

Write-Host ""
if ($errors.Count -gt 0) {
    exit 1
} else {
    exit 0
}
