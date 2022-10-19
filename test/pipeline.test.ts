import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { PipelineStack } from '../lib/pipeline-stack';

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
