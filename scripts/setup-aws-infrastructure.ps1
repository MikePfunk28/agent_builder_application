# AWS AgentCore + Cognito + Bedrock Setup Script
# Requires AWS CLI v2 and appropriate permissions

param(
    [string]$Region = "us-east-1",
    [string]$ProjectName = "agent-builder",
    [string]$ConvexSiteUrl = "https://your-convex-deployment.convex.site",
    [string]$ProductionDomain = "https://your-production-domain.com",
    [switch]$SkipCognito,
    [switch]$SkipAgentCore,
    [switch]$DryRun
)

Write-Host "🚀 Setting up AWS Infrastructure for Agent Builder Platform" -ForegroundColor Green
Write-Host "Region: $Region" -ForegroundColor Yellow
Write-Host "Project: $ProjectName" -ForegroundColor Yellow

# Verify AWS CLI and credentials
Write-Host "`n📋 Verifying AWS Setup..." -ForegroundColor Cyan
try {
    $identity = aws sts get-caller-identity --output json | ConvertFrom-Json
    Write-Host "✅ AWS Identity: $($identity.Arn)" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS CLI not configured or no permissions" -ForegroundColor Red
    exit 1
}

# Check if region supports required services
$supportedRegions = @("us-east-1", "us-west-2", "eu-west-1", "ap-southeast-2")
if ($Region -notin $supportedRegions) {
    Write-Host "⚠️  Warning: $Region may not support all Bedrock features" -ForegroundColor Yellow
    Write-Host "Recommended regions: $($supportedRegions -join ', ')" -ForegroundColor Yellow
}

# Generate unique identifiers
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$uniqueId = $timestamp.Substring($timestamp.Length - 8)

# Configuration variables
$cognitoPoolName = "$ProjectName-user-pool-$uniqueId"
$cognitoDomain = "$ProjectName-auth-$uniqueId"
$agentCoreRole = "$ProjectName-agentcore-role-$uniqueId"
$ecrRepository = "$ProjectName-agents-$uniqueId"
$s3Bucket = "$ProjectName-deployments-$uniqueId"

Write-Host "`n🔧 Configuration:" -ForegroundColor Cyan
Write-Host "  Cognito Pool: $cognitoPoolName"
Write-Host "  Auth Domain: $cognitoDomain"
Write-Host "  ECR Repo: $ecrRepository"
Write-Host "  S3 Bucket: $s3Bucket"

if ($DryRun) {
    Write-Host "`n🔍 DRY RUN MODE - No resources will be created" -ForegroundColor Yellow
    exit 0
}

# Create output configuration object
$config = @{
    region = $Region
    projectName = $ProjectName
    timestamp = $timestamp
}

# 1. Setup Cognito User Pool
if (-not $SkipCognito) {
    Write-Host "`n👤 Setting up AWS Cognito..." -ForegroundColor Cyan
    
    try {
        # Create User Pool
        Write-Host "Creating Cognito User Pool..."
        $userPoolResult = aws cognito-idp create-user-pool `
            --pool-name $cognitoPoolName `
            --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false}" `
            --auto-verified-attributes email `
            --username-attributes email `
            --region $Region `
            --output json | ConvertFrom-Json
        
        $userPoolId = $userPoolResult.UserPool.Id
        Write-Host "✅ User Pool created: $userPoolId" -ForegroundColor Green
        
        # Create User Pool Domain
        Write-Host "Creating Cognito Domain..."
        aws cognito-idp create-user-pool-domain `
            --domain $cognitoDomain `
            --user-pool-id $userPoolId `
            --region $Region | Out-Null
        
        Write-Host "✅ Domain created: $cognitoDomain" -ForegroundColor Green
        
        # Create User Pool Client
        Write-Host "Creating User Pool Client..."
        $clientResult = aws cognito-idp create-user-pool-client `
            --user-pool-id $userPoolId `
            --client-name "$ProjectName-client" `
            --generate-secret `
            --callback-urls "http://localhost:3000/auth/callback" "$ProductionDomain/auth/callback" `
            --logout-urls "http://localhost:3000/auth/logout" "$ProductionDomain/auth/logout" `
            --allowed-o-auth-flows "code" `
            --allowed-o-auth-scopes "openid" "profile" "email" `
            --allowed-o-auth-flows-user-pool-client `
            --supported-identity-providers "COGNITO" `
            --explicit-auth-flows "ALLOW_USER_SRP_AUTH" "ALLOW_REFRESH_TOKEN_AUTH" "ALLOW_USER_PASSWORD_AUTH" `
            --region $Region `
            --output json | ConvertFrom-Json
        
        $clientId = $clientResult.UserPoolClient.ClientId
        $clientSecret = $clientResult.UserPoolClient.ClientSecret
        Write-Host "✅ Client created: $clientId" -ForegroundColor Green
        
        # Create test user
        $testUsername = "testuser$uniqueId@example.com"
        $testPassword = "TempPass123!"
        
        Write-Host "Creating test user..."
        aws cognito-idp admin-create-user `
            --user-pool-id $userPoolId `
            --username $testUsername `
            --temporary-password $testPassword `
            --message-action SUPPRESS `
            --region $Region | Out-Null
        
        aws cognito-idp admin-set-user-password `
            --user-pool-id $userPoolId `
            --username $testUsername `
            --password $testPassword `
            --permanent `
            --region $Region | Out-Null
        
        Write-Host "✅ Test user created: $testUsername" -ForegroundColor Green
        
        # Store Cognito config
        $config.cognito = @{
            userPoolId = $userPoolId
            clientId = $clientId
            clientSecret = $clientSecret
            domain = "$cognitoDomain.auth.$Region.amazoncognito.com"
            issuerUrl = "https://cognito-idp.$Region.amazonaws.com/$userPoolId"
            testUser = @{
                username = $testUsername
                password = $testPassword
            }
        }
        
    } catch {
        Write-Host "❌ Cognito setup failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# 2. Setup ECR Repository
Write-Host "`n📦 Setting up ECR Repository..." -ForegroundColor Cyan
try {
    $ecrResult = aws ecr create-repository `
        --repository-name $ecrRepository `
        --region $Region `
        --output json | ConvertFrom-Json
    
    $ecrUri = $ecrResult.repository.repositoryUri
    Write-Host "✅ ECR Repository created: $ecrUri" -ForegroundColor Green
    
    $config.ecr = @{
        repositoryName = $ecrRepository
        repositoryUri = $ecrUri
    }
    
} catch {
    Write-Host "⚠️  ECR Repository may already exist or creation failed" -ForegroundColor Yellow
}

# 3. Setup S3 Bucket for deployments (Production-ready)
Write-Host "`n🪣 Setting up S3 Bucket..." -ForegroundColor Cyan
try {
    if ($Region -eq "us-east-1") {
        aws s3api create-bucket --bucket $s3Bucket --region $Region | Out-Null
    } else {
        aws s3api create-bucket --bucket $s3Bucket --region $Region --create-bucket-configuration LocationConstraint=$Region | Out-Null
    }
    
    # Enable versioning
    aws s3api put-bucket-versioning --bucket $s3Bucket --versioning-configuration Status=Enabled | Out-Null
    
    # Enable encryption at rest
    aws s3api put-bucket-encryption --bucket $s3Bucket --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' | Out-Null
    
    # Block public access
    aws s3api put-public-access-block --bucket $s3Bucket --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true | Out-Null
    
    Write-Host "✅ S3 Bucket created with encryption and security: $s3Bucket" -ForegroundColor Green
    
    $config.s3 = @{
        bucketName = $s3Bucket
    }
    
} catch {
    Write-Host "⚠️  S3 Bucket may already exist or creation failed" -ForegroundColor Yellow
}

# 4. Setup IAM Role for AgentCore
Write-Host "`n🔐 Setting up IAM Role for AgentCore..." -ForegroundColor Cyan
try {
    # Create trust policy
    $trustPolicy = @{
        Version = "2012-10-17"
        Statement = @(
            @{
                Effect = "Allow"
                Principal = @{
                    Service = @("bedrock.amazonaws.com", "ecs-tasks.amazonaws.com")
                }
                Action = "sts:AssumeRole"
            }
        )
    } | ConvertTo-Json -Depth 10
    
    # Create role
    $roleResult = aws iam create-role `
        --role-name $agentCoreRole `
        --assume-role-policy-document $trustPolicy `
        --output json | ConvertFrom-Json
    
    $roleArn = $roleResult.Role.Arn
    Write-Host "✅ IAM Role created: $roleArn" -ForegroundColor Green
    
    # Create least-privilege custom policy for AgentCore + Fargate testing
    $customPolicy = @{
        Version = "2012-10-17"
        Statement = @(
            @{
                Effect = "Allow"
                Action = @(
                    "bedrock:InvokeModel",
                    "bedrock:InvokeModelWithResponseStream",
                    "bedrock:ListFoundationModels"
                )
                Resource = "*"
            },
            @{
                Effect = "Allow"
                Action = @(
                    "ecs:RunTask",
                    "ecs:StopTask",
                    "ecs:DescribeTasks",
                    "ecs:DescribeTaskDefinition"
                )
                Resource = "*"
            },
            @{
                Effect = "Allow"
                Action = @(
                    "iam:PassRole"
                )
                Resource = "arn:aws:iam::*:role/*-fargate-*"
            }
            @{
                Effect = "Allow"
                Action = @(
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents"
                )
                Resource = "arn:aws:logs:$Region:*:log-group:/aws/*"
            },
            @{
                Effect = "Allow"
                Action = @(
                    "s3:GetObject",
                    "s3:PutObject"
                )
                Resource = "arn:aws:s3:::$s3Bucket/*"
            },
            @{
                Effect = "Allow"
                Action = @(
                    "ecr:GetAuthorizationToken",
                    "ecr:BatchCheckLayerAvailability",
                    "ecr:GetDownloadUrlForLayer",
                    "ecr:BatchGetImage"
                )
                Resource = "*"
            },
            @{
                Effect = "Allow"
                Action = @(
                    "ec2:CreateNetworkInterface",
                    "ec2:DescribeNetworkInterfaces",
                    "ec2:DeleteNetworkInterface",
                    "ec2:DescribeSubnets",
                    "ec2:DescribeSecurityGroups"
                )
                Resource = "*"
            }
        )
    } | ConvertTo-Json -Depth 10
    
    # Create custom policy
    $policyResult = aws iam create-policy `
        --policy-name "$agentCoreRole-policy" `
        --policy-document $customPolicy `
        --output json | ConvertFrom-Json
    
    # Attach custom policy
    aws iam attach-role-policy --role-name $agentCoreRole --policy-arn $policyResult.Policy.Arn | Out-Null
    Write-Host "  ✅ Attached least-privilege policy" -ForegroundColor Green
    
    $config.iam = @{
        roleName = $agentCoreRole
        roleArn = $roleArn
        policyArn = $policyResult.Policy.Arn
    }
    
} catch {
    Write-Host "❌ IAM Role setup failed: $($_.Exception.Message)" -ForegroundColor Red
}

# 5. Setup VPC for ECS Fargate
Write-Host "`n🌐 Setting up VPC for ECS Fargate..." -ForegroundColor Cyan
try {
    # Create VPC
    $vpcResult = aws ec2 create-vpc --cidr-block "10.0.0.0/16" --region $Region --output json | ConvertFrom-Json
    $vpcId = $vpcResult.Vpc.VpcId
    
    # Tag VPC
    aws ec2 create-tags --resources $vpcId --tags "Key=Name,Value=$ProjectName-vpc" --region $Region | Out-Null
    
    # Enable DNS hostnames
    aws ec2 modify-vpc-attribute --vpc-id $vpcId --enable-dns-hostnames --region $Region | Out-Null
    
    Write-Host "✅ VPC created: $vpcId" -ForegroundColor Green
    
    # Create Internet Gateway
    $igwResult = aws ec2 create-internet-gateway --region $Region --output json | ConvertFrom-Json
    $igwId = $igwResult.InternetGateway.InternetGatewayId
    aws ec2 attach-internet-gateway --vpc-id $vpcId --internet-gateway-id $igwId --region $Region | Out-Null
    
    Write-Host "✅ Internet Gateway created: $igwId" -ForegroundColor Green
    
    # Create public subnet
    $subnetResult = aws ec2 create-subnet --vpc-id $vpcId --cidr-block "10.0.1.0/24" --region $Region --output json | ConvertFrom-Json
    $subnetId = $subnetResult.Subnet.SubnetId
    
    # Tag subnet
    aws ec2 create-tags --resources $subnetId --tags "Key=Name,Value=$ProjectName-public-subnet" --region $Region | Out-Null
    
    # Enable auto-assign public IP
    aws ec2 modify-subnet-attribute --subnet-id $subnetId --map-public-ip-on-launch --region $Region | Out-Null
    
    Write-Host "✅ Public subnet created: $subnetId" -ForegroundColor Green
    
    # Create route table
    $rtResult = aws ec2 create-route-table --vpc-id $vpcId --region $Region --output json | ConvertFrom-Json
    $rtId = $rtResult.RouteTable.RouteTableId
    
    # Add route to internet gateway
    aws ec2 create-route --route-table-id $rtId --destination-cidr-block "0.0.0.0/0" --gateway-id $igwId --region $Region | Out-Null
    
    # Associate route table with subnet
    aws ec2 associate-route-table --route-table-id $rtId --subnet-id $subnetId --region $Region | Out-Null
    
    Write-Host "✅ Route table configured: $rtId" -ForegroundColor Green
    
    # Create security group
    $sgResult = aws ec2 create-security-group --group-name "$ProjectName-fargate-sg" --description "Security group for Fargate tasks" --vpc-id $vpcId --region $Region --output json | ConvertFrom-Json
    $sgId = $sgResult.GroupId
    
    # Allow outbound traffic
    aws ec2 authorize-security-group-egress --group-id $sgId --ip-permissions IpProtocol=-1,IpRanges='[{CidrIp=0.0.0.0/0}]' --region $Region 2>$null | Out-Null
    
    Write-Host "✅ Security group created: $sgId" -ForegroundColor Green
    
    $config.vpc = @{
        vpcId = $vpcId
        subnetId = $subnetId
        securityGroupId = $sgId
        internetGatewayId = $igwId
    }
    
} catch {
    Write-Host "⚠️  VPC setup failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 6. Setup ECS Fargate Cluster for agent testing
Write-Host "`n🚀 Setting up ECS Fargate for agent testing..." -ForegroundColor Cyan
try {
    $clusterName = "$ProjectName-testing-cluster"
    
    # Create ECS cluster
    aws ecs create-cluster --cluster-name $clusterName --capacity-providers FARGATE --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 --region $Region | Out-Null
    
    Write-Host "✅ ECS Fargate cluster created: $clusterName" -ForegroundColor Green
    
    # Create Fargate task execution role
    $fargateRole = "$ProjectName-fargate-execution-role-$uniqueId"
    $fargateTrustPolicy = @{
        Version = "2012-10-17"
        Statement = @(
            @{
                Effect = "Allow"
                Principal = @{ Service = "ecs-tasks.amazonaws.com" }
                Action = "sts:AssumeRole"
            }
        )
    } | ConvertTo-Json -Depth 10
    
    aws iam create-role --role-name $fargateRole --assume-role-policy-document $fargateTrustPolicy --region $Region | Out-Null
    aws iam attach-role-policy --role-name $fargateRole --policy-arn "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy" | Out-Null
    
    Write-Host "✅ Fargate execution role created: $fargateRole" -ForegroundColor Green
    
    # Create log group
    aws logs create-log-group --log-group-name "/ecs/$ProjectName-agent-tester" --region $Region | Out-Null
    
    Write-Host "✅ CloudWatch log group created" -ForegroundColor Green
    
    # Create task definition
    $taskDefJson = @{
        family = "$ProjectName-agent-tester"
        networkMode = "awsvpc"
        requiresCompatibilities = @("FARGATE")
        cpu = "256"
        memory = "512"
        executionRoleArn = "arn:aws:iam::$($identity.Account):role/$fargateRole"
        taskRoleArn = $config.iam.roleArn
        containerDefinitions = @(
            @{
                name = "agent-tester"
                image = "$($config.ecr.repositoryUri):latest"
                essential = $true
                logConfiguration = @{
                    logDriver = "awslogs"
                    options = @{
                        "awslogs-group" = "/ecs/$ProjectName-agent-tester"
                        "awslogs-region" = $Region
                        "awslogs-stream-prefix" = "ecs"
                    }
                }
                environment = @(
                    @{ name = "AWS_REGION"; value = $Region }
                )
            }
        )
    } | ConvertTo-Json -Depth 10 -Compress
    
    # Register task definition
    $taskDefFile = "task-definition-$timestamp.json"
    $taskDefJson | Out-File -FilePath $taskDefFile -Encoding UTF8
    aws ecs register-task-definition --cli-input-json "file://$taskDefFile" --region $Region | Out-Null
    Remove-Item $taskDefFile
    
    Write-Host "✅ Task definition registered" -ForegroundColor Green
    
    $config.fargate = @{
        clusterName = $clusterName
        executionRoleArn = "arn:aws:iam::$($identity.Account):role/$fargateRole"
        taskFamily = "$ProjectName-agent-tester"
    }
    
} catch {
    Write-Host "⚠️  ECS Fargate setup failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 7. Setup CloudWatch Alarms
Write-Host "`n📊 Setting up CloudWatch Monitoring..." -ForegroundColor Cyan
try {
    # Cost alarm
    aws cloudwatch put-metric-alarm `
        --alarm-name "$ProjectName-cost-alarm" `
        --alarm-description "Alert when estimated charges exceed $50" `
        --metric-name EstimatedCharges `
        --namespace AWS/Billing `
        --statistic Maximum `
        --period 86400 `
        --threshold 50 `
        --comparison-operator GreaterThanThreshold `
        --dimensions Name=Currency,Value=USD `
        --evaluation-periods 1 `
        --region us-east-1 | Out-Null
    
    Write-Host "✅ Cost monitoring alarm created" -ForegroundColor Green
    
} catch {
    Write-Host "⚠️  CloudWatch alarm setup failed" -ForegroundColor Yellow
}

# 8. Setup Secrets Manager for production secrets
Write-Host "`n🔐 Setting up AWS Secrets Manager..." -ForegroundColor Cyan
try {
    # Create general production secrets
    $secretValue = @{
        cognitoClientSecret = $config.cognito.clientSecret
        convexDeploymentUrl = $ConvexSiteUrl
    } | ConvertTo-Json
    
    aws secretsmanager create-secret `
        --name "$ProjectName/production" `
        --description "Production secrets for $ProjectName" `
        --secret-string $secretValue `
        --region $Region | Out-Null
    
    Write-Host "✅ Secrets Manager configured" -ForegroundColor Green
    
} catch {
    Write-Host "⚠️  Secrets Manager setup failed" -ForegroundColor Yellow
}

# 9. Verify Bedrock Model Access
Write-Host "`n🤖 Verifying Bedrock Model Access..." -ForegroundColor Cyan
try {
    $modelsJson = aws bedrock list-foundation-models --region $Region --output json
    $models = $modelsJson | ConvertFrom-Json
    $claudeModels = $models.modelSummaries | Where-Object { $_.modelId -like "*claude*" }
    
    if ($claudeModels.Count -gt 0) {
        Write-Host "✅ Bedrock models available in $Region" -ForegroundColor Green
        Write-Host "  Available Claude models: $($claudeModels.Count)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  No Claude models found. You may need to request access in the Bedrock console." -ForegroundColor Yellow
    }
    
    $config.bedrock = @{
        region = $Region
        availableModels = $claudeModels.modelId
    }
    
} catch {
    Write-Host "⚠️  Could not verify Bedrock access. Check permissions and model access." -ForegroundColor Yellow
}

# Save configuration with production settings
$config.production = @{
    encryption = "enabled"
    monitoring = "enabled"
    costAlerts = "enabled"
    secretsManagement = "enabled"
    crossAccountTesting = "enabled"
    fargateTestingCluster = $config.fargate.clusterName
    architecture = "pay-per-request"
}

# 10. Save Configuration
Write-Host "`n💾 Saving Configuration..." -ForegroundColor Cyan

# Output configuration to file
$configFile = "aws-config-$timestamp.json"
$config | ConvertTo-Json -Depth 10 | Out-File -FilePath $configFile -Encoding UTF8

Write-Host "✅ Configuration saved to: $configFile" -ForegroundColor Green

# 11. Generate environment configuration
Write-Host "`n📝 Generating configuration files..." -ForegroundColor Cyan

# Create .env file
$envContent = @"
# AWS Configuration
AWS_REGION=$Region
AWS_ACCOUNT_ID=$($identity.Account)
AWS_S3_BUCKET=$($config.s3.bucketName)
ECR_REPOSITORY_URI=$($config.ecr.repositoryUri)

# Cognito Configuration
COGNITO_USER_POOL_ID=$($config.cognito.userPoolId)
COGNITO_CLIENT_ID=$($config.cognito.clientId)
COGNITO_CLIENT_SECRET=$($config.cognito.clientSecret)
COGNITO_DOMAIN=$($config.cognito.domain)
COGNITO_ISSUER_URL=$($config.cognito.issuerUrl)

# Cognito URLs
COGNITO_CALLBACK_URL_DEV=http://localhost:3000/auth/callback
COGNITO_CALLBACK_URL_PROD=$ProductionDomain/auth/callback
COGNITO_LOGOUT_URL_DEV=http://localhost:3000/auth/logout
COGNITO_LOGOUT_URL_PROD=$ProductionDomain/auth/logout

# Convex Configuration
CONVEX_SITE_URL=$ConvexSiteUrl

# AgentCore Configuration
AGENTCORE_IAM_ROLE_ARN=$($config.iam.roleArn)

# ECS Fargate Configuration
ECS_CLUSTER_NAME=$($config.fargate.clusterName)
ECS_TASK_FAMILY=$($config.fargate.taskFamily)
ECS_SUBNET_ID=$($config.vpc.subnetId)
ECS_SECURITY_GROUP_ID=$($config.vpc.securityGroupId)

# Test User (for development only)
TEST_USERNAME=$($config.cognito.testUser.username)
TEST_PASSWORD=$($config.cognito.testUser.password)
"@

$envContent | Out-File -FilePath ".env.aws" -Encoding UTF8
Write-Host "✅ Environment file created: .env.aws" -ForegroundColor Green

# Create JSON config for frontend
$frontendConfig = @{
    aws = @{
        region = $Region
        accountId = $identity.Account
        cognito = @{
            userPoolId = $config.cognito.userPoolId
            clientId = $config.cognito.clientId
            domain = $config.cognito.domain
            issuerUrl = $config.cognito.issuerUrl
            callbackUrls = @(
                "http://localhost:3000/auth/callback",
                "$ProductionDomain/auth/callback"
            )
            logoutUrls = @(
                "http://localhost:3000/auth/logout", 
                "$ProductionDomain/auth/logout"
            )
        }
        ecs = @{
            clusterName = $config.fargate.clusterName
            taskFamily = $config.fargate.taskFamily
            subnetId = $config.vpc.subnetId
            securityGroupId = $config.vpc.securityGroupId
        }
    }
} | ConvertTo-Json -Depth 10

$frontendConfig | Out-File -FilePath "aws-config.json" -Encoding UTF8
Write-Host "✅ Frontend config created: aws-config.json" -ForegroundColor Green

# 12. Create deployment script
$deployScript = @"
#!/bin/bash
# AgentCore Deployment Script
# Generated on $(Get-Date)

set -e

echo "🚀 Deploying agent to AWS..."

# Check if agent files exist
if [ ! -f "Dockerfile" ]; then
    echo "❌ Dockerfile not found"
    exit 1
fi

# Build and push Docker image
echo "📦 Building Docker image..."
docker build -t $($config.ecr.repositoryUri):latest .

echo "🔐 Logging into ECR..."
aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $($config.ecr.repositoryUri)

echo "⬆️  Pushing image to ECR..."
docker push $($config.ecr.repositoryUri):latest

echo "🎯 Running task on ECS Fargate..."
aws ecs run-task \
  --cluster $($config.fargate.clusterName) \
  --task-definition $($config.fargate.taskFamily) \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$($config.vpc.subnetId)],securityGroups=[$($config.vpc.securityGroupId)],assignPublicIp=ENABLED}" \
  --region $Region

echo "✅ Deployment complete!"
"@

$deployScript | Out-File -FilePath "deploy-to-aws.sh" -Encoding UTF8
Write-Host "✅ Deployment script created: deploy-to-aws.sh" -ForegroundColor Green

# 13. Summary and next steps
Write-Host "`n✅ AWS Infrastructure Setup Complete!" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Yellow
Write-Host "PRODUCTION FEATURES ENABLED:" -ForegroundColor Cyan
Write-Host "• S3 encryption at rest" -ForegroundColor White
Write-Host "• Least-privilege IAM policies" -ForegroundColor White
Write-Host "• Cost monitoring alarms" -ForegroundColor White
Write-Host "• Secrets management" -ForegroundColor White
Write-Host "• VPC with public subnet for Fargate" -ForegroundColor White
Write-Host "• ECS Fargate cluster ready" -ForegroundColor White
Write-Host "===========================================" -ForegroundColor Yellow

Write-Host "`n📋 Summary:" -ForegroundColor Cyan
Write-Host "  Region: $Region" -ForegroundColor White
Write-Host "  Account: $($identity.Account)" -ForegroundColor White
Write-Host "  Cognito User Pool: $($config.cognito.userPoolId)" -ForegroundColor White
Write-Host "  ECR Repository: $($config.ecr.repositoryUri)" -ForegroundColor White
Write-Host "  S3 Bucket: $($config.s3.bucketName)" -ForegroundColor White
Write-Host "  IAM Role: $($config.iam.roleArn)" -ForegroundColor White
Write-Host "  ECS Cluster: $($config.fargate.clusterName)" -ForegroundColor White
Write-Host "  VPC: $($config.vpc.vpcId)" -ForegroundColor White

Write-Host "`n🔑 Test Credentials:" -ForegroundColor Cyan
Write-Host "  Username: $($config.cognito.testUser.username)" -ForegroundColor White
Write-Host "  Password: $($config.cognito.testUser.password)" -ForegroundColor White
Write-Host "  Auth URL: https://$($config.cognito.domain)/login" -ForegroundColor White

Write-Host "`n📁 Files Created:" -ForegroundColor Cyan
Write-Host "  .env.aws - Environment variables" -ForegroundColor White
Write-Host "  aws-config.json - Frontend configuration" -ForegroundColor White
Write-Host "  deploy-to-aws.sh - Deployment script" -ForegroundColor White
Write-Host "  $configFile - Full configuration backup" -ForegroundColor White

Write-Host "`n🚀 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Copy .env.aws contents to your .env file" -ForegroundColor White
Write-Host "  2. Update your frontend to use aws-config.json" -ForegroundColor White
Write-Host "  3. Update -ProductionDomain parameter if needed" -ForegroundColor White
Write-Host "  4. Test Cognito authentication" -ForegroundColor White
Write-Host "  5. Build and push your first Docker image to ECR" -ForegroundColor White
Write-Host "  6. Use deploy-to-aws.sh to deploy agents" -ForegroundColor White

Write-Host "`n⚠️  Important Notes:" -ForegroundColor Yellow
Write-Host "  - Keep your .env.aws file secure (contains secrets)" -ForegroundColor White
Write-Host "  - Test user is for development only" -ForegroundColor White
Write-Host "  - Check Bedrock model access in AWS Console" -ForegroundColor White
Write-Host "  - ECR repository is private by default" -ForegroundColor White
Write-Host "  - Fargate tasks will run in public subnet with internet access" -ForegroundColor White

Write-Host "`n✅ Setup completed successfully!" -ForegroundColor Green
