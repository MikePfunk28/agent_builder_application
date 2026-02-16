/**
 * CloudFormation Template Generator
 * Generates AWS infrastructure templates for Bedrock AgentCore deployment
 */

import { DEFAULT_RESOURCES, sanitizeAgentName } from "../constants";

interface Agent {
  name: string;
  deploymentType: string;
}

/**
 * Generate CloudFormation template sections
 */
class CloudFormationBuilder {
  private sections: string[] = [];

  addHeader(agent: Agent): this {
    this.sections.push(
      `AWSTemplateFormatVersion: '2010-09-09'`,
      `Description: >`,
      `  ${agent.name} - AI Agent powered by Strands Agents`,
      `  Deployed via Agent Builder Application`,
      ``
    );
    return this;
  }

  addParameters(agent: Agent): this {
    const sanitizedName = sanitizeAgentName(agent.name);
    this.sections.push(
      `Parameters:`,
      `  AgentName:`,
      `    Type: String`,
      `    Default: ${sanitizedName}`,
      `    Description: Name of the agent`,
      ``,
      `  Environment:`,
      `    Type: String`,
      `    Default: prod`,
      `    AllowedValues:`,
      `      - dev`,
      `      - staging`,
      `      - prod`,
      `    Description: Deployment environment`,
      ``
    );
    return this;
  }

  addS3Bucket(): this {
    this.sections.push(
      `Resources:`,
      `  # S3 Bucket for agent artifacts`,
      `  AgentArtifactsBucket:`,
      `    Type: AWS::S3::Bucket`,
      `    Properties:`,
      `      BucketName: !Sub '\${AgentName}-\${Environment}-\${AWS::AccountId}-artifacts'`,
      `      BucketEncryption:`,
      `        ServerSideEncryptionConfiguration:`,
      `          - ServerSideEncryptionByDefault:`,
      `              SSEAlgorithm: AES256`,
      `      PublicAccessBlockConfiguration:`,
      `        BlockPublicAcls: true`,
      `        BlockPublicPolicy: true`,
      `        IgnorePublicAcls: true`,
      `        RestrictPublicBuckets: true`,
      `      VersioningConfiguration:`,
      `        Status: Enabled`,
      ``
    );
    return this;
  }

  addCloudWatchLogs(): this {
    this.sections.push(
      `  # CloudWatch Log Group`,
      `  AgentLogGroup:`,
      `    Type: AWS::Logs::LogGroup`,
      `    Properties:`,
      `      LogGroupName: !Sub '/aws/agentcore/\${AgentName}'`,
      `      RetentionInDays: ${DEFAULT_RESOURCES.LOG_RETENTION_DAYS}`,
      ``
    );
    return this;
  }

  addIAMRoles(): this {
    this.sections.push(
      `  # IAM Roles`,
      `  AgentCoreExecutionRole:`,
      `    Type: AWS::IAM::Role`,
      `    Properties:`,
      `      RoleName: !Sub '\${AgentName}-\${Environment}-agentcore-role'`,
      `      AssumeRolePolicyDocument:`,
      `        Statement:`,
      `          - Effect: Allow`,
      `            Principal:`,
      `              Service: bedrock.amazonaws.com`,
      `            Action: sts:AssumeRole`,
      `      ManagedPolicyArns:`,
      `        - arn:aws:iam::aws:policy/AmazonBedrockFullAccess`,
      `      Policies:`,
      `        - PolicyName: AgentCoreAccess`,
      `          PolicyDocument:`,
      `            Statement:`,
      `              - Effect: Allow`,
      `                Action:`,
      `                  - bedrock:InvokeModel`,
      `                  - bedrock:InvokeModelWithResponseStream`,
      `                  - s3:GetObject`,
      `                  - s3:PutObject`,
      `                  - logs:CreateLogGroup`,
      `                  - logs:CreateLogStream`,
      `                  - logs:PutLogEvents`,
      `                Resource: '*'`,
      ``
    );
    return this;
  }

  addSecretsManager(): this {
    this.sections.push(
      `  # Secrets Manager for agent configuration`,
      `  AgentSecrets:`,
      `    Type: AWS::SecretsManager::Secret`,
      `    Properties:`,
      `      Name: !Sub '\${AgentName}-\${Environment}-secrets'`,
      `      Description: !Sub 'Secrets for \${AgentName} agent'`,
      ``
    );
    return this;
  }

  addOutputs(): this {
    this.sections.push(
      `Outputs:`,
      `  AgentCoreRoleArn:`,
      `    Description: AgentCore Execution Role ARN`,
      `    Value: !GetAtt AgentCoreExecutionRole.Arn`,
      `    Export:`,
      `      Name: !Sub '\${AWS::StackName}-RoleArn'`,
      ``,
      `  ArtifactsBucketName:`,
      `    Description: S3 Bucket for agent artifacts`,
      `    Value: !Ref AgentArtifactsBucket`,
      `    Export:`,
      `      Name: !Sub '\${AWS::StackName}-ArtifactsBucket'`,
      ``,
      `  LogGroupName:`,
      `    Description: CloudWatch Log Group`,
      `    Value: !Ref AgentLogGroup`,
      `    Export:`,
      `      Name: !Sub '\${AWS::StackName}-LogGroup'`
    );
    return this;
  }

  build(): string {
    return this.sections.join('\n');
  }
}

/**
 * Generate complete CloudFormation template
 */
export function generateCloudFormationTemplate(agent: Agent): string {
  return new CloudFormationBuilder()
    .addHeader(agent)
    .addParameters(agent)
    .addS3Bucket()
    .addCloudWatchLogs()
    .addIAMRoles()
    .addSecretsManager()
    .addOutputs()
    .build();
}
