import { CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import {
  Alias,
  CfnParametersCode,
  Code,
  Function,
  Runtime,
} from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { HttpApi } from '@aws-cdk/aws-apigatewayv2-alpha';
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import {
  LambdaDeploymentConfig,
  LambdaDeploymentGroup,
} from 'aws-cdk-lib/aws-codedeploy';
import { Statistic, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { ServiceHealthCanary } from './constructs/service-health-canary';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';

interface ServiceStackProps extends StackProps {
  stageName: string;
}

export class ServiceStack extends Stack {
  public readonly serviceCode: CfnParametersCode;
  public readonly serviceEndpointOutput: CfnOutput;
  constructor(scope: Construct, id: string, props?: ServiceStackProps) {
    super(scope, id, props);

    this.serviceCode = Code.fromCfnParameters();

    const lambda = new Function(this, 'ServiceLambda', {
      runtime: Runtime.NODEJS_16_X,
      handler: 'src/lambda.handler',
      code: this.serviceCode,
      functionName: `ServiceLambda${props?.stageName}`,
      description: `Generated on ${new Date().toISOString()}`, // this line ensures that this lambda
    }); // redeploy every time even if there are no changes on the cloud formation template

    const alias = new Alias(this, 'ServiceLambdaAlias', {
      version: lambda.currentVersion,
      aliasName: `ServiceLambdaAlias${props?.stageName}`,
    });

    const httpApi = new HttpApi(this, 'ServiceApi', {
      defaultIntegration: new HttpLambdaIntegration(
        'ServiceIntegration',
        alias
      ),
      apiName: `MyService${props?.stageName}`,
    });

    if (props?.stageName === 'Prod') {
      new LambdaDeploymentGroup(this, 'DeploymentGroup', {
        alias: alias,
        deploymentConfig: LambdaDeploymentConfig.CANARY_10PERCENT_5MINUTES,
        autoRollback: {
          deploymentInAlarm: true,
        },
        alarms: [
          httpApi
            .metricServerError()
            .with({
              period: Duration.minutes(1),
              statistic: Statistic.SUM,
            })
            .createAlarm(this, 'ServiceErrorAlarm', {
              threshold: 1,
              alarmDescription: 'Service is experiencing errors',
              alarmName: `ServiceErrorAlarm${props.stageName}`,
              evaluationPeriods: 1,
              treatMissingData: TreatMissingData.NOT_BREACHING, // if we don't get any errors/data at all, that's a good sing
            }), // sometimes when we are not getting any data is a bad sign
        ],
      });

      const alarmTopic = new Topic(this, 'ServiceCanaryAlarmTopic', {
        topicName: 'ServiceAlarmTopic',
      });

      // alarmTopic.addSubscription(new EmailSubscription("edanhebla1213@gmail.com"))

      new ServiceHealthCanary(this, 'ServiceCanary', {
        apiEndpoint: httpApi.apiEndpoint,
        canaryName: 'service-canary',
        alarmTopic,
      });
    }

    this.serviceEndpointOutput = new CfnOutput(this, 'ApiEndpointOutput', {
      exportName: `ServiceEndpoint${props?.stageName}`,
      value: httpApi.apiEndpoint,
      description: 'Api Endpoint',
    });
  }
}
