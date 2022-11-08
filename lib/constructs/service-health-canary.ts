import {
  Canary,
  Runtime,
  Schedule,
  Test,
  Code,
} from '@aws-cdk/aws-synthetics-alpha';
import { Duration } from 'aws-cdk-lib';
import { Statistic, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { readFileSync } from 'fs';
import { join } from 'path';

interface ServiceHealthCanaryProps {
  apiEndpoint: string;
  canaryName: string;
  alarmTopic: Topic;
}

export class ServiceHealthCanary extends Construct {
  constructor(scope: Construct, id: string, props: ServiceHealthCanaryProps) {
    super(scope, id);

    const canary = new Canary(this, props.canaryName, {
      runtime: Runtime.SYNTHETICS_NODEJS_PUPPETEER_3_5,
      canaryName: props.canaryName,
      schedule: Schedule.rate(Duration.minutes(1)),
      environmentVariables: {
        API_ENDPOINT: props.apiEndpoint,
        DEPLOYMENT_TRIGGER: Date.now().toString(), // forces canary redeploy each time
      },
      test: Test.custom({
        code: Code.fromInline(
          readFileSync(join(__dirname, '../../canary/canary.ts'), 'utf8')
        ),
        handler: 'index.handler',
      }),
      timeToLive: Duration.minutes(5),
    });

    const canaryFailedMetric = canary.metricFailed({
      period: Duration.minutes(1),
      statistic: Statistic.SUM,
      label: `${props.canaryName} Failed`,
    });

    const canaryFailedAlarm = canaryFailedMetric.createAlarm(
      this,
      `${props.canaryName}FeiledAlarm`,
      {
        threshold: 1,
        alarmDescription: `Canary ${props.canaryName} has failed`,
        evaluationPeriods: 1,
        treatMissingData: TreatMissingData.NOT_BREACHING,
        alarmName: `${props.canaryName}FailedAlarm`,
      }
    );

    canaryFailedAlarm.addAlarmAction(new SnsAction(props.alarmTopic));
  }
}
