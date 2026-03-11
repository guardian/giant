import {VPC_SSM_PARAMETER_PREFIX} from "@guardian/cdk/lib/constants/ssm-parameter-paths";
import {
	GuStack,
	type GuStackProps,
	GuVpcParameter,
} from '@guardian/cdk/lib/constructs/core';
import { GuVpc } from '@guardian/cdk/lib/constructs/ec2/vpc';
import { type App } from 'aws-cdk-lib';
import type { IVpc } from 'aws-cdk-lib/aws-ec2';

export class GuStackWithGiantVPC extends GuStack {
	readonly vpc: IVpc;

	constructor(scope: App, id: string, props: GuStackProps) {
		super(scope, id, props);

		const vpcParameter = GuVpcParameter.getInstance(this);
		vpcParameter.default = `${VPC_SSM_PARAMETER_PREFIX}/giant/id`;
		this.vpc = GuVpc.fromId(this, 'GiantVPC', { vpcId: vpcParameter.id });
	}
}
