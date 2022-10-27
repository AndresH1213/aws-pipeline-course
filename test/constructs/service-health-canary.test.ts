import { haveResourceLike, expect } from '@aws-cdk/assert';
import { App, Stack } from 'aws-cdk-lib/core';
import { ServiceHealthCanary } from '../../lib/constructs/service-health-canary';

test('ServiceHealthCanary', () => {
  const app = new App();
  const stack = new Stack(app, 'TestStack');

  new ServiceHealthCanary(stack, 'TestCanary', {
    apiEndpoint: 'api.example.com',
    canaryName: 'test-canary',
  });

  expect(stack).to(
    haveResourceLike('AWS::Synthetics::Canary', {
      RunConfig: {
        EnvironmentVariables: {
          API_ENDPOINT: 'api.example.com',
        },
      },
    })
  );
});
