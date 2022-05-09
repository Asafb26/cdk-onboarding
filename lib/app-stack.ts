import { Construct } from 'constructs'
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb'
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns'
import { Stack, StackProps } from 'aws-cdk-lib'
import { GatewayVpcEndpointAwsService, Vpc } from 'aws-cdk-lib/aws-ec2'
import { Cluster, ContainerImage, LogDrivers } from 'aws-cdk-lib/aws-ecs'
import * as path from 'path'
import { AnyPrincipal, Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam'
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'
import { PrivateDnsNamespace } from 'aws-cdk-lib/aws-servicediscovery'
import { ApplicationListener } from 'aws-cdk-lib/aws-elasticloadbalancingv2'

export class AppStack extends Stack {
  public vpc: Vpc
  public listener: ApplicationListener

  constructor (scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)
    const vpc = new Vpc(this, 'TresOnboardingVPC', {
      maxAzs: 3
    })

    this.vpc = vpc

    const cluster = new Cluster(this, 'TresOnboardingCluster', {
      vpc: vpc
    })

    const dnsNamespace = new PrivateDnsNamespace(
      this,
      'DnsNamespace',
      {
        name: 'http-api.local',
        vpc: vpc,
        description: 'Private DnsNamespace for Microservices',
      }
    )

    const table = new Table(this, 'Entities', {
      partitionKey: { name: 'name', type: AttributeType.STRING }
    })

    const dynamoGatewayEndpoint = vpc.addGatewayEndpoint('DynamoDB', {
      service: GatewayVpcEndpointAwsService.DYNAMODB
    })

    const logGroup = new LogGroup(this, 'AsafOnboardingLogGroup', {
      logGroupName: '/ecs/onboarding',
      retention: RetentionDays.ONE_WEEK
    })

    const logging = LogDrivers.awsLogs({
      streamPrefix: 'app',
      logGroup: logGroup
    })

    const fargate = new ApplicationLoadBalancedFargateService(this, 'TresOnboardingService', {
      assignPublicIp: false,
      cloudMapOptions: {
        name: 'TresOnboardingService',
        cloudMapNamespace: dnsNamespace
      },
      cluster: cluster,
      cpu: 512,
      desiredCount: 1,
      taskImageOptions: {
        image: ContainerImage.fromAsset(path.join(__dirname, '../app/'), {
          buildArgs: {
            platform: 'linux/amd64'
          }
        }),
        environment: {
          databaseTable: table.tableName,
          region: props?.env?.region ?? 'eu-west-1'
        },
        logDriver: logging
      },
      memoryLimitMiB: 2048,
      publicLoadBalancer: false
    })

    this.listener = fargate.listener

    dynamoGatewayEndpoint.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [new AnyPrincipal()],
        actions: ['dynamodb:*'],
        resources: [table.tableArn],
        conditions: {
          ArnEquals: {
            'aws:PrincipalArn': fargate.taskDefinition.taskRole.roleArn
          }
        }
      })
    )

    table.grantReadWriteData(fargate.taskDefinition.taskRole)
  };
}
