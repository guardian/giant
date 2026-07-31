import type {GuStackProps} from "@guardian/cdk/lib/constructs/core";
import {CfnInclude} from "aws-cdk-lib/cloudformation-include";
import type {GiantApp} from "./constructs/GiantApp";
import {GuStackWithGiantVPC} from "./constructs/GuStackWithGiantVPC";


export class MainGiantStack extends GuStackWithGiantVPC {
  constructor(scope: GiantApp, id: string, props: GuStackProps) {
    super(scope, id, props);

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
