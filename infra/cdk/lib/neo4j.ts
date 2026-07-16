import { GuAutoScalingGroup } from '@guardian/cdk/lib/constructs/autoscaling';
import type { GuStackProps } from '@guardian/cdk/lib/constructs/core';
import { GuVpc, SubnetType } from '@guardian/cdk/lib/constructs/ec2/vpc';
import type { App } from 'aws-cdk-lib';
import { Fn } from 'aws-cdk-lib';
import {
	InstanceClass,
	InstanceSize,
	InstanceType,
	SecurityGroup,
	UserData,
} from 'aws-cdk-lib/aws-ec2';
import { ArnPrincipal, ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import { GuStackWithGiantVPC } from './constructs/GuStackWithGiantVPC';

const app = 'neo4j';
const legacyStage = 'rex';

export class Neo4j extends GuStackWithGiantVPC {
	constructor(scope: App, id: string, props: GuStackProps) {
		super(scope, id, props);

		const legacyStack = this.stage === 'PROD' ? 'pfi-giant' : 'pfi-playground';

		const distBucket = Fn.importValue(`${legacyStack}-shared-DistBucket`);

		const dataVolumeKmsKeyArn = Fn.importValue(
			`${legacyStack}-shared-KmsKeyArn`,
		);

		const dataVolumeSizeInGB = this.stage === 'PROD' ? 100 : 50;

		// TODO move the scripts etc. into this repo so we can use GuUserData (and deploy the artifacts with riff-raff)
		const userData = UserData.forLinux();
		userData.addCommands(
			// TODO do we need the shebang
			`export AWS_DEFAULT_REGION=${this.region}`, // TODO not sure why this is needed
			`aws s3 cp s3://${distBucket}/${legacyStack}/${legacyStage}/neo4j/scripts/setup-neo4j-instance.sh .`,
			`chmod u=rwx setup-neo4j-instance.sh`,
			`./setup-neo4j-instance.sh '${distBucket}' '${dataVolumeSizeInGB}' '${dataVolumeKmsKeyArn}'`,
		);

		const asg = new GuAutoScalingGroup(this, 'ASG', {
			app,
			vpc: this.vpc,
			vpcSubnets: {
				subnets: GuVpc.subnetsFromParameter(this, {
					type: SubnetType.PRIVATE,
				}),
			},
			instanceMetricGranularity: '1Minute',
			instanceType:
				this.stage === 'PROD'
					? // TODO use graviton for 2027 reservations
					  //  (for the relatively minor savings it wasn't worth coupling Neo4J upgrade [to 4 or greater] with 2026 instance reservations)
					  InstanceType.of(InstanceClass.M6I, InstanceSize.XLARGE) // "m6i.xlarge"
					: InstanceType.of(InstanceClass.T3, InstanceSize.LARGE), // "t3.large",
			minimumInstances: 1,
			userData,
			imageRecipe: {
				Recipe: 'investigations-neo4j-v4-jammy-java11',
				Encrypted: true,
			},
			additionalSecurityGroups: [
				SecurityGroup.fromSecurityGroupId(
					this,
					'CommonSecurityGroup',
					// TODO is this definitely adding something beyond the GuCDK defaults
					Fn.importValue(`${legacyStack}-shared-CommonInstanceSecurityGroup`),
				),
				// apparently "Ingress and egress rules are cloudformed in the Giant app template to avoid a circular dependency"
			],
			// TODO do we need to specify the MetadataOptions
		});

		asg.role.addManagedPolicy(
			ManagedPolicy.fromManagedPolicyArn(
				this,
				'CommonInstancePolicy',
				// TODO is this really needed
				Fn.importValue(`${legacyStack}-shared-CommonInstancePolicy`),
			),
		);

		// This is required to create a new EBS volume from a snapshot when restoring from a backup
		asg.role.grant(
			new ArnPrincipal(dataVolumeKmsKeyArn),
			'kms:Encrypt',
			'kms:Decrypt',
			'kms:ReEncrypt*',
			'kms:GenerateDataKey*',
			'kms:DescribeKey',
		);

		asg.role.grant(
			// TODO migrate these values to the standard GuCDK location (once the old neo4j stack is retired)
			new ArnPrincipal(
				`arn:aws:ssm:${this.region}:${this.account}:parameter/${legacyStack}/${legacyStage}/*`,
			),
			'ssm:GetParameters',
		);

		asg.role.grant(
			new ArnPrincipal(`arn:aws:ec2:${this.region}:${this.account}:volume/*`),
			'ec2:CreateTags',
		);

		asg.role.grant(
			new ArnPrincipal(`arn:aws:ec2:${this.region}::snapshot/*`),
			'ec2:DeleteSnapshot',
		);
	}
}
