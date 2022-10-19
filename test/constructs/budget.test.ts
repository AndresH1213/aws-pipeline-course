import { App, Stack } from 'aws-cdk-lib';
import { Budget } from '../../lib/constructs/budget';
import { Match, Template } from 'aws-cdk-lib/assertions';

test.skip('Budget construct', () => {
  const app = new App();

  const stack = new Stack(app, 'Stack');
  new Budget(stack, 'Budget', {
    budgetAmount: 1,
    emailAddress: 'test@example.com',
  });
  Template.fromStack(stack).hasResourceProperties('AWS::Bugets::Budget', {
    Budget: {
      BudgetLimit: {
        Amount: 1,
      },
    },
    NotificationsWithSubscribers: [
      Match.objectLike({
        Subscribers: [
          {
            Address: 'test@example.com',
            SubscriptionType: 'EMAIL',
          },
        ],
      }),
    ],
  });
});
