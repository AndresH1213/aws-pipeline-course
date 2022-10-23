import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { PipelineStack } from '../lib/pipeline-stack';
import { ServiceStack } from '../lib/service-stack';
import { BillingStack } from '../lib/billing-stack';
import {
  arrayWith,
  expect as expectCDK,
  haveResourceLike,
  objectLike,
} from '@aws-cdk/assert';

// example test. To run these tests, uncomment this file along with the
// example resource in lib/pipeline-stack.ts
test('Pipeline Stack', () => {
  const app = new cdk.App();
  // Create the pipeline stack
  const stack = new PipelineStack(app, 'MyTestStack');
  // Prepare the stack for assertions
  const template = Template.fromStack(stack);

  // Assert the template matches the snapshot
  expect(template.toJSON()).toMatchSnapshot();
});

test('Adding service stage', () => {
  // GIVEN
  const app = new cdk.App();
  const serviceStack = new ServiceStack(app, 'ServiceStack', {
    stageName: 'Test',
  });

  const pipelineStack = new PipelineStack(app, 'PipelineStack');

  // WHEN
  pipelineStack.addServiceStage(serviceStack, 'Test');

  // THEN
  expectCDK(pipelineStack).to(
    haveResourceLike('AWS::CodePipeline::Pipeline', {
      Stages: arrayWith(
        objectLike({
          Name: 'Test',
        })
      ),
    })
  );
});

test('Adding billing stack to a stage', () => {
  // GIVEN
  const app = new cdk.App();
  const serviceStack = new ServiceStack(app, 'ServiceStack', {
    stageName: 'Test',
  });
  const pipelineStack = new PipelineStack(app, 'PipelineStack');
  const billingStack = new BillingStack(app, 'BillingStack', {
    budgetAmount: 5,
    emailAddress: 'test@example.com',
  });
  const testStage = pipelineStack.addServiceStage(serviceStack, 'Test');

  // WHEN
  pipelineStack.addBillingStackToStage(billingStack, testStage);
  // THEN
  expectCDK(pipelineStack).to(
    haveResourceLike('AWS::CodePipeline::Pipeline', {
      Stages: arrayWith(
        objectLike({
          Actions: arrayWith(
            objectLike({
              Name: 'Billing_Update',
            })
          ),
        })
      ),
    })
  );
});
