#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PipelineStack } from '../lib/pipeline-stack';
import { BillingStack } from '../lib/billing-stack';
import { ServiceStack } from '../lib/service-stack';
import { Environment } from 'aws-cdk-lib';

const usEastEnv: Environment = {
  account: '489034307864',
  region: 'us-east-1',
};

const euWestEnv: Environment = {
  account: '489034307864',
  region: 'eu-west-1',
};
const app = new cdk.App();
const pipelineStack = new PipelineStack(app, 'PipelineStack', {
  env: usEastEnv,
});
const billingStack = new BillingStack(app, 'BillingStack', {
  env: usEastEnv,
  budgetAmount: 5,
  emailAddress: 'edanhebla1213@gmail.com',
});

const serviceStackTest = new ServiceStack(app, 'ServiceStackTest', {
  env: usEastEnv,
  stageName: 'Test',
});
const serviceStackProd = new ServiceStack(app, 'ServiceStackProd', {
  env: usEastEnv,
  stageName: 'Prod',
});

// euWestEnv is gonna tell cdk that is a cross region stack and it will deploy a stack that
// creates the s3 bucket in eu-west-region that stores the artifact for this stack
const serviceStackProdBackup = new ServiceStack(app, 'ServiceStackProdBackup', {
  env: euWestEnv,
  stageName: 'Prod',
});

const testStage = pipelineStack.addServiceStage(serviceStackTest, 'Test');
const propdStage = pipelineStack.addServiceStage(serviceStackProd, 'Prod');
pipelineStack.addServiceStage(serviceStackProdBackup, 'ProdBackup');

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
