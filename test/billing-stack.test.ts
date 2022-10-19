import { App } from 'aws-cdk-lib';
import { BillingStack } from '../lib/billing-stack';
import { Capture } from 'aws-cdk-lib/assertions';

test('Billing stack', () => {
  const app = new App();
  const stack = new BillingStack(app, 'BillingStack', {
    budgetAmount: 1,
    emailAddress: 'test@example.com',
  });

  expect(stack._synthesizeTemplate).toMatchSnapshot();
});
