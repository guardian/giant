import type {GuStackProps} from "@guardian/cdk/lib/constructs/core";
import {CfnResource, TagManager, Tags} from "aws-cdk-lib";
import {CfnInclude} from "aws-cdk-lib/cloudformation-include";
import type {GiantApp} from "./constructs/GiantApp";
import {GuStackWithGiantVPC} from "./constructs/GuStackWithGiantVPC";


export class MainGiantStack extends GuStackWithGiantVPC {
  constructor(scope: GiantApp, id: string, props: GuStackProps) {
    super(scope, id, {
      withoutTags: true, // otherwise GuStack clobbers the tags in the cfn template
      ...props
    });

    // these are handy tags that we normally get with GuStack, but have had to turn off the GuStack tagging (see withoutTags above)
    this.addTag("Stack", this.stack);
    this.addTag("gu:riff-raff:project",`investigations::${this.stack}`); // needs to match step in build.yaml

    // see https://docs.aws.amazon.com/cdk/v2/guide/use-cfn-template.html
    new CfnInclude(this, 'ExistingTemplate', {
      templateFile: '../../external/investigations-platform/giant-deploy/src/main/resources/pfi/investigations.yaml',
      preserveLogicalIds: true,
      parameters: {
        // TODO need to change the param in the yaml file in investigations-platform to take VPC ID rather than name,
        //  in order to benefit from this.vpc.vpcId (provided by  GuStackWithGiantVPC)
        // VPCStackName:
      }
    });
  }
}
