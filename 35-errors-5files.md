Complete List of TypeScript Errors
convex/awsCrossAccount.ts (5 errors)
Line 53 - error.message - 'error' is of type 'unknown'
Line 78 - roleArn: awsAccount.roleArn - Type 'string | undefined' not assignable to 'string'
Line 90 - region: awsAccount.region - Type 'string | undefined' not assignable to 'string'
Line 100 - region: awsAccount.region - Type 'string | undefined' not assignable to 'string'
Line 138 - error: error.message - 'error' is of type 'unknown'
convex/awsDeployment.ts (7 errors)
Line 15 - deployToAWS implicitly has type 'any' (circular reference)
Line 26 - handler implicitly has return type 'any' (circular reference)
Line 34 - agent implicitly has type 'any' (circular reference)
Line 893 - deployTier1 implicitly has return type 'any' (circular reference)
Line 895 - deploymentId implicitly has type 'any' (circular reference)
Line 923 - deployTier2 implicitly has return type 'any' (circular reference)
Line 932 - deploymentId implicitly has type 'any' (circular reference)
convex/cloudFormationGenerator.ts (5 errors)
Line 82 - Property _region does not exist on type 'TemplateConfig'
Line 96 - Cannot find name 'region' (should be '_region')
Line 154 - Cannot find name 'region' (should be '_region') - 3 occurrences
convex/debuggingAgent.ts (10 errors)
Line 44 - Cannot find name 'internal'
Line 86 - Argument '"debugSessions"' not assignable (table doesn't exist)
Line 87 - Argument '"by_user"' not assignable (index doesn't exist)
Line 87 - Argument '"userId"' not assignable (field doesn't exist)
Line 104 - Cannot find name 'internal'
Line 115 - 'error' is of type 'unknown'
Line 122 - Cannot find name 'internal'
Line 135 - 'error' is of type 'unknown'
Line 142 - Cannot find name 'internal'
Line 153 - 'error' is of type 'unknown'
convex/deploymentRouter.ts (8 errors)
Line 13 - deployAgent implicitly has type 'any' (circular reference)
Line 18 - handler implicitly has return type 'any' (circular reference)
Line 63 - deployTier1 implicitly has return type 'any' (circular reference)
Line 65 - user implicitly has type 'any' (circular reference)
Line 69 - testsThisMonth implicitly has type 'any' (circular reference)
Line 83 - result implicitly has type 'any' (circular reference)
Line 110 - deployTier2 implicitly has return type 'any' (circular reference)
Line 112 - result implicitly has type 'any' (circular reference)
Total: 35 errors across 5 files