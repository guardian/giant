import type {GuStackProps} from "@guardian/cdk/lib/constructs/core";
import {CfnInclude} from "aws-cdk-lib/cloudformation-include";
import type {GiantApp} from "./constructs/GiantApp";
import {GuStackWithGiantVPC} from "./constructs/GuStackWithGiantVPC";
import {
  activityTypes,
  buildVerifiedQueueName,
  priorityLevels,
  sensitivityLevels
} from "../../../external/transcription-service/packages/common/src/queue-gardens";
import {Queue} from 'aws-cdk-lib/aws-sqs';
import { Role } from "aws-cdk-lib/aws-iam";

interface MainGiantStackProps extends GuStackProps {
  transcriptionServiceStage: string;
}

export class MainGiantStack extends GuStackWithGiantVPC {
  constructor(scope: GiantApp, id: string, {transcriptionServiceStage, ...props}: MainGiantStackProps) {
    super(scope, id, {
      withoutTags: true, // otherwise GuStack clobbers the tags in the cfn template
      ...props
    });

    // these are handy tags that we normally get with GuStack, but have had to turn off the GuStack tagging (see withoutTags above)
    this.addTag("Stack", this.stack);
    this.addTag("gu:riff-raff:project",`investigations::${this.stack}`); // needs to match step in build.yaml

    // see https://docs.aws.amazon.com/cdk/v2/guide/use-cfn-template.html
    const existingTemplate = new CfnInclude(this, 'ExistingTemplate', {
      templateFile: '../../external/investigations-platform/giant-deploy/src/main/resources/pfi/investigations.yaml',
      preserveLogicalIds: true,
      parameters: {
        // TODO need to change the param in the yaml file in investigations-platform to take VPC ID rather than name,
        //  in order to benefit from this.vpc.vpcId (provided by GuStackWithGiantVPC)
        // VPCStackName:
      }
    });

    const workerRole = Role.fromRoleName(
      this,
      'WorkerRole',
      existingTemplate.getResource('WorkerRole').ref
    );

    for (const priorityLevel of priorityLevels) {
      for (const sensitivityLevel of sensitivityLevels) {
        for (const activityType of activityTypes) {
          const getQueueName = buildVerifiedQueueName(
            priorityLevel,
            sensitivityLevel,
            activityType,
          );

          const queue = Queue.fromQueueArn(
            this,
            getQueueName('queue'), // sans stage
            `arn:aws:sqs:${this.region}:${this.account}:${getQueueName('queue', transcriptionServiceStage)}`,
          );

          queue.grantSendMessages(workerRole);
        }
      }
    }

  }
}
