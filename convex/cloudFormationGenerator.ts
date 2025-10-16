/**
 * Production-Ready CloudFormation Template Generator
 * 
 * Generates comprehensive AWS infrastructure templates for AgentCore deployment
 * with security, monitoring, and scalability best practices.
 */

import { action } from "./_generated/server";
import { v } from "convex/values";

export const generateCloudFormationTemplate = action({
  args: {
    agentName: v.string(),
    model: v.string(),
    tools: v.array(v.any()),
    region: v.optional(v.string()),
    environment: v.optional(v.string()), // dev, staging, prod
    vpcConfig: v.optional(v.object({
      createVpc: v.boolean(),
      vpcCidr: v.optional(v.string()),
      availabilityZones: v.optional(v.array(v.string())),
    })),
    monitoring: v.optional(v.object({
      enableXRay: v.boolean(),
      enableCloudWatch: v.boolean(),
      logRetentionDays: v.optional(v.number()),
    })),
    scaling: v.optional(v.object({
      minCapacity: v.optional(v.number()),
      maxCapacity: v.optional(v.number()),
      targetCpuUtilization: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const {
      agentName,
      model,
      tools,
      region = "us-east-1",
      environment = "prod",
      vpcConfig = { createVpc: true, vpcCidr: "10.0.0.0/16" },
      monitoring = { enableXRay: true, enableCloudWatch: true, logRetentionDays: 30 },
      scaling = { minCapacity: 0, maxCapacity: 10, targetCpuUtilization: 70 },
    } = args;

    const template = generateProductionCloudFormationTemplate({
      agentName,
      model,
      tools,
      region,
      environment,
      vpcConfig,
      monitoring,
      scaling,
    });

    return {
      template,
      templateUrl: null, // Could upload to S3 and return URL
      stackName: `${agentName}-${environment}-stack`,
      parameters: generateStackParameters(args),
    };
  },
});

interface TemplateConfig {
  agentName: string;
  model: string;
  tools: any[];
  region: string;
  environment: string;
  vpcConfig: any;
  monitoring: any;
  scaling: any;
}

function generateProductionCloudFormationTemplate(config: TemplateConfig): string {
  const {
    agentName,
    model,
    region,
    environment,
    vpcConfig,
    monitoring,
    scaling,
  } = config;

  const _stackName = `${agentName}-${environment}`;
  const _resourcePrefix = _stackName.replace(/[^a-zA-Z0-9]/g, '');
  const _tools = config.tools; // Keep tools reference
  const _region = region; // Fix: use _region instead of region

  return `AWSTemplateFormatVersion: '2010-09-09'
Description: >
  Production AgentCore deployment for ${agentName}
  Environment: ${environment}
  Region: ${_region}
  Generated: ${new Date().toISOString()}

Metadata:
  AWS::CloudFormation::Interface:
    ParameterGroups:
      - Label:
          default: "Agent Configuration"
        Parameters:
          - AgentName
          - Environment
          - ModelId
      - Label:
          default: "Infrastructure Configuration"
        Parameters:
          - VpcCidr
          - AvailabilityZones
          - InstanceType
      - Label:
          default: "Scaling Configuration"
        Parameters:
          - MinCapacity
          - MaxCapacity
          - TargetCpuUtilization
      - Label:
          default: "Monitoring Configuration"
        Parameters:
          - LogRetentionDays
          - EnableXRay
          - EnableDetailedMonitoring

Parameters:
  AgentName:
    Type: String
    Default: ${agentName}
    Description: Name of the agent
    AllowedPattern: '^[a-zA-Z0-9-]+$'
    ConstraintDescription: Must contain only alphanumeric characters and hyphens

  Environment:
    Type: String
    Default: ${environment}
    AllowedValues: [dev, staging, prod]
    Description: Deployment environment

  ModelId:
    Type: String
    Default: ${model}
    Description: AI model identifier

  VpcCidr:
    Type: String
    Default: ${vpcConfig.vpcCidr || '10.0.0.0/16'}
    Description: CIDR block for VPC
    AllowedPattern: '^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])(\\/(1[6-9]|2[0-8]))$'

  AvailabilityZones:
    Type: CommaDelimitedList
    Default: ${_region}a,${_region}b,${_region}c
    Description: List of Availability Zones

  InstanceType:
    Type: String
    Default: t3.medium
    AllowedValues: [t3.small, t3.medium, t3.large, t3.xlarge, m5.large, m5.xlarge, m5.2xlarge]
    Description: EC2 instance type for ECS tasks

  MinCapacity:
    Type: Number
    Default: ${scaling.minCapacity}
    MinValue: 0
    MaxValue: 100
    Description: Minimum number of tasks

  MaxCapacity:
    Type: Number
    Default: ${scaling.maxCapacity}
    MinValue: 1
    MaxValue: 100
    Description: Maximum number of tasks

  TargetCpuUtilization:
    Type: Number
    Default: ${scaling.targetCpuUtilization}
    MinValue: 10
    MaxValue: 90
    Description: Target CPU utilization percentage

  LogRetentionDays:
    Type: Number
    Default: ${monitoring.logRetentionDays}
    AllowedValues: [1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653]
    Description: CloudWatch log retention period

  EnableXRay:
    Type: String
    Default: ${monitoring.enableXRay ? 'true' : 'false'}
    AllowedValues: [true, false]
    Description: Enable AWS X-Ray tracing

  EnableDetailedMonitoring:
    Type: String
    Default: true
    AllowedValues: [true, false]
    Description: Enable detailed CloudWatch monitoring

Conditions:
  CreateVpc: !Equals [${vpcConfig.createVpc}, true]
  EnableXRayTracing: !Equals [!Ref EnableXRay, 'true']
  EnableDetailedCloudWatch: !Equals [!Ref EnableDetailedMonitoring, 'true']
  IsProduction: !Equals [!Ref Environment, 'prod']

Resources:
  # ============================================================================
  # VPC and Networking
  # ============================================================================
  VPC:
    Type: AWS::EC2::VPC
    Condition: CreateVpc
    Properties:
      CidrBlock: !Ref VpcCidr
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub '\${AgentName}-\${Environment}-vpc'
        - Key: Environment
          Value: !Ref Environment
        - Key: Project
          Value: !Ref AgentName

  InternetGateway:
    Type: AWS::EC2::InternetGateway
    Condition: CreateVpc
    Properties:
      Tags:
        - Key: Name
          Value: !Sub '\${AgentName}-\${Environment}-igw'

  InternetGatewayAttachment:
    Type: AWS::EC2::VPCGatewayAttachment
    Condition: CreateVpc
    Properties:
      InternetGatewayId: !Ref InternetGateway
      VpcId: !Ref VPC

  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Condition: CreateVpc
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [0, !Ref AvailabilityZones]
      CidrBlock: !Select [0, !Cidr [!Ref VpcCidr, 6, 8]]
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub '\${AgentName}-\${Environment}-public-subnet-1'

  PublicSubnet2:
    Type: AWS::EC2::Subnet
    Condition: CreateVpc
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [1, !Ref AvailabilityZones]
      CidrBlock: !Select [1, !Cidr [!Ref VpcCidr, 6, 8]]
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub '\${AgentName}-\${Environment}-public-subnet-2'

  PrivateSubnet1:
    Type: AWS::EC2::Subnet
    Condition: CreateVpc
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [0, !Ref AvailabilityZones]
      CidrBlock: !Select [2, !Cidr [!Ref VpcCidr, 6, 8]]
      Tags:
        - Key: Name
          Value: !Sub '\${AgentName}-\${Environment}-private-subnet-1'

  PrivateSubnet2:
    Type: AWS::EC2::Subnet
    Condition: CreateVpc
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [1, !Ref AvailabilityZones]
      CidrBlock: !Select [3, !Cidr [!Ref VpcCidr, 6, 8]]
      Tags:
        - Key: Name
          Value: !Sub '\${AgentName}-\${Environment}-private-subnet-2'

  NatGateway1EIP:
    Type: AWS::EC2::EIP
    Condition: CreateVpc
    DependsOn: InternetGatewayAttachment
    Properties:
      Domain: vpc
      Tags:
        - Key: Name
          Value: !Sub '\${AgentName}-\${Environment}-nat-eip-1'

  NatGateway2EIP:
    Type: AWS::EC2::EIP
    Condition: CreateVpc
    DependsOn: InternetGatewayAttachment
    Properties:
      Domain: vpc
      Tags:
        - Key: Name
          Value: !Sub '\${AgentName}-\${Environment}-nat-eip-2'

  NatGateway1:
    Type: AWS::EC2::NatGateway
    Condition: CreateVpc
    Properties:
      AllocationId: !GetAtt NatGateway1EIP.AllocationId
      SubnetId: !Ref PublicSubnet1
      Tags:
        - Key: Name
          Value: !Sub '\${AgentName}-\${Environment}-nat-1'

  NatGateway2:
    Type: AWS::EC2::NatGateway
    Condition: CreateVpc
    Properties:
      AllocationId: !GetAtt NatGateway2EIP.AllocationId
      SubnetId: !Ref PublicSubnet2
      Tags:
        - Key: Name
          Value: !Sub '\${AgentName}-\${Environment}-nat-2'

  PublicRouteTable:
    Type: AWS::EC2::RouteTable
    Condition: CreateVpc
    Properties:
      VpcId: !Ref VPC
      Tags:
        - Key: Name
          Value: !Sub '\${AgentName}-\${Environment}-public-routes'

  DefaultPublicRoute:
    Type: AWS::EC2::Route
    Condition: CreateVpc
    DependsOn: InternetGatewayAttachment
    Properties:
      RouteTableId: !Ref PublicRouteTable
      DestinationCidrBlock: 0.0.0.0/0
      GatewayId: !Ref InternetGateway

  PublicSubnet1RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Condition: CreateVpc
    Properties:
      RouteTableId: !Ref PublicRouteTable
      SubnetId: !Ref PublicSubnet1

  PublicSubnet2RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Condition: CreateVpc
    Properties:
      RouteTableId: !Ref PublicRouteTable
      SubnetId: !Ref PublicSubnet2

  PrivateRouteTable1:
    Type: AWS::EC2::RouteTable
    Condition: CreateVpc
    Properties:
      VpcId: !Ref VPC
      Tags:
        - Key: Name
          Value: !Sub '\${AgentName}-\${Environment}-private-routes-1'

  DefaultPrivateRoute1:
    Type: AWS::EC2::Route
    Condition: CreateVpc
    Properties:
      RouteTableId: !Ref PrivateRouteTable1
      DestinationCidrBlock: 0.0.0.0/0
      NatGatewayId: !Ref NatGateway1

  PrivateSubnet1RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Condition: CreateVpc
    Properties:
      RouteTableId: !Ref PrivateRouteTable1
      SubnetId: !Ref PrivateSubnet1

  PrivateRouteTable2:
    Type: AWS::EC2::RouteTable
    Condition: CreateVpc
    Properties:
      VpcId: !Ref VPC
      Tags:
        - Key: Name
          Value: !Sub '\${AgentName}-\${Environment}-private-routes-2'

  DefaultPrivateRoute2:
    Type: AWS::EC2::Route
    Condition: CreateVpc
    Properties:
      RouteTableId: !Ref PrivateRouteTable2
      DestinationCidrBlock: 0.0.0.0/0
      NatGatewayId: !Ref NatGateway2

  PrivateSubnet2RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Condition: CreateVpc
    Properties:
      RouteTableId: !Ref PrivateRouteTable2
      SubnetId: !Ref PrivateSubnet2

  # ============================================================================
  # Security Groups
  # ============================================================================
  AgentCoreSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupName: !Sub '\${AgentName}-\${Environment}-agentcore-sg'
      GroupDescription: Security group for AgentCore tasks
      VpcId: !If [CreateVpc, !Ref VPC, !Ref 'AWS::NoValue']
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 8080
          ToPort: 8080
          SourceSecurityGroupId: !Ref LoadBalancerSecurityGroup
          Description: Allow traffic from load balancer
      SecurityGroupEgress:
        - IpProtocol: -1
          CidrIp: 0.0.0.0/0
          Description: Allow all outbound traffic
      Tags:
        - Key: Name
          Value: !Sub '\${AgentName}-\${Environment}-agentcore-sg'
        - Key: Environment
          Value: !Ref Environment

  LoadBalancerSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupName: !Sub '\${AgentName}-\${Environment}-alb-sg'
      GroupDescription: Security group for Application Load Balancer
      VpcId: !If [CreateVpc, !Ref VPC, !Ref 'AWS::NoValue']
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0
          Description: Allow HTTP traffic
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: 0.0.0.0/0
          Description: Allow HTTPS traffic
      Tags:
        - Key: Name
          Value: !Sub '\${AgentName}-\${Environment}-alb-sg'

  # ============================================================================
  # IAM Roles and Policies
  # ============================================================================
  AgentCoreTaskRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: !Sub '\${AgentName}-\${Environment}-task-role'
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: ecs-tasks.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/AmazonBedrockFullAccess
        - !If [EnableXRayTracing, 'arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess', !Ref 'AWS::NoValue']
      Policies:
        - PolicyName: AgentCoreTaskPolicy
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - logs:CreateLogGroup
                  - logs:CreateLogStream
                  - logs:PutLogEvents
                  - logs:DescribeLogStreams
                Resource: !Sub 'arn:aws:logs:\${AWS::Region}:\${AWS::AccountId}:log-group:/aws/ecs/\${AgentName}-\${Environment}*'
              - Effect: Allow
                Action:
                  - s3:GetObject
                  - s3:PutObject
                  - s3:DeleteObject
                Resource: !Sub '\${AgentCoreS3Bucket}/*'
              - Effect: Allow
                Action:
                  - secretsmanager:GetSecretValue
                Resource: !Ref AgentCoreSecrets
      Tags:
        - Key: Environment
          Value: !Ref Environment

  AgentCoreExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: !Sub '\${AgentName}-\${Environment}-execution-role'
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: ecs-tasks.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
      Policies:
        - PolicyName: AgentCoreExecutionPolicy
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - ecr:GetAuthorizationToken
                  - ecr:BatchCheckLayerAvailability
                  - ecr:GetDownloadUrlForLayer
                  - ecr:BatchGetImage
                Resource: '*'
              - Effect: Allow
                Action:
                  - secretsmanager:GetSecretValue
                Resource: !Ref AgentCoreSecrets
      Tags:
        - Key: Environment
          Value: !Ref Environment

  # ============================================================================
  # Storage and Secrets
  # ============================================================================
  AgentCoreS3Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub '\${AgentName}-\${Environment}-\${AWS::AccountId}-storage'
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: AES256
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true
      VersioningConfiguration:
        Status: Enabled
      LifecycleConfiguration:
        Rules:
          - Id: DeleteOldVersions
            Status: Enabled
            NoncurrentVersionExpirationInDays: 30
      Tags:
        - Key: Environment
          Value: !Ref Environment

  AgentCoreSecrets:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: !Sub '\${AgentName}-\${Environment}-secrets'
      Description: Secrets for AgentCore agent
      SecretString: !Sub |
        {
          "MODEL_ID": "\${ModelId}",
          "AWS_REGION": "\${AWS::Region}",
          "ENVIRONMENT": "\${Environment}",
          "AGENT_NAME": "\${AgentName}"
        }
      Tags:
        - Key: Environment
          Value: !Ref Environment

  # ============================================================================
  # ECR Repository
  # ============================================================================
  AgentCoreECRRepository:
    Type: AWS::ECR::Repository
    Properties:
      RepositoryName: !Sub '\${AgentName}-\${Environment}'
      ImageScanningConfiguration:
        ScanOnPush: true
      ImageTagMutability: MUTABLE
      LifecyclePolicy:
        LifecyclePolicyText: |
          {
            "rules": [
              {
                "rulePriority": 1,
                "description": "Keep last 10 images",
                "selection": {
                  "tagStatus": "any",
                  "countType": "imageCountMoreThan",
                  "countNumber": 10
                },
                "action": {
                  "type": "expire"
                }
              }
            ]
          }
      Tags:
        - Key: Environment
          Value: !Ref Environment

  # ============================================================================
  # ECS Cluster and Service
  # ============================================================================
  AgentCoreCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: !Sub '\${AgentName}-\${Environment}-cluster'
      CapacityProviders:
        - FARGATE
        - FARGATE_SPOT
      DefaultCapacityProviderStrategy:
        - CapacityProvider: FARGATE
          Weight: 1
        - CapacityProvider: FARGATE_SPOT
          Weight: !If [IsProduction, 0, 1]
      ClusterSettings:
        - Name: containerInsights
          Value: !If [EnableDetailedCloudWatch, enabled, disabled]
      Tags:
        - Key: Environment
          Value: !Ref Environment

  AgentCoreLogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: !Sub '/aws/ecs/\${AgentName}-\${Environment}'
      RetentionInDays: !Ref LogRetentionDays
      Tags:
        - Key: Environment
          Value: !Ref Environment

  AgentCoreTaskDefinition:
    Type: AWS::ECS::TaskDefinition
    Properties:
      Family: !Sub '\${AgentName}-\${Environment}'
      Cpu: 1024
      Memory: 2048
      NetworkMode: awsvpc
      RequiresCompatibilities:
        - FARGATE
      ExecutionRoleArn: !GetAtt AgentCoreExecutionRole.Arn
      TaskRoleArn: !GetAtt AgentCoreTaskRole.Arn
      ContainerDefinitions:
        - Name: agentcore
          Image: !Sub '\${AWS::AccountId}.dkr.ecr.\${AWS::Region}.amazonaws.com/\${AgentName}-\${Environment}:latest'
          PortMappings:
            - ContainerPort: 8080
              Protocol: tcp
          Environment:
            - Name: AWS_REGION
              Value: !Ref 'AWS::Region'
            - Name: ENVIRONMENT
              Value: !Ref Environment
            - Name: AGENT_NAME
              Value: !Ref AgentName
          Secrets:
            - Name: MODEL_ID
              ValueFrom: !Sub '\${AgentCoreSecrets}:MODEL_ID::'
          LogConfiguration:
            LogDriver: awslogs
            Options:
              awslogs-group: !Ref AgentCoreLogGroup
              awslogs-region: !Ref 'AWS::Region'
              awslogs-stream-prefix: ecs
          HealthCheck:
            Command:
              - CMD-SHELL
              - curl -f http://localhost:8080/ping || exit 1
            Interval: 30
            Timeout: 5
            Retries: 3
            StartPeriod: 60
      Tags:
        - Key: Environment
          Value: !Ref Environment

  AgentCoreService:
    Type: AWS::ECS::Service
    DependsOn: LoadBalancerListener
    Properties:
      ServiceName: !Sub '\${AgentName}-\${Environment}-service'
      Cluster: !Ref AgentCoreCluster
      TaskDefinition: !Ref AgentCoreTaskDefinition
      DesiredCount: !Ref MinCapacity
      LaunchType: FARGATE
      NetworkConfiguration:
        AwsvpcConfiguration:
          SecurityGroups:
            - !Ref AgentCoreSecurityGroup
          Subnets:
            - !If [CreateVpc, !Ref PrivateSubnet1, !Ref 'AWS::NoValue']
            - !If [CreateVpc, !Ref PrivateSubnet2, !Ref 'AWS::NoValue']
          AssignPublicIp: DISABLED
      LoadBalancers:
        - ContainerName: agentcore
          ContainerPort: 8080
          TargetGroupArn: !Ref AgentCoreTargetGroup
      DeploymentConfiguration:
        MaximumPercent: 200
        MinimumHealthyPercent: 50
        DeploymentCircuitBreaker:
          Enable: true
          Rollback: true
      EnableExecuteCommand: !If [IsProduction, false, true]
      Tags:
        - Key: Environment
          Value: !Ref Environment

  # ============================================================================
  # Load Balancer
  # ============================================================================
  AgentCoreLoadBalancer:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Name: !Sub '\${AgentName}-\${Environment}-alb'
      Scheme: internet-facing
      Type: application
      SecurityGroups:
        - !Ref LoadBalancerSecurityGroup
      Subnets:
        - !If [CreateVpc, !Ref PublicSubnet1, !Ref 'AWS::NoValue']
        - !If [CreateVpc, !Ref PublicSubnet2, !Ref 'AWS::NoValue']
      Tags:
        - Key: Environment
          Value: !Ref Environment

  AgentCoreTargetGroup:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      Name: !Sub '\${AgentName}-\${Environment}-tg'
      Port: 8080
      Protocol: HTTP
      VpcId: !If [CreateVpc, !Ref VPC, !Ref 'AWS::NoValue']
      TargetType: ip
      HealthCheckPath: /ping
      HealthCheckProtocol: HTTP
      HealthCheckIntervalSeconds: 30
      HealthCheckTimeoutSeconds: 5
      HealthyThresholdCount: 2
      UnhealthyThresholdCount: 3
      Matcher:
        HttpCode: 200
      Tags:
        - Key: Environment
          Value: !Ref Environment

  LoadBalancerListener:
    Type: AWS::ElasticLoadBalancingV2::Listener
    Properties:
      DefaultActions:
        - Type: forward
          TargetGroupArn: !Ref AgentCoreTargetGroup
      LoadBalancerArn: !Ref AgentCoreLoadBalancer
      Port: 80
      Protocol: HTTP

  # ============================================================================
  # Auto Scaling
  # ============================================================================
  AgentCoreAutoScalingTarget:
    Type: AWS::ApplicationAutoScaling::ScalableTarget
    Properties:
      MaxCapacity: !Ref MaxCapacity
      MinCapacity: !Ref MinCapacity
      ResourceId: !Sub 'service/\${AgentCoreCluster}/\${AgentCoreService.Name}'
      RoleARN: !Sub 'arn:aws:iam::\${AWS::AccountId}:role/aws-service-role/ecs.application-autoscaling.amazonaws.com/AWSServiceRoleForApplicationAutoScaling_ECSService'
      ScalableDimension: ecs:service:DesiredCount
      ServiceNamespace: ecs

  AgentCoreAutoScalingPolicy:
    Type: AWS::ApplicationAutoScaling::ScalingPolicy
    Properties:
      PolicyName: !Sub '\${AgentName}-\${Environment}-scaling-policy'
      PolicyType: TargetTrackingScaling
      ScalingTargetId: !Ref AgentCoreAutoScalingTarget
      TargetTrackingScalingPolicyConfiguration:
        PredefinedMetricSpecification:
          PredefinedMetricType: ECSServiceAverageCPUUtilization
        TargetValue: !Ref TargetCpuUtilization
        ScaleOutCooldown: 300
        ScaleInCooldown: 300

  # ============================================================================
  # CloudWatch Alarms
  # ============================================================================
  HighCPUAlarm:
    Type: AWS::CloudWatch::Alarm
    Condition: EnableDetailedCloudWatch
    Properties:
      AlarmName: !Sub '\${AgentName}-\${Environment}-high-cpu'
      AlarmDescription: High CPU utilization
      MetricName: CPUUtilization
      Namespace: AWS/ECS
      Statistic: Average
      Period: 300
      EvaluationPeriods: 2
      Threshold: 80
      ComparisonOperator: GreaterThanThreshold
      Dimensions:
        - Name: ServiceName
          Value: !Sub '\${AgentName}-\${Environment}-service'
        - Name: ClusterName
          Value: !Ref AgentCoreCluster
      TreatMissingData: notBreaching

  HighMemoryAlarm:
    Type: AWS::CloudWatch::Alarm
    Condition: EnableDetailedCloudWatch
    Properties:
      AlarmName: !Sub '\${AgentName}-\${Environment}-high-memory'
      AlarmDescription: High memory utilization
      MetricName: MemoryUtilization
      Namespace: AWS/ECS
      Statistic: Average
      Period: 300
      EvaluationPeriods: 2
      Threshold: 80
      ComparisonOperator: GreaterThanThreshold
      Dimensions:
        - Name: ServiceName
          Value: !Sub '\${AgentName}-\${Environment}-service'
        - Name: ClusterName
          Value: !Ref AgentCoreCluster
      TreatMissingData: notBreaching

  ServiceUnhealthyAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: !Sub '\${AgentName}-\${Environment}-service-unhealthy'
      AlarmDescription: Service has unhealthy targets
      MetricName: UnHealthyHostCount
      Namespace: AWS/ApplicationELB
      Statistic: Average
      Period: 60
      EvaluationPeriods: 2
      Threshold: 0
      ComparisonOperator: GreaterThanThreshold
      Dimensions:
        - Name: TargetGroup
          Value: !GetAtt AgentCoreTargetGroup.TargetGroupFullName
        - Name: LoadBalancer
          Value: !GetAtt AgentCoreLoadBalancer.LoadBalancerFullName
      TreatMissingData: notBreaching

Outputs:
  AgentCoreEndpoint:
    Description: AgentCore endpoint URL
    Value: !Sub 'http://\${AgentCoreLoadBalancer.DNSName}'
    Export:
      Name: !Sub '\${AWS::StackName}-endpoint'

  AgentCoreClusterName:
    Description: ECS cluster name
    Value: !Ref AgentCoreCluster
    Export:
      Name: !Sub '\${AWS::StackName}-cluster'

  AgentCoreServiceName:
    Description: ECS service name
    Value: !Sub '\${AgentName}-\${Environment}-service'
    Export:
      Name: !Sub '\${AWS::StackName}-service'

  ECRRepositoryURI:
    Description: ECR repository URI
    Value: !Sub '\${AWS::AccountId}.dkr.ecr.\${AWS::Region}.amazonaws.com/\${AgentName}-\${Environment}'
    Export:
      Name: !Sub '\${AWS::StackName}-ecr-uri'

  S3BucketName:
    Description: S3 bucket for agent storage
    Value: !Ref AgentCoreS3Bucket
    Export:
      Name: !Sub '\${AWS::StackName}-s3-bucket'

  VPCId:
    Condition: CreateVpc
    Description: VPC ID
    Value: !Ref VPC
    Export:
      Name: !Sub '\${AWS::StackName}-vpc-id'

  PrivateSubnets:
    Condition: CreateVpc
    Description: Private subnet IDs
    Value: !Sub '\${PrivateSubnet1},\${PrivateSubnet2}'
    Export:
      Name: !Sub '\${AWS::StackName}-private-subnets'

  SecurityGroupId:
    Description: AgentCore security group ID
    Value: !Ref AgentCoreSecurityGroup
    Export:
      Name: !Sub '\${AWS::StackName}-security-group'

  LogGroupName:
    Description: CloudWatch log group name
    Value: !Ref AgentCoreLogGroup
    Export:
      Name: !Sub '\${AWS::StackName}-log-group'
`;
}

function generateStackParameters(args: any): Record<string, string> {
  return {
    AgentName: args.agentName,
    Environment: args.environment || 'prod',
    ModelId: args.model,
    VpcCidr: args.vpcConfig?.vpcCidr || '10.0.0.0/16',
    MinCapacity: String(args.scaling?.minCapacity || 0),
    MaxCapacity: String(args.scaling?.maxCapacity || 10),
    TargetCpuUtilization: String(args.scaling?.targetCpuUtilization || 70),
    LogRetentionDays: String(args.monitoring?.logRetentionDays || 30),
    EnableXRay: String(args.monitoring?.enableXRay || true),
    EnableDetailedMonitoring: String(args.monitoring?.enableCloudWatch || true),
  };
}