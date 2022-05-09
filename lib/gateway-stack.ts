import { Construct } from 'constructs'
import { CfnOutput, CfnResource, Stack, StackProps } from 'aws-cdk-lib'
import { DomainName, HttpApi } from '@aws-cdk/aws-apigatewayv2-alpha'
import { CfnIntegration, CfnRoute } from 'aws-cdk-lib/aws-apigatewayv2'
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager'
import { ARecord, HostedZone, PublicHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53'
import { ApiGatewayv2DomainProperties } from 'aws-cdk-lib/aws-route53-targets'
import { Vpc } from 'aws-cdk-lib/aws-ec2'
import { ApplicationListener } from 'aws-cdk-lib/aws-elasticloadbalancingv2'

export class GatewayStack extends Stack {
  private appListener: ApplicationListener
  private appVPC: Vpc

  constructor (scope: Construct, id: string, appListener: ApplicationListener, appVPC: Vpc, props?: StackProps) {
    super(scope, id, props)
    const rootDomain = 'tres-finance.tk'
    const apiDomain = `api.${rootDomain}`
    this.appListener = appListener
    this.appVPC = appVPC

    const zone = new PublicHostedZone(this, 'BaseZone', {
      zoneName: rootDomain
    })

    const certificate = new Certificate(this, 'Certificate', {
      domainName: 'tres-finance.tk',
      subjectAlternativeNames: [apiDomain],
      validation: CertificateValidation.fromDns(zone)
    })

    //VPC Link
    const httpVpcLink = new CfnResource(this, 'HttpVpcLink', {
      type: 'AWS::ApiGatewayV2::VpcLink',
      properties: {
        Name: 'http-api-vpclink',
        SubnetIds: this.appVPC.privateSubnets.map((m) => m.subnetId),
      },
    })

    const domainName = new DomainName(this, 'DomainName', { domainName: apiDomain, certificate })

    const api = new HttpApi(this, 'HttpApiGateway', {
      apiName: 'ApigwFargate',
      description: 'Integration between apigw and Application Load-Balanced Fargate Service',
      defaultDomainMapping: { domainName }
    })

    const integration = new CfnIntegration(this, 'HttpApiGatewayIntegration', {
      apiId: api.httpApiId,
      connectionId: httpVpcLink.ref,
      connectionType: 'VPC_LINK',
      description: 'API Integration with AWS Fargate Service',
      integrationMethod: 'ANY',
      integrationType: 'HTTP_PROXY',
      integrationUri: this.appListener.listenerArn,
      payloadFormatVersion: '1.0', // supported values for Lambda proxy integrations are 1.0 and 2.0. For all other integrations, 1.0 is the only supported value
    })

    new ARecord(this, 'apiDNS', {
      zone: zone,
      recordName: 'api',
      target: RecordTarget.fromAlias(new ApiGatewayv2DomainProperties(domainName.regionalDomainName, domainName.regionalHostedZoneId)),
    })

    new CfnRoute(this, 'Route', {
      apiId: api.httpApiId,
      routeKey: 'ANY /{proxy+}',
      target: `integrations/${integration.ref}`,
    })

    new CfnOutput(this, 'APIGatewayUrl', {
      description: 'API Gateway URL to access the GET endpoint',
      value: api.url!
    })
  };
}
