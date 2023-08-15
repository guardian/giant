import type { GuStackProps } from '@guardian/cdk/lib/constructs/core';
import {
	AppIdentity,
	GuParameter,
	GuStack,
	GuStringParameter,
} from '@guardian/cdk/lib/constructs/core';
import { GuVpc, SubnetType } from '@guardian/cdk/lib/constructs/ec2/vpc';
import type { App } from 'aws-cdk-lib';
import { CfnOutput, Duration, SecretValue } from 'aws-cdk-lib';
import {
	InstanceClass,
	InstanceSize,
	InstanceType,
	Port,
	SecurityGroup,
} from 'aws-cdk-lib/aws-ec2';
import {
	Credentials,
	DatabaseInstance,
	DatabaseInstanceEngine,
	PostgresEngineVersion,
	StorageType,
} from 'aws-cdk-lib/aws-rds';

export class Giant extends GuStack {
	constructor(scope: App, id: string, props: GuStackProps) {
		super(scope, id, props);

		const vpc = GuVpc.fromIdParameter(
			this,
			'GiantVPC',
		);

		const dbStorage = 20;

		const DATABASE_MASTER_USER = 'giant_master';
		const DATABASE_PORT = 5432;

		const databaseSecurityGroup = new SecurityGroup(
			this,
			'DatabaseSecurityGroup',
			{
				vpc: vpc,
			},
		);

		new DatabaseInstance(this, 'Database', {
			vpc: vpc,
			vpcSubnets: {
				subnets: GuVpc.subnetsFromParameter(this, {
					type: SubnetType.PRIVATE,
				}),
			},
			engine: DatabaseInstanceEngine.postgres({
				version: PostgresEngineVersion.VER_13,
			}),
			allocatedStorage: dbStorage,
			maxAllocatedStorage: dbStorage + 20,
			autoMinorVersionUpgrade: true,
			backupRetention: Duration.days(14),
			instanceType: InstanceType.of(
				InstanceClass.T4G,
				this.stage === 'PROD' ? InstanceSize.MICRO : InstanceSize.MICRO,
			),
			instanceIdentifier: `giant-db-${this.stage}`,
			databaseName: 'giant',
			deletionProtection: true,
			cloudwatchLogsExports: ['postgresql'],
			iamAuthentication: true,
			multiAz: false,
			publiclyAccessible: false,
			storageEncrypted: true,
			storageType: StorageType.GP3,
			monitoringInterval: Duration.minutes(1),
			port: DATABASE_PORT,
			securityGroups: [databaseSecurityGroup],
			credentials: Credentials.fromGeneratedSecret(DATABASE_MASTER_USER, {
				secretName: `${props.stack}-postgres-${props.stage}`,
			}),
		});

		const dbAccessSecurityGroup = new SecurityGroup(this, 'db-access', {
			vpc: vpc,
			allowAllOutbound: false,
		});
		dbAccessSecurityGroup.addEgressRule(
			databaseSecurityGroup,
			Port.tcp(DATABASE_PORT),
			'Allow DB access',
		);

		databaseSecurityGroup.addIngressRule(
			dbAccessSecurityGroup,
			Port.tcp(DATABASE_PORT),
		);

		new CfnOutput(this, 'DbAccessSecurityGroup', {
			exportName: `${props.stack}-postgres-${props.stage}-DbAccessSecurityGroup`,
			value: dbAccessSecurityGroup.securityGroupId,
		});
	}
}
