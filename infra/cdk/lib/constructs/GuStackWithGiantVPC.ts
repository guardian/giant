import {VPC_SSM_PARAMETER_PREFIX} from "@guardian/cdk/lib/constants/ssm-parameter-paths";
import {
	GuStack,
	type GuStackProps,
	GuVpcParameter,
} from '@guardian/cdk/lib/constructs/core';
import { GuVpc } from '@guardian/cdk/lib/constructs/ec2/vpc';
import type { IVpc } from 'aws-cdk-lib/aws-ec2';
import type {GuAppWithExposedRiffRaff} from "./GuAppWithExposedRiffRaff";

export class GuStackWithGiantVPC extends GuStack {
	readonly vpc: IVpc;
	readonly guAppWithExposedRiffRaff: GuAppWithExposedRiffRaff;

	constructor(scope: GuAppWithExposedRiffRaff, id: string, props: GuStackProps) {
		super(scope, id, props);

		// @ts-expect-error -- we must reverse the uppercasing applied in GuStack constructor (until we replace 'rex' with 'CODE' & 'PROD)
		this.stage = props.stage;
		this.addTag("Stage", props.stage);

		this.guAppWithExposedRiffRaff = scope;

		const vpcParameter = GuVpcParameter.getInstance(this);
		vpcParameter.default = `${VPC_SSM_PARAMETER_PREFIX}/giant/id`;
		this.vpc = GuVpc.fromId(this, 'GiantVPC', { vpcId: vpcParameter.id });
	}
}
