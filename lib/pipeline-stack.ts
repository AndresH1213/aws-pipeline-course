import { Stack, StackProps, Duration, SecretValue } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
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
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const pipeline = new Pipeline(this, 'Pipeline', {
      pipelineName: 'Pipeline',
      crossAccountKeys: false,
    });

    const cdkSourceOutput = new Artifact('CdkSourceOutput');
    const serviceSourceOutput = new Artifact('ServiceSourceOutput');

    pipeline.addStage({
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

    const cdkBuildOutput = new Artifact('CdkBuildOutput');

    pipeline.addStage({
      stageName: 'Build',
      actions: [
        new CodeBuildAction({
          actionName: 'CDK_Build',
          input: cdkSourceOutput,
          outputs: [cdkBuildOutput],
          project: new PipelineProject(this, 'CdkBuildProject', {
            environment: {
              buildImage: LinuxBuildImage.STANDARD_5_0,
            },
            buildSpec: BuildSpec.fromSourceFilename(
              'build-specs/cdk-build-spec.yml'
            ),
          }),
        }),
      ],
    });

    pipeline.addStage({
      stageName: 'Pipeline_Update',
      actions: [
        new CloudFormationCreateUpdateStackAction({
          actionName: 'Pipeline_update',
          stackName: 'PipelineStack',
          templatePath: cdkBuildOutput.atPath('PipelineStack.template.json'),
          adminPermissions: true,
          // role:  -> assign a role
        }),
      ],
    });
  }
}
