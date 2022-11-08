import { Stack, StackProps, SecretValue } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Artifact, Pipeline, IStage } from 'aws-cdk-lib/aws-codepipeline';
import { ServiceStack } from './service-stack';
import { BillingStack } from './billing-stack';
import {
  CloudFormationCreateUpdateStackAction,
  CodeBuildAction,
  CodeBuildActionType,
  GitHubSourceAction,
} from 'aws-cdk-lib/aws-codepipeline-actions';
import {
  BuildEnvironmentVariableType,
  BuildSpec,
  LinuxBuildImage,
  PipelineProject,
} from 'aws-cdk-lib/aws-codebuild';
import { SnsTopic } from 'aws-cdk-lib/aws-events-targets';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { EventField, RuleTargetInput } from 'aws-cdk-lib/aws-events';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';

export class PipelineStack extends Stack {
  private readonly pipeline: Pipeline;
  private readonly cdkBuildOutput: Artifact;
  private readonly serviceBuildOutput: Artifact;
  private readonly serviceSourceOutput: Artifact;

  private readonly pipelineNotificationTopic: Topic;
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.pipelineNotificationTopic = new Topic(this, 'PipelineNotification', {
      topicName: 'PipelineNotifications',
    });

    this.pipelineNotificationTopic.addSubscription(
      new EmailSubscription('edanhebla1213@gmail.com')
    );

    this.pipeline = new Pipeline(this, 'Pipeline', {
      pipelineName: 'Pipeline',
      crossAccountKeys: false,
      restartExecutionOnUpdate: true,
    });

    const cdkSourceOutput = new Artifact('CdkSourceOutput');
    this.serviceSourceOutput = new Artifact('ServiceSourceOutput');

    this.pipeline.addStage({
      stageName: 'Source',
      actions: [
        new GitHubSourceAction({
          actionName: 'Pipeline_Source',
          owner: 'AndresH1213',
          repo: 'aws-pipeline-course',
          branch: 'main',
          oauthToken: SecretValue.secretsManager(
            'github-pipeline-course-token'
          ),
          output: cdkSourceOutput,
        }),
        new GitHubSourceAction({
          actionName: 'Service_Source',
          owner: 'AndresH1213',
          repo: 'express-lambda-service-plud',
          branch: 'main',
          oauthToken: SecretValue.secretsManager(
            'github-pipeline-course-token'
          ),
          output: this.serviceSourceOutput,
        }),
      ],
    });

    this.cdkBuildOutput = new Artifact('CdkBuildOutput');
    this.serviceBuildOutput = new Artifact('ServiceBuildOutput');

    this.pipeline.addStage({
      stageName: 'Build',
      actions: [
        new CodeBuildAction({
          actionName: 'CDK_Build',
          input: cdkSourceOutput,
          outputs: [this.cdkBuildOutput],
          project: new PipelineProject(this, 'CdkBuildProject', {
            environment: {
              buildImage: LinuxBuildImage.STANDARD_5_0,
            },
            buildSpec: BuildSpec.fromSourceFilename(
              'build-specs/cdk-build-spec.yml'
            ),
          }),
        }),
        new CodeBuildAction({
          actionName: 'Service_Build',
          input: this.serviceSourceOutput,
          outputs: [this.serviceBuildOutput],
          project: new PipelineProject(this, 'ServiceBuildProject', {
            environment: {
              buildImage: LinuxBuildImage.STANDARD_5_0,
            },
            buildSpec: BuildSpec.fromSourceFilename(
              'build-specs/service-build-spec.yml' // this path, offcourse, goes in service repo code
            ),
          }),
        }),
      ],
    });

    this.pipeline.addStage({
      stageName: 'Pipeline_Update',
      actions: [
        new CloudFormationCreateUpdateStackAction({
          actionName: 'Pipeline_update',
          stackName: 'PipelineStack',
          templatePath: this.cdkBuildOutput.atPath(
            'PipelineStack.template.json'
          ),
          adminPermissions: true,
          // role:  -> assign a role
        }),
      ],
    });
  }

  public addServiceStage(
    serviceStack: ServiceStack,
    stageName: string
  ): IStage {
    // this actions itself takes account to the region props as well
    // and if we don't specify it, it will take the account and the region of
    // the pipeline, even if the stack itself is synthesice with the specific environment
    // like we pass in the pipeline.ts props env
    return this.pipeline.addStage({
      stageName: stageName,
      actions: [
        new CloudFormationCreateUpdateStackAction({
          account: serviceStack.account,
          region: serviceStack.region,
          actionName: 'Service_Update',
          stackName: serviceStack.stackName,
          templatePath: this.cdkBuildOutput.atPath(
            `${serviceStack.stackName}.template.json`
          ),
          adminPermissions: true,
          parameterOverrides: {
            ...serviceStack.serviceCode.assign(
              this.serviceBuildOutput.s3Location
            ),
          },
          // because we are referring to an artifact [serviceBuildOutput] we need to passing as an extra input
          extraInputs: [this.serviceBuildOutput],
        }),
      ],
    });
  }

  public addBillingStackToStage(billingStack: BillingStack, stage: IStage) {
    stage.addAction(
      new CloudFormationCreateUpdateStackAction({
        actionName: 'Billing_Update',
        stackName: billingStack.stackName,
        templatePath: this.cdkBuildOutput.atPath(
          `${billingStack.stackName}.template.json`
        ),
        adminPermissions: true,
      })
    );
  }
  public addServiceIntegrationTestToStage(
    stage: IStage,
    serviceEndpoint: string
  ) {
    const integTestAction = new CodeBuildAction({
      actionName: 'Integration_Tests',
      input: this.serviceSourceOutput,
      project: new PipelineProject(this, 'ServiceIntegrationTestsProject', {
        environment: {
          buildImage: LinuxBuildImage.STANDARD_5_0,
        },
        buildSpec: BuildSpec.fromSourceFilename(
          'build-specs/integ-test-build-spec.yml'
        ),
      }),
      environmentVariables: {
        SERVICE_ENDPOINT: {
          value: serviceEndpoint,
          type: BuildEnvironmentVariableType.PLAINTEXT,
        },
      },
      type: CodeBuildActionType.TEST,
      runOrder: 2,
    });

    stage.addAction(integTestAction);
    // the action level events has 4 states
    integTestAction.onStateChange(
      'IntegrationTestFailed',
      new SnsTopic(this.pipelineNotificationTopic, {
        message: RuleTargetInput.fromText(
          `Integration Test failed. See details here: ${EventField.fromPath(
            '$.detail.execution-result.external-execution-url'
          )}`
        ),
      }),
      {
        ruleName: 'IntegrationTestFailed',
        eventPattern: {
          detail: {
            state: ['FAILED'],
          },
        },
        description: 'Integration test has failed',
      }
    );
  }
}
