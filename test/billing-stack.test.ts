import { App } from 'aws-cdk-lib';
import { BillingStack } from '../lib/billing-stack';
import { Template } from 'aws-cdk-lib/assertions';

test.skip('Billing stack', () => {
  const app = new App();
  const stack = new BillingStack(app, 'BillingStack', {
    budgetAmount: 1,
    emailAddress: 'test@example.com',
  });

  // Prepare the stack for assertions
  const template = Template.fromStack(stack);

  // Assert the template matches the snapshot
  expect(template.toJSON()).toMatchSnapshot();
});
