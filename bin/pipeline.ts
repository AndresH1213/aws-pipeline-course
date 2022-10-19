#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PipelineStack } from '../lib/pipeline-stack';
import { BillingStack } from '../lib/billing-stack';

const app = new cdk.App();
new PipelineStack(app, 'PipelineStack', {});
// new BillingStack(app, 'BillingStack', {
//   budgetAmount: 5,
//   emailAddress: 'edanhebla1213@gmail.com',
// });
