# AWS 3-Tier SaaS Infrastructure

> Complete AWS setup for AI Agent Builder Platform with freemium, self-service, and enterprise tiers.

## 🎯 Quick Links

### Getting Started
- **[Start Here: Setup Summary](AWS-SETUP-SUMMARY.md)** - Quick overview and checklist
- **[Complete Guide](COMPLETE-SETUP-GUIDE.md)** - Detailed implementation guide
- **[Implementation Complete](IMPLEMENTATION-COMPLETE.md)** - ✨ NEW! Cross-account setup done

### Cross-Account (Tier 2)
- **[Cross-Account Checklist](CROSS-ACCOUNT-SETUP-CHECKLIST.md)** - ✨ NEW! Step-by-step implementation
- **[Environment Variables Guide](docs/environment-variables-guide.md)** - ✨ NEW! All env vars explained

### Architecture & Commands
- **[Architecture Diagrams](docs/aws-3-tier-architecture-diagram.md)** - Visual architecture
- **[Command Reference](docs/quick-start-commands.md)** - All commands in one place
- **[3-Tier Guide](docs/3-tier-architecture-guide.md)** - Architecture deep dive

## 📦 What's Included

### Essential Scripts (4 Total)
| Script | Purpose | When to Run |
|--------|---------|-------------|
| `setup-aws-infrastructure.ps1` | Setup YOUR platform | Once (first time) |
| `user-aws-onboarding.ps1` | User connects THEIR AWS | Users run this |
| `verify-aws-setup.ps1` | Verify everything works | After setup |
| `teardown-aws-infrastructure.ps1` | Clean shutdown | After hackathon |

### CloudFormation (Alternative)
| File | Purpose |
|------|---------|
| `user-onboarding-template.yaml` | One-click user onboarding |
| `cloudformation/README.md` | CloudFormation instructions |

### Documentation
| File | Content |
|------|---------|
| `AWS-SETUP-SUMMARY.md` | Quick reference |
| `COMPLETE-SETUP-GUIDE.md` | Master guide |
| `docs/3-tier-architecture-guide.md` | Architecture details |
| `docs/quick-start-commands.md` | Command reference |
| `docs/aws-3-tier-architecture-diagram.md` | Visual diagrams |

## 🚀 5-Minute Setup

```powershell
# 1. Setup your platform infrastructure
.\scripts\setup-aws-infrastructure.ps1 `
  -ProjectName "agent-builder" `
  -ProductionDomain "https://ai-forge.mikepfunk.com" `
  -ConvexSiteUrl "https://api.mikepfunk.com"

# 2. Verify everything is configured
.\scripts\verify-aws-setup.ps1

# 3. Copy environment variables
cat .env.aws >> .env

# 4. You're ready! 🎉
```

## 🏗️ Architecture Overview

### Tier 1: Freemium
- Users test on YOUR infrastructure
- Free for them, you pay ~$72/month for 100 users
- Limited to 10 tests/month per user

### Tier 2: Self-Service
- Users deploy to THEIR AWS account
- They pay their own costs (~$5-20/month)
- You pay $0

### Tier 3: Enterprise
- AWS SSO integration
- Deploy to organization accounts
- They pay their own costs (~$240-1,040/month)
- You pay $0

## 💰 Cost Summary

| Tier | Who Pays | Monthly Cost |
|------|----------|--------------|
| Tier 1 (100 users) | You | ~$72 |
| Tier 2 (per user) | User | ~$5-20 |
| Tier 3 (per org) | Enterprise | ~$240-1,040 |
| After Teardown | Nobody | $0 |

## 🧹 Cleanup

```powershell
# Preview what will be deleted
.\scripts\teardown-aws-infrastructure.ps1 -DryRun

# Actually delete everything
.\scripts\teardown-aws-infrastructure.ps1 -Force
```

## 📊 Architecture Diagram

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

See [full diagrams](docs/aws-3-tier-architecture-diagram.md) for detailed architecture.

## 🔒 Security

- ✅ External ID prevents confused deputy attacks
- ✅ Least-privilege IAM policies
- ✅ Scoped resource creation
- ✅ Users can revoke access anytime
- ✅ Complete audit trail
- ✅ No access to user's other resources

## 📚 Documentation Structure

```
.
├── AWS-README.md (this file)
├── AWS-SETUP-SUMMARY.md (quick reference)
├── COMPLETE-SETUP-GUIDE.md (master guide)
│
├── scripts/
│   ├── setup-aws-infrastructure.ps1
│   ├── user-aws-onboarding.ps1
│   ├── verify-aws-setup.ps1
│   └── teardown-aws-infrastructure.ps1
│
├── cloudformation/
│   ├── user-onboarding-template.yaml
│   └── README.md
│
└── docs/
    ├── 3-tier-architecture-guide.md
    ├── quick-start-commands.md
    └── aws-3-tier-architecture-diagram.md
```

## ✅ Verification

After setup, verify everything is working:

```powershell
.\scripts\verify-aws-setup.ps1
```

Should show:
- ✅ AWS credentials configured
- ✅ ECR repository created
- ✅ S3 bucket created
- ✅ IAM roles configured
- ✅ VPC and networking ready
- ✅ ECS cluster ready
- ✅ CloudWatch monitoring active

## 🆘 Troubleshooting

### Setup Issues
```powershell
# Check AWS credentials
aws sts get-caller-identity

# Verify region support
aws bedrock list-foundation-models --region us-east-1
```

### Verification Issues
```powershell
# Run detailed check
.\scripts\verify-aws-setup.ps1 -Detailed
```

### Teardown Issues
```powershell
# Preview deletion
.\scripts\teardown-aws-infrastructure.ps1 -DryRun
```

## 🎓 Implementation Phases

1. **Platform Setup** (30 min) - Run setup script
2. **Tier 1 Implementation** (2 hours) - Freemium testing
3. **Tier 2 Implementation** (4 hours) - User AWS accounts
4. **Tier 3 Implementation** (6 hours, optional) - Enterprise SSO
5. **Polish** (2 hours) - Error handling, UI improvements

See [COMPLETE-SETUP-GUIDE.md](COMPLETE-SETUP-GUIDE.md) for detailed steps.

## 📞 Support

- **AWS Docs**: https://docs.aws.amazon.com/
- **Bedrock**: https://docs.aws.amazon.com/bedrock/
- **ECS Fargate**: https://docs.aws.amazon.com/AmazonECS/
- **Cost Calculator**: https://calculator.aws/

## 🎉 Ready to Start?

```powershell
# Let's build! 🚀
.\scripts\setup-aws-infrastructure.ps1
```

---

**Questions?** Check the documentation links above or run `.\scripts\verify-aws-setup.ps1` for diagnostics.

**Good luck with your hackathon!** 🎊
