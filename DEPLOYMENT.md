# AWS AgentCore Deployment Guide

## Cost Structure 💰

### **Always Free (24/7)**
- **Convex Backend** - Functions, database, auth (generous free tier)
- **Frontend Hosting** - Static site (Vercel/Netlify free tier)
- **AWS Cognito** - User authentication (50,000 MAU free)

### **Pay-Per-Use (Only When Active)**
- **Testing** - AWS ECS Fargate (~$0.01-0.05 per test, 30sec-5min duration)
- **Production** - AWS Bedrock AgentCore (~$0.001-0.01 per invocation)
- **Storage** - S3, ECR (minimal costs)

**🎯 Key Point**: AgentCore Runtime scales to ZERO when not used. No 24/7 charges!

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** configured with credentials
3. **Node.js 18+** and npm/yarn
4. **Convex CLI** installed globally

## Step 1: Deploy Convex Backend

First, deploy your Convex functions to production:

```bash
# Deploy to production
npx convex deploy --prod

# Note the production URL (e.g., https://your-deployment.convex.site)
```

## Step 2: Set Up AWS Infrastructure

Run the PowerShell script to create **minimal** AWS resources:

```powershell
# Run the setup script
.\scripts\setup-aws-infrastructure.ps1

# This creates ONLY what's needed:
# ✅ Cognito User Pool (authentication)
# ✅ ECR Repository (Docker images) 
# ✅ S3 Bucket (artifacts)
# ✅ IAM Role (AgentCore permissions)
# ✅ Test user credentials

# This does NOT create:
# ❌ ECS clusters (AgentCore is serverless!)
# ❌ Load balancers (AWS manages this!)
# ❌ VPCs (AgentCore handles networking!)
```

**Why so minimal?** AgentCore Runtime is completely serverless - AWS manages all the infrastructure!

## Step 3: Configure Convex Environment Variables

Add the following environment variables to your Convex production deployment:

### From .env.aws file:
```bash
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=your_client_id
COGNITO_CLIENT_SECRET=your_client_secret
COGNITO_ISSUER_URL=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_XXXXXXXXX
```

### AWS Credentials (for container orchestration):
```bash
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_REGION=us-east-1
```

### ECS Configuration (for Docker testing):
```bash
AWS_ECS_CLUSTER_ARN=arn:aws:ecs:us-east-1:account:cluster/agent-tests
AWS_ECS_TASK_DEFINITION=agent-test-task:1
AWS_ECS_SUBNETS=subnet-xxx,subnet-yyy
AWS_ECS_SECURITY_GROUP=sg-xxxxxxxxx
CLOUDWATCH_LOG_GROUP=/ecs/agent-tests
```

## Step 4: Update Frontend Configuration

Update your frontend environment variables:

```bash
# Production Convex URL
VITE_CONVEX_URL=https://your-production-deployment.convex.site

# Keep existing OAuth providers
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_secret
AUTH_GITHUB_ID=your_github_id
AUTH_GITHUB_SECRET=your_github_secret
```

## Step 5: Test the System

1. **Test Cognito Authentication**:
   - Use the test user credentials from the PowerShell script output
   - Sign in with AWS Cognito in your application

2. **Test Agent Creation**:
   - Create a new agent with Ollama or Bedrock models
   - Test in Docker environment (Ollama) or AgentCore sandbox (Bedrock)

3. **Test AWS Deployment**:
   - Deploy an agent to AWS AgentCore Runtime
   - Verify the deployment completes successfully

## Step 6: Production Deployment

Deploy your frontend to production:

```bash
# Build for production
npm run build

# Deploy to your hosting platform (Vercel, Netlify, etc.)
# Make sure to set the production environment variables
```

## Troubleshooting

### Cognito Authentication Issues
- Verify callback URLs match your production domain
- Check that Cognito User Pool is in the correct region
- Ensure client secret is properly configured

### Docker Testing Issues
- For Ollama models: Make sure Ollama is running locally
- For Bedrock models: Verify AWS credentials and model access
- Check ECS cluster and task definition are properly configured

### Deployment Issues
- Verify IAM roles have proper permissions
- Check ECR repository exists and is accessible
- Ensure AgentCore is available in your AWS region

### Environment Variables
- Double-check all environment variables are set in Convex dashboard
- Verify AWS credentials have necessary permissions
- Test AWS connectivity with `aws sts get-caller-identity`

## Cost Optimization 💡

### **Minimize Testing Costs**
- Use Ollama for local testing (completely free)
- Only use AgentCore sandbox for final validation
- Set reasonable test timeouts (default: 3 minutes)

### **Production Cost Control**
- **MinCapacity: 0** - Agents scale to zero when idle
- **Auto-scaling** - Only pay for actual usage
- **ARM64 containers** - 20-30% cheaper than x86_64
- **CloudWatch log retention** - Set to 7-30 days max

### **Monitoring Costs**
```bash
# Check your AWS costs
aws ce get-cost-and-usage --time-period Start=2024-01-01,End=2024-01-31 --granularity MONTHLY --metrics BlendedCost
```

## Security Notes

- Never commit `.env.aws` file to version control
- Use AWS Secrets Manager for production secrets
- Regularly rotate AWS access keys
- Monitor CloudWatch logs for security events
- Use least-privilege IAM policies

## Support

For issues:
1. Check CloudWatch logs first
2. Verify AWS setup with the PowerShell script
3. Test Cognito authentication flow
4. Review Convex function logs