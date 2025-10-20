/**
 * CloudFormation Template Generator
 * Generates AWS infrastructure templates for agent deployment
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

  addECRRepository(): this {
    this.sections.push(
      `Resources:`,
      `  # ECR Repository for agent container`,
      `  AgentRepository:`,
      `    Type: AWS::ECR::Repository`,
      `    Properties:`,
      `      RepositoryName: !Sub '\${AgentName}-\${Environment}'`,
      `      ImageScanningConfiguration:`,
      `        ScanOnPush: true`,
      `      LifecyclePolicy:`,
      `        LifecyclePolicyText: |`,
      `          {`,
      `            "rules": [{`,
      `              "rulePriority": 1,`,
      `              "description": "Keep last ${DEFAULT_RESOURCES.ECR_IMAGE_RETENTION} images",`,
      `              "selection": {`,
      `                "tagStatus": "any",`,
      `                "countType": "imageCountMoreThan",`,
      `                "countNumber": ${DEFAULT_RESOURCES.ECR_IMAGE_RETENTION}`,
      `              },`,
      `              "action": { "type": "expire" }`,
      `            }]`,
      `          }`,
      ``
    );
    return this;
  }

  addECSCluster(): this {
    this.sections.push(
      `  # ECS Cluster`,
      `  AgentCluster:`,
      `    Type: AWS::ECS::Cluster`,
      `    Properties:`,
      `      ClusterName: !Sub '\${AgentName}-cluster-\${Environment}'`,
      `      CapacityProviders:`,
      `        - FARGATE`,
      `        - FARGATE_SPOT`,
      `      DefaultCapacityProviderStrategy:`,
      `        - CapacityProvider: FARGATE`,
      `          Weight: 1`,
      ``
    );
    return this;
  }

  addTaskDefinition(): this {
    this.sections.push(
      `  # Task Definition`,
      `  AgentTaskDefinition:`,
      `    Type: AWS::ECS::TaskDefinition`,
      `    Properties:`,
      `      Family: !Sub '\${AgentName}-task'`,
      `      NetworkMode: awsvpc`,
      `      RequiresCompatibilities:`,
      `        - FARGATE`,
      `      Cpu: '${DEFAULT_RESOURCES.ECS_CPU}'`,
      `      Memory: '${DEFAULT_RESOURCES.ECS_MEMORY}'`,
      `      ExecutionRoleArn: !GetAtt TaskExecutionRole.Arn`,
      `      TaskRoleArn: !GetAtt TaskRole.Arn`,
      `      ContainerDefinitions:`,
      `        - Name: agent`,
      `          Image: !Sub '\${AWS::AccountId}.dkr.ecr.\${AWS::Region}.amazonaws.com/\${AgentRepository}:latest'`,
      `          Essential: true`,
      `          PortMappings:`,
      `            - ContainerPort: ${DEFAULT_RESOURCES.CONTAINER_PORT}`,
      `              Protocol: tcp`,
      `          LogConfiguration:`,
      `            LogDriver: awslogs`,
      `            Options:`,
      `              awslogs-group: !Ref AgentLogGroup`,
      `              awslogs-region: !Ref AWS::Region`,
      `              awslogs-stream-prefix: agent`,
      `          Environment:`,
      `            - Name: AGENT_NAME`,
      `              Value: !Ref AgentName`,
      `            - Name: ENVIRONMENT`,
      `              Value: !Ref Environment`,
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
      `      LogGroupName: !Sub '/ecs/\${AgentName}'`,
      `      RetentionInDays: ${DEFAULT_RESOURCES.LOG_RETENTION_DAYS}`,
      ``
    );
    return this;
  }

  addIAMRoles(): this {
    this.sections.push(
      `  # IAM Roles`,
      `  TaskExecutionRole:`,
      `    Type: AWS::IAM::Role`,
      `    Properties:`,
      `      AssumeRolePolicyDocument:`,
      `        Statement:`,
      `          - Effect: Allow`,
      `            Principal:`,
      `              Service: ecs-tasks.amazonaws.com`,
      `            Action: sts:AssumeRole`,
      `      ManagedPolicyArns:`,
      `        - arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy`,
      ``,
      `  TaskRole:`,
      `    Type: AWS::IAM::Role`,
      `    Properties:`,
      `      AssumeRolePolicyDocument:`,
      `        Statement:`,
      `          - Effect: Allow`,
      `            Principal:`,
      `              Service: ecs-tasks.amazonaws.com`,
      `            Action: sts:AssumeRole`,
      `      Policies:`,
      `        - PolicyName: BedrockAccess`,
      `          PolicyDocument:`,
      `            Statement:`,
      `              - Effect: Allow`,
      `                Action:`,
      `                  - bedrock:InvokeModel`,
      `                  - bedrock:InvokeModelWithResponseStream`,
      `                Resource: '*'`,
      ``
    );
    return this;
  }

  addOutputs(): this {
    this.sections.push(
      `Outputs:`,
      `  RepositoryUri:`,
      `    Description: ECR Repository URI`,
      `    Value: !GetAtt AgentRepository.RepositoryUri`,
      `    Export:`,
      `      Name: !Sub '\${AWS::StackName}-RepositoryUri'`,
      ``,
      `  ClusterName:`,
      `    Description: ECS Cluster Name`,
      `    Value: !Ref AgentCluster`,
      `    Export:`,
      `      Name: !Sub '\${AWS::StackName}-ClusterName'`,
      ``,
      `  TaskDefinitionArn:`,
      `    Description: Task Definition ARN`,
      `    Value: !Ref AgentTaskDefinition`,
      `    Export:`,
      `      Name: !Sub '\${AWS::StackName}-TaskDefinitionArn'`
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
    .addECRRepository()
    .addECSCluster()
    .addTaskDefinition()
    .addCloudWatchLogs()
    .addIAMRoles()
    .addOutputs()
    .build();
}
