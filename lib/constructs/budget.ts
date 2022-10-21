import { Construct } from 'constructs';
import * as budgets from 'aws-cdk-lib/aws-budgets';

interface BudgetProps {
  budgetAmount: number;
  emailAddress: string;
}

export class Budget extends Construct {
  constructor(scope: Construct, id: string, props: BudgetProps) {
    super(scope, id);

    new budgets.CfnBudget(this, 'Budget-course', {
      budget: {
        budgetLimit: {
          amount: props.budgetAmount,
          unit: 'USD',
        },
        budgetName: 'Monthly Budget',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
      },
      notificationsWithSubscribers: [
        {
          notification: {
            threshold: 5,
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            thresholdType: 'ABSOLUTE_VALUE',
          },
          subscribers: [
            {
              subscriptionType: 'EMAIL',
              address: props.emailAddress,
            },
          ],
        },
      ],
    });
  }
}
