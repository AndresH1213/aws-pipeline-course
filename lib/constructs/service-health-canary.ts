import {
  Canary,
  Runtime,
  Schedule,
  Test,
  Code,
} from '@aws-cdk/aws-synthetics-alpha';
import { Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { readFileSync } from 'fs';
import { join } from 'path';

interface ServiceHealthCanaryProps {
  apiEndpoint: string;
  canaryName: string;
}

export class ServiceHealthCanary extends Construct {
  constructor(scope: Construct, id: string, props: ServiceHealthCanaryProps) {
    super(scope, id);

    new Canary(this, props.canaryName, {
      runtime: Runtime.SYNTHETICS_NODEJS_PUPPETEER_3_1,
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
  }
}
