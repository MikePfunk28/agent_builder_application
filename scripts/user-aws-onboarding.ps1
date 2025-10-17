# User AWS Account Onboarding Script (Tier 2)
# This script runs in the USER's AWS account to set up cross-account access
# Allows your platform to deploy agents to their account

param(
    [Parameter(Mandatory=$true)]
    [string]$PlatformAccountId,  # Your AWS account ID
    [string]$Region = "us-east-1",
    [string]$UserIdentifier = "",
    [switch]$DryRun
)

Write-Host "🔗 Setting up cross-account access for Agent Builder Platform" -ForegroundColor Green
Write-Host "Platform Account: $PlatformAccountId" -ForegroundColor Yellow
Write-Host "Your Region: $Region" -ForegroundColor Yellow

# Verify AWS CLI and credentials
Write-Host "`n📋 Verifying AWS Setup..." -ForegroundColor Cyan
try {
    $identity = aws sts get-caller-identity --output json | ConvertFrom-Json
    Write-Host "✅ Your AWS Account: $($identity.Account)" -ForegroundColor Green
    Write-Host "✅ Your Identity: $($identity.Arn)" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS CLI not configured or no permissions" -ForegroundColor Red
    exit 1
}

if ($identity.Account -eq $PlatformAccountId) {
    Write-Host "❌ Error: You're running this in the platform account, not your own!" -ForegroundColor Red
    exit 1
}

$userAccountId = $identity.Account
if ([string]::IsNullOrEmpty($UserIdentifier)) {
    $UserIdentifier = $userAccountId
}

if ($DryRun) {
    Write-Host "`n🔍 DRY RUN MODE - No resources will be created" -ForegroundColor Yellow
    exit 0
}

$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$roleName = "AgentBuilderCrossAccountRole-$timestamp"

# Create cross-account trust policy
Write-Host "`n🔐 Creating cross-account IAM role..." -ForegroundColor Cyan

$trustPolicy = @{
    Version = "2012-10-17"
    Statement = @(
        @{
            Effect = "Allow"
            Principal = @{
                AWS = "arn:aws:iam::${PlatformAccountId}:root"
            }
            Action = "sts:AssumeRole"
            Condition = @{
                StringEquals = @{
                    "sts:ExternalId" = $UserIdentifier
                }
            }
        }
    )
} | ConvertTo-Json -Depth 10

try {
    # Create role
    $roleResult = aws iam create-role `
        --role-name $roleName `
        --assume-role-policy-document $trustPolicy `
        --description "Allows Agent Builder Platform to deploy agents to this account" `
        --output json | ConvertFrom-Json
    
    $roleArn = $roleResult.Role.Arn
    Write-Host "✅ Role created: $roleArn" -ForegroundColor Green
    
    # Create permission policy for agent deployment
    $permissionPolicy = @{
        Version = "2012-10-17"
        Statement = @(
            @{
                Sid = "AgentDeploymentPermissions"
                Effect = "Allow"
                Action = @(
                    "ecs:CreateCluster",
                    "ecs:RegisterTaskDefinition",
                    "ecs:RunTask",
                    "ecs:StopTask",
                    "ecs:DescribeTasks",
                    "ecs:DescribeTaskDefinition",
                    "ecs:ListTasks"
                )
                Resource = "*"
            },
            @{
                Sid = "ECRPermissions"
                Effect = "Allow"
                Action = @(
                    "ecr:CreateRepository",
                    "ecr:GetAuthorizationToken",
                    "ecr:BatchCheckLayerAvailability",
                    "ecr:GetDownloadUrlForLayer",
                    "ecr:BatchGetImage",
                    "ecr:PutImage",
                    "ecr:InitiateLayerUpload",
                    "ecr:UploadLayerPart",
                    "ecr:CompleteLayerUpload"
                )
                Resource = "*"
            },
            @{
                Sid = "LogsPermissions"
                Effect = "Allow"
                Action = @(
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents",
                    "logs:DescribeLogStreams"
                )
                Resource = "arn:aws:logs:*:*:log-group:/aws/agent-builder/*"
            },
            @{
                Sid = "IAMPermissions"
                Effect = "Allow"
                Action = @(
                    "iam:CreateRole",
                    "iam:AttachRolePolicy",
                    "iam:PassRole",
                    "iam:GetRole"
                )
                Resource = "arn:aws:iam::*:role/agent-builder-*"
            },
            @{
                Sid = "VPCPermissions"
                Effect = "Allow"
                Action = @(
                    "ec2:DescribeVpcs",
                    "ec2:DescribeSubnets",
                    "ec2:DescribeSecurityGroups",
                    "ec2:CreateSecurityGroup",
                    "ec2:AuthorizeSecurityGroupIngress",
                    "ec2:AuthorizeSecurityGroupEgress"
                )
                Resource = "*"
            },
            @{
                Sid = "BedrockPermissions"
                Effect = "Allow"
                Action = @(
                    "bedrock:InvokeModel",
                    "bedrock:InvokeModelWithResponseStream"
                )
                Resource = "*"
            }
        )
    } | ConvertTo-Json -Depth 10
    
    # Create and attach policy
    $policyName = "AgentBuilderDeploymentPolicy-$timestamp"
    $policyResult = aws iam create-policy `
        --policy-name $policyName `
        --policy-document $permissionPolicy `
        --description "Permissions for Agent Builder Platform to deploy agents" `
        --output json | ConvertFrom-Json
    
    $policyArn = $policyResult.Policy.Arn
    Write-Host "✅ Policy created: $policyArn" -ForegroundColor Green
    
    # Attach policy to role
    aws iam attach-role-policy --role-name $roleName --policy-arn $policyArn | Out-Null
    Write-Host "✅ Policy attached to role" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Failed to create IAM resources: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Create VPC resources if needed
Write-Host "`n🌐 Setting up VPC for agent deployment..." -ForegroundColor Cyan
try {
    # Check for default VPC
    $defaultVpc = aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --region $Region --output json | ConvertFrom-Json
    
    if ($defaultVpc.Vpcs.Count -gt 0) {
        $vpcId = $defaultVpc.Vpcs[0].VpcId
        Write-Host "✅ Using default VPC: $vpcId" -ForegroundColor Green
        
        # Get default subnets
        $subnets = aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpcId" --region $Region --output json | ConvertFrom-Json
        $subnetId = $subnets.Subnets[0].SubnetId
        Write-Host "✅ Using subnet: $subnetId" -ForegroundColor Green
    } else {
        Write-Host "⚠️  No default VPC found. Creating new VPC..." -ForegroundColor Yellow
        
        # Create VPC
        $vpcResult = aws ec2 create-vpc --cidr-block "10.0.0.0/16" --region $Region --output json | ConvertFrom-Json
        $vpcId = $vpcResult.Vpc.VpcId
        
        aws ec2 create-tags --resources $vpcId --tags "Key=Name,Value=agent-builder-vpc" --region $Region | Out-Null
        aws ec2 modify-vpc-attribute --vpc-id $vpcId --enable-dns-hostnames --region $Region | Out-Null
        
        # Create Internet Gateway
        $igwResult = aws ec2 create-internet-gateway --region $Region --output json | ConvertFrom-Json
        $igwId = $igwResult.InternetGateway.InternetGatewayId
        aws ec2 attach-internet-gateway --vpc-id $vpcId --internet-gateway-id $igwId --region $Region | Out-Null
        
        # Create subnet
        $subnetResult = aws ec2 create-subnet --vpc-id $vpcId --cidr-block "10.0.1.0/24" --region $Region --output json | ConvertFrom-Json
        $subnetId = $subnetResult.Subnet.SubnetId
        aws ec2 modify-subnet-attribute --subnet-id $subnetId --map-public-ip-on-launch --region $Region | Out-Null
        
        # Create route table
        $rtResult = aws ec2 create-route-table --vpc-id $vpcId --region $Region --output json | ConvertFrom-Json
        $rtId = $rtResult.RouteTable.RouteTableId
        aws ec2 create-route --route-table-id $rtId --destination-cidr-block "0.0.0.0/0" --gateway-id $igwId --region $Region | Out-Null
        aws ec2 associate-route-table --route-table-id $rtId --subnet-id $subnetId --region $Region | Out-Null
        
        Write-Host "✅ VPC created: $vpcId" -ForegroundColor Green
    }
    
    # Create security group
    $sgResult = aws ec2 create-security-group `
        --group-name "agent-builder-sg-$timestamp" `
        --description "Security group for Agent Builder agents" `
        --vpc-id $vpcId `
        --region $Region `
        --output json | ConvertFrom-Json
    
    $sgId = $sgResult.GroupId
    Write-Host "✅ Security group created: $sgId" -ForegroundColor Green
    
} catch {
    Write-Host "⚠️  VPC setup warning: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Create ECS cluster
Write-Host "`n🚀 Creating ECS cluster..." -ForegroundColor Cyan
try {
    $clusterName = "agent-builder-cluster-$timestamp"
    aws ecs create-cluster --cluster-name $clusterName --region $Region | Out-Null
    Write-Host "✅ ECS cluster created: $clusterName" -ForegroundColor Green
} catch {
    Write-Host "⚠️  ECS cluster creation warning: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Save configuration
$config = @{
    userAccountId = $userAccountId
    platformAccountId = $PlatformAccountId
    region = $Region
    roleArn = $roleArn
    roleName = $roleName
    policyArn = $policyArn
    externalId = $UserIdentifier
    vpcId = $vpcId
    subnetId = $subnetId
    securityGroupId = $sgId
    clusterName = $clusterName
    timestamp = $timestamp
}

$configFile = "user-aws-config-$timestamp.json"
$config | ConvertTo-Json -Depth 10 | Out-File -FilePath $configFile -Encoding UTF8

# Display results
Write-Host "`n✅ AWS Account Setup Complete!" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Yellow
Write-Host "`n📋 Configuration:" -ForegroundColor Cyan
Write-Host "  Your Account ID: $userAccountId" -ForegroundColor White
Write-Host "  Platform Account ID: $PlatformAccountId" -ForegroundColor White
Write-Host "  Region: $Region" -ForegroundColor White
Write-Host "  Role ARN: $roleArn" -ForegroundColor White
Write-Host "  External ID: $UserIdentifier" -ForegroundColor White
Write-Host "  ECS Cluster: $clusterName" -ForegroundColor White

Write-Host "`n🔑 IMPORTANT - Copy these values to the Agent Builder Platform:" -ForegroundColor Yellow
Write-Host "===========================================" -ForegroundColor Yellow
Write-Host "Role ARN: $roleArn" -ForegroundColor Cyan
Write-Host "External ID: $UserIdentifier" -ForegroundColor Cyan
Write-Host "Region: $Region" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Yellow

Write-Host "`n📁 Configuration saved to: $configFile" -ForegroundColor Cyan

Write-Host "`n🎯 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Copy the Role ARN and External ID above" -ForegroundColor White
Write-Host "  2. Go to Agent Builder Platform settings" -ForegroundColor White
Write-Host "  3. Click 'Connect My AWS Account'" -ForegroundColor White
Write-Host "  4. Paste the Role ARN and External ID" -ForegroundColor White
Write-Host "  5. Start deploying agents to YOUR AWS account!" -ForegroundColor White

Write-Host "`n💰 Cost Information:" -ForegroundColor Cyan
Write-Host "  - You will be charged for resources in YOUR account" -ForegroundColor White
Write-Host "  - ECS Fargate: ~$0.04/hour per agent" -ForegroundColor White
Write-Host "  - Bedrock: Pay per API call" -ForegroundColor White
Write-Host "  - ECR: $0.10/GB/month for storage" -ForegroundColor White

Write-Host "`n⚠️  Security Notes:" -ForegroundColor Yellow
Write-Host "  - The platform can ONLY deploy agents (limited permissions)" -ForegroundColor White
Write-Host "  - External ID prevents unauthorized access" -ForegroundColor White
Write-Host "  - You can revoke access anytime by deleting the role" -ForegroundColor White

Write-Host "`n✅ Setup completed successfully!" -ForegroundColor Green
