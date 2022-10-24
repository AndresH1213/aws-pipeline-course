#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PipelineStack } from '../lib/pipeline-stack';
import { BillingStack } from '../lib/billing-stack';
import { ServiceStack } from '../lib/service-stack';

const app = new cdk.App();
const pipelineStack = new PipelineStack(app, 'PipelineStack', {});
const billingStack = new BillingStack(app, 'BillingStack', {
  budgetAmount: 5,
  emailAddress: 'edanhebla1213@gmail.com',
});

const serviceStackTest = new ServiceStack(app, 'ServiceStackTest', {
  stageName: 'Test',
});
const serviceStackProd = new ServiceStack(app, 'ServiceStackProd', {
  stageName: 'Prod',
});

const testStage = pipelineStack.addServiceStage(serviceStackTest, 'Test');
const propdStage = pipelineStack.addServiceStage(serviceStackProd, 'Prod');
pipelineStack.addBillingStackToStage(billingStack, propdStage);
pipelineStack.addServiceIntegrationTestToStage(
  testStage,
  serviceStackTest.serviceEndpointOutput.importValue // here we need to push in parts
); // because the pipeline stack can't import something that hasn't been exported we need to
// deploy first service stack

// we can't reference the api directly in the pipeline because the pipeline updates before the services stack tests
// expose the enpoint so it will fail
// pipelineStack.addServiceIntegrationTestToStage(
//   testStage,
//   serviceStackTest.api.apiEndpoint
// );
