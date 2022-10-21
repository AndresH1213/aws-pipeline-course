import { Stack, StackProps, SecretValue } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Artifact, Pipeline, IStage } from 'aws-cdk-lib/aws-codepipeline';
import { ServiceStack } from './service-stack';
import { BillingStack } from './billing-stack';
import {
  CloudFormationCreateUpdateStackAction,
  CodeBuildAction,
  GitHubSourceAction,
} from 'aws-cdk-lib/aws-codepipeline-actions';
import {
  BuildSpec,
  LinuxBuildImage,
  PipelineProject,
} from 'aws-cdk-lib/aws-codebuild';

export class PipelineStack extends Stack {
  private readonly pipeline: Pipeline;
  private readonly cdkBuildOutput: Artifact;
  private readonly serviceBuildOutput: Artifact;
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.pipeline = new Pipeline(this, 'Pipeline', {
      pipelineName: 'Pipeline',
      crossAccountKeys: false,
      restartExecutionOnUpdate: true,
    });

    const cdkSourceOutput = new Artifact('CdkSourceOutput');
    const serviceSourceOutput = new Artifact('ServiceSourceOutput');

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
          output: serviceSourceOutput,
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
          input: serviceSourceOutput,
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
    return this.pipeline.addStage({
      stageName: stageName,
      actions: [
        new CloudFormationCreateUpdateStackAction({
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
}
