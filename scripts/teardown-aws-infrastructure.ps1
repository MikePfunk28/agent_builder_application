# AWS Infrastructure Teardown Script
# Safely removes ALL resources created by setup-aws-infrastructure.ps1
# ONLY affects resources with the project name tag

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectName = "agent-builder",
    [string]$Region = "us-east-1",
    [string]$ConfigFile = "",
    [switch]$DryRun,
    [switch]$Force
)

Write-Host "🗑️  AWS Infrastructure Teardown" -ForegroundColor Red
Write-Host "Project: $ProjectName" -ForegroundColor Yellow
Write-Host "Region: $Region" -ForegroundColor Yellow

if (-not $Force -and -not $DryRun) {
    Write-Host "`n⚠️  WARNING: This will DELETE all resources for project '$ProjectName'" -ForegroundColor Red
    Write-Host "This action CANNOT be undone!" -ForegroundColor Red
    $confirmation = Read-Host "`nType 'DELETE' to confirm"
    
    if ($confirmation -ne "DELETE") {
        Write-Host "❌ Teardown cancelled" -ForegroundColor Yellow
        exit 0
    }
}

# Verify AWS CLI and credentials
Write-Host "`n📋 Verifying AWS Setup..." -ForegroundColor Cyan
try {
    $identity = aws sts get-caller-identity --output json | ConvertFrom-Json
    Write-Host "✅ AWS Identity: $($identity.Arn)" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS CLI not configured or no permissions" -ForegroundColor Red
    exit 1
}

# Load config if provided
$config = $null
if ($ConfigFile -and (Test-Path $ConfigFile)) {
    Write-Host "`n📄 Loading configuration from: $ConfigFile" -ForegroundColor Cyan
    $config = Get-Content $ConfigFile | ConvertFrom-Json
}

if ($DryRun) {
    Write-Host "`n🔍 DRY RUN MODE - Showing what would be deleted" -ForegroundColor Yellow
}

$deletedResources = @()
$failedResources = @()

# 1. Delete ECS Tasks and Cluster
Write-Host "`n🚀 Cleaning up ECS resources..." -ForegroundColor Cyan
try {
    # List clusters
    $clustersJson = aws ecs list-clusters --region $Region --output json
    $clusters = ($clustersJson | ConvertFrom-Json).clusterArns | Where-Object { $_ -like "*$ProjectName*" }
    
    foreach ($clusterArn in $clusters) {
        $clusterName = $clusterArn.Split('/')[-1]
        Write-Host "  Found cluster: $clusterName" -ForegroundColor Yellow
        
        # Stop all running tasks
        $tasksJson = aws ecs list-tasks --cluster $clusterName --region $Region --output json
        $tasks = ($tasksJson | ConvertFrom-Json).taskArns
        
        foreach ($taskArn in $tasks) {
            if (-not $DryRun) {
                aws ecs stop-task --cluster $clusterName --task $taskArn --region $Region | Out-Null
                Write-Host "    ✅ Stopped task: $taskArn" -ForegroundColor Green
            } else {
                Write-Host "    [DRY RUN] Would stop task: $taskArn" -ForegroundColor Gray
            }
        }
        
        # Delete cluster
        if (-not $DryRun) {
            aws ecs delete-cluster --cluster $clusterName --region $Region | Out-Null
            Write-Host "  ✅ Deleted cluster: $clusterName" -ForegroundColor Green
            $deletedResources += "ECS Cluster: $clusterName"
        } else {
            Write-Host "  [DRY RUN] Would delete cluster: $clusterName" -ForegroundColor Gray
        }
    }
    
    # Deregister task definitions
    $taskFamiliesJson = aws ecs list-task-definition-families --family-prefix $ProjectName --region $Region --output json
    $taskFamilies = ($taskFamiliesJson | ConvertFrom-Json).families
    
    foreach ($family in $taskFamilies) {
        $taskDefsJson = aws ecs list-task-definitions --family-prefix $family --region $Region --output json
        $taskDefs = ($taskDefsJson | ConvertFrom-Json).taskDefinitionArns
        
        foreach ($taskDef in $taskDefs) {
            if (-not $DryRun) {
                aws ecs deregister-task-definition --task-definition $taskDef --region $Region | Out-Null
                Write-Host "  ✅ Deregistered: $taskDef" -ForegroundColor Green
            } else {
                Write-Host "  [DRY RUN] Would deregister: $taskDef" -ForegroundColor Gray
            }
        }
    }
    
} catch {
    Write-Host "  ⚠️  ECS cleanup warning: $($_.Exception.Message)" -ForegroundColor Yellow
    $failedResources += "ECS: $($_.Exception.Message)"
}

# 2. Delete ECR Repositories
Write-Host "`n📦 Cleaning up ECR repositories..." -ForegroundColor Cyan
try {
    $reposJson = aws ecr describe-repositories --region $Region --output json 2>$null
    if ($reposJson) {
        $repos = ($reposJson | ConvertFrom-Json).repositories | Where-Object { $_.repositoryName -like "*$ProjectName*" }
        
        foreach ($repo in $repos) {
            if (-not $DryRun) {
                aws ecr delete-repository --repository-name $repo.repositoryName --force --region $Region | Out-Null
                Write-Host "  ✅ Deleted ECR repository: $($repo.repositoryName)" -ForegroundColor Green
                $deletedResources += "ECR Repository: $($repo.repositoryName)"
            } else {
                Write-Host "  [DRY RUN] Would delete ECR repository: $($repo.repositoryName)" -ForegroundColor Gray
            }
        }
    }
} catch {
    Write-Host "  ⚠️  ECR cleanup warning: $($_.Exception.Message)" -ForegroundColor Yellow
    $failedResources += "ECR: $($_.Exception.Message)"
}

# 3. Delete S3 Buckets
Write-Host "`n🪣 Cleaning up S3 buckets..." -ForegroundColor Cyan
try {
    $bucketsJson = aws s3api list-buckets --output json
    $buckets = ($bucketsJson | ConvertFrom-Json).Buckets | Where-Object { $_.Name -like "*$ProjectName*" }
    
    foreach ($bucket in $buckets) {
        Write-Host "  Found bucket: $($bucket.Name)" -ForegroundColor Yellow
        
        if (-not $DryRun) {
            # Empty bucket first
            Write-Host "    Emptying bucket..." -ForegroundColor Gray
            aws s3 rm "s3://$($bucket.Name)" --recursive 2>$null | Out-Null
            
            # Delete all versions if versioning is enabled
            $versionsJson = aws s3api list-object-versions --bucket $bucket.Name --output json 2>$null
            if ($versionsJson) {
                $versions = $versionsJson | ConvertFrom-Json
                
                foreach ($version in $versions.Versions) {
                    aws s3api delete-object --bucket $bucket.Name --key $version.Key --version-id $version.VersionId 2>$null | Out-Null
                }
                
                foreach ($marker in $versions.DeleteMarkers) {
                    aws s3api delete-object --bucket $bucket.Name --key $marker.Key --version-id $marker.VersionId 2>$null | Out-Null
                }
            }
            
            # Delete bucket
            aws s3api delete-bucket --bucket $bucket.Name --region $Region | Out-Null
            Write-Host "  ✅ Deleted S3 bucket: $($bucket.Name)" -ForegroundColor Green
            $deletedResources += "S3 Bucket: $($bucket.Name)"
        } else {
            Write-Host "  [DRY RUN] Would delete S3 bucket: $($bucket.Name)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "  ⚠️  S3 cleanup warning: $($_.Exception.Message)" -ForegroundColor Yellow
    $failedResources += "S3: $($_.Exception.Message)"
}

# 4. Delete CloudWatch Log Groups
Write-Host "`n📊 Cleaning up CloudWatch logs..." -ForegroundColor Cyan
try {
    $logGroupsJson = aws logs describe-log-groups --region $Region --output json
    $logGroups = ($logGroupsJson | ConvertFrom-Json).logGroups | Where-Object { $_.logGroupName -like "*$ProjectName*" -or $_.logGroupName -like "/ecs/$ProjectName*" }
    
    foreach ($logGroup in $logGroups) {
        if (-not $DryRun) {
            aws logs delete-log-group --log-group-name $logGroup.logGroupName --region $Region | Out-Null
            Write-Host "  ✅ Deleted log group: $($logGroup.logGroupName)" -ForegroundColor Green
            $deletedResources += "Log Group: $($logGroup.logGroupName)"
        } else {
            Write-Host "  [DRY RUN] Would delete log group: $($logGroup.logGroupName)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "  ⚠️  CloudWatch cleanup warning: $($_.Exception.Message)" -ForegroundColor Yellow
    $failedResources += "CloudWatch: $($_.Exception.Message)"
}

# 5. Delete CloudWatch Alarms
Write-Host "`n⏰ Cleaning up CloudWatch alarms..." -ForegroundColor Cyan
try {
    $alarmsJson = aws cloudwatch describe-alarms --region us-east-1 --output json
    $alarms = ($alarmsJson | ConvertFrom-Json).MetricAlarms | Where-Object { $_.AlarmName -like "*$ProjectName*" }
    
    foreach ($alarm in $alarms) {
        if (-not $DryRun) {
            aws cloudwatch delete-alarms --alarm-names $alarm.AlarmName --region us-east-1 | Out-Null
            Write-Host "  ✅ Deleted alarm: $($alarm.AlarmName)" -ForegroundColor Green
            $deletedResources += "CloudWatch Alarm: $($alarm.AlarmName)"
        } else {
            Write-Host "  [DRY RUN] Would delete alarm: $($alarm.AlarmName)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "  ⚠️  Alarm cleanup warning: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 6. Delete Secrets Manager Secrets
Write-Host "`n🔐 Cleaning up Secrets Manager..." -ForegroundColor Cyan
try {
    $secretsJson = aws secretsmanager list-secrets --region $Region --output json
    $secrets = ($secretsJson | ConvertFrom-Json).SecretList | Where-Object { $_.Name -like "*$ProjectName*" }
    
    foreach ($secret in $secrets) {
        if (-not $DryRun) {
            # Force delete without recovery window
            aws secretsmanager delete-secret --secret-id $secret.Name --force-delete-without-recovery --region $Region | Out-Null
            Write-Host "  ✅ Deleted secret: $($secret.Name)" -ForegroundColor Green
            $deletedResources += "Secret: $($secret.Name)"
        } else {
            Write-Host "  [DRY RUN] Would delete secret: $($secret.Name)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "  ⚠️  Secrets Manager cleanup warning: $($_.Exception.Message)" -ForegroundColor Yellow
    $failedResources += "Secrets: $($_.Exception.Message)"
}

# 7. Delete VPC Resources (Security Groups, Subnets, IGW, VPC)
Write-Host "`n🌐 Cleaning up VPC resources..." -ForegroundColor Cyan
try {
    # Get VPCs with project tag
    $vpcsJson = aws ec2 describe-vpcs --filters "Name=tag:Name,Values=*$ProjectName*" --region $Region --output json
    $vpcs = ($vpcsJson | ConvertFrom-Json).Vpcs
    
    foreach ($vpc in $vpcs) {
        $vpcId = $vpc.VpcId
        Write-Host "  Found VPC: $vpcId" -ForegroundColor Yellow
        
        # Delete security groups (except default)
        $sgsJson = aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$vpcId" --region $Region --output json
        $sgs = ($sgsJson | ConvertFrom-Json).SecurityGroups | Where-Object { $_.GroupName -ne "default" }
        
        foreach ($sg in $sgs) {
            if (-not $DryRun) {
                aws ec2 delete-security-group --group-id $sg.GroupId --region $Region 2>$null | Out-Null
                Write-Host "    ✅ Deleted security group: $($sg.GroupId)" -ForegroundColor Green
            } else {
                Write-Host "    [DRY RUN] Would delete security group: $($sg.GroupId)" -ForegroundColor Gray
            }
        }
        
        # Delete subnets
        $subnetsJson = aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpcId" --region $Region --output json
        $subnets = ($subnetsJson | ConvertFrom-Json).Subnets
        
        foreach ($subnet in $subnets) {
            if (-not $DryRun) {
                aws ec2 delete-subnet --subnet-id $subnet.SubnetId --region $Region | Out-Null
                Write-Host "    ✅ Deleted subnet: $($subnet.SubnetId)" -ForegroundColor Green
            } else {
                Write-Host "    [DRY RUN] Would delete subnet: $($subnet.SubnetId)" -ForegroundColor Gray
            }
        }
        
        # Detach and delete internet gateways
        $igwsJson = aws ec2 describe-internet-gateways --filters "Name=attachment.vpc-id,Values=$vpcId" --region $Region --output json
        $igws = ($igwsJson | ConvertFrom-Json).InternetGateways
        
        foreach ($igw in $igws) {
            if (-not $DryRun) {
                aws ec2 detach-internet-gateway --internet-gateway-id $igw.InternetGatewayId --vpc-id $vpcId --region $Region | Out-Null
                aws ec2 delete-internet-gateway --internet-gateway-id $igw.InternetGatewayId --region $Region | Out-Null
                Write-Host "    ✅ Deleted internet gateway: $($igw.InternetGatewayId)" -ForegroundColor Green
            } else {
                Write-Host "    [DRY RUN] Would delete internet gateway: $($igw.InternetGatewayId)" -ForegroundColor Gray
            }
        }
        
        # Delete route tables (except main)
        $rtsJson = aws ec2 describe-route-tables --filters "Name=vpc-id,Values=$vpcId" --region $Region --output json
        $rts = ($rtsJson | ConvertFrom-Json).RouteTables | Where-Object { 
            $_.Associations.Count -eq 0 -or ($_.Associations | Where-Object { -not $_.Main }).Count -gt 0 
        }
        
        foreach ($rt in $rts) {
            if (-not $DryRun) {
                aws ec2 delete-route-table --route-table-id $rt.RouteTableId --region $Region 2>$null | Out-Null
                Write-Host "    ✅ Deleted route table: $($rt.RouteTableId)" -ForegroundColor Green
            } else {
                Write-Host "    [DRY RUN] Would delete route table: $($rt.RouteTableId)" -ForegroundColor Gray
            }
        }
        
        # Delete VPC
        if (-not $DryRun) {
            aws ec2 delete-vpc --vpc-id $vpcId --region $Region | Out-Null
            Write-Host "  ✅ Deleted VPC: $vpcId" -ForegroundColor Green
            $deletedResources += "VPC: $vpcId"
        } else {
            Write-Host "  [DRY RUN] Would delete VPC: $vpcId" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "  ⚠️  VPC cleanup warning: $($_.Exception.Message)" -ForegroundColor Yellow
    $failedResources += "VPC: $($_.Exception.Message)"
}

# 8. Delete IAM Roles and Policies
Write-Host "`n🔐 Cleaning up IAM resources..." -ForegroundColor Cyan
try {
    # List roles
    $rolesJson = aws iam list-roles --output json
    $roles = ($rolesJson | ConvertFrom-Json).Roles | Where-Object { $_.RoleName -like "*$ProjectName*" }
    
    foreach ($role in $roles) {
        Write-Host "  Found role: $($role.RoleName)" -ForegroundColor Yellow
        
        if (-not $DryRun) {
            # Detach managed policies
            $attachedPoliciesJson = aws iam list-attached-role-policies --role-name $role.RoleName --output json
            $attachedPolicies = ($attachedPoliciesJson | ConvertFrom-Json).AttachedPolicies
            
            foreach ($policy in $attachedPolicies) {
                aws iam detach-role-policy --role-name $role.RoleName --policy-arn $policy.PolicyArn | Out-Null
                Write-Host "    Detached policy: $($policy.PolicyName)" -ForegroundColor Gray
            }
            
            # Delete inline policies
            $inlinePoliciesJson = aws iam list-role-policies --role-name $role.RoleName --output json
            $inlinePolicies = ($inlinePoliciesJson | ConvertFrom-Json).PolicyNames
            
            foreach ($policyName in $inlinePolicies) {
                aws iam delete-role-policy --role-name $role.RoleName --policy-name $policyName | Out-Null
                Write-Host "    Deleted inline policy: $policyName" -ForegroundColor Gray
            }
            
            # Delete role
            aws iam delete-role --role-name $role.RoleName | Out-Null
            Write-Host "  ✅ Deleted role: $($role.RoleName)" -ForegroundColor Green
            $deletedResources += "IAM Role: $($role.RoleName)"
        } else {
            Write-Host "  [DRY RUN] Would delete role: $($role.RoleName)" -ForegroundColor Gray
        }
    }
    
    # Delete custom policies
    $policiesJson = aws iam list-policies --scope Local --output json
    $policies = ($policiesJson | ConvertFrom-Json).Policies | Where-Object { $_.PolicyName -like "*$ProjectName*" }
    
    foreach ($policy in $policies) {
        if (-not $DryRun) {
            # Delete all policy versions except default
            $versionsJson = aws iam list-policy-versions --policy-arn $policy.Arn --output json
            $versions = ($versionsJson | ConvertFrom-Json).Versions | Where-Object { -not $_.IsDefaultVersion }
            
            foreach ($version in $versions) {
                aws iam delete-policy-version --policy-arn $policy.Arn --version-id $version.VersionId | Out-Null
            }
            
            # Delete policy
            aws iam delete-policy --policy-arn $policy.Arn | Out-Null
            Write-Host "  ✅ Deleted policy: $($policy.PolicyName)" -ForegroundColor Green
            $deletedResources += "IAM Policy: $($policy.PolicyName)"
        } else {
            Write-Host "  [DRY RUN] Would delete policy: $($policy.PolicyName)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "  ⚠️  IAM cleanup warning: $($_.Exception.Message)" -ForegroundColor Yellow
    $failedResources += "IAM: $($_.Exception.Message)"
}

# 9. Delete Cognito Resources
Write-Host "`n👤 Cleaning up Cognito resources..." -ForegroundColor Cyan
try {
    # List user pools
    $poolsJson = aws cognito-idp list-user-pools --max-results 60 --region $Region --output json
    $pools = ($poolsJson | ConvertFrom-Json).UserPools | Where-Object { $_.Name -like "*$ProjectName*" }
    
    foreach ($pool in $pools) {
        Write-Host "  Found user pool: $($pool.Name)" -ForegroundColor Yellow
        
        if (-not $DryRun) {
            # Delete domain first
            $domainJson = aws cognito-idp describe-user-pool --user-pool-id $pool.Id --region $Region --output json
            $domain = ($domainJson | ConvertFrom-Json).UserPool.Domain
            
            if ($domain) {
                aws cognito-idp delete-user-pool-domain --domain $domain --user-pool-id $pool.Id --region $Region 2>$null | Out-Null
                Write-Host "    Deleted domain: $domain" -ForegroundColor Gray
            }
            
            # Delete user pool
            aws cognito-idp delete-user-pool --user-pool-id $pool.Id --region $Region | Out-Null
            Write-Host "  ✅ Deleted user pool: $($pool.Name)" -ForegroundColor Green
            $deletedResources += "Cognito User Pool: $($pool.Name)"
        } else {
            Write-Host "  [DRY RUN] Would delete user pool: $($pool.Name)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "  ⚠️  Cognito cleanup warning: $($_.Exception.Message)" -ForegroundColor Yellow
    $failedResources += "Cognito: $($_.Exception.Message)"
}

# Summary
Write-Host "`n" -NoNewline
Write-Host "===========================================" -ForegroundColor Yellow
if ($DryRun) {
    Write-Host "🔍 DRY RUN COMPLETE" -ForegroundColor Cyan
    Write-Host "No resources were actually deleted" -ForegroundColor Gray
} else {
    Write-Host "✅ TEARDOWN COMPLETE" -ForegroundColor Green
}
Write-Host "===========================================" -ForegroundColor Yellow

if ($deletedResources.Count -gt 0) {
    Write-Host "`n📋 Deleted Resources ($($deletedResources.Count)):" -ForegroundColor Cyan
    foreach ($resource in $deletedResources) {
        Write-Host "  ✅ $resource" -ForegroundColor Green
    }
}

if ($failedResources.Count -gt 0) {
    Write-Host "`n⚠️  Failed/Skipped Resources ($($failedResources.Count)):" -ForegroundColor Yellow
    foreach ($resource in $failedResources) {
        Write-Host "  ⚠️  $resource" -ForegroundColor Yellow
    }
}

Write-Host "`n💰 Cost Impact:" -ForegroundColor Cyan
Write-Host "  - All pay-per-request resources stopped" -ForegroundColor White
Write-Host "  - No more charges for this project" -ForegroundColor White
Write-Host "  - Your other AWS resources are unaffected" -ForegroundColor White

Write-Host "`n📝 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Verify in AWS Console that resources are deleted" -ForegroundColor White
Write-Host "  2. Check for any remaining resources manually" -ForegroundColor White
Write-Host "  3. Review final AWS bill in 24-48 hours" -ForegroundColor White

if (-not $DryRun) {
    Write-Host "`n✅ All $ProjectName infrastructure has been removed!" -ForegroundColor Green
} else {
    Write-Host "`n💡 Run without -DryRun to actually delete resources" -ForegroundColor Cyan
}
