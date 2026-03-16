import {RiffRaffYamlFile} from "@guardian/cdk/lib/riff-raff-yaml-file";
import {App} from "aws-cdk-lib";
import { Postgres } from '../lib/postgres';

const app = new App();

const stack = 'pfi-giant';

const env = { region: "eu-west-1" };

export const guStacks = [

	new Postgres(app, 'pfi-giant-postgres-CODE', {
		env,
		stack,
		stage: 'CODE',
		app: 'postgres',
	}),
	new Postgres(app, 'pfi-giant-postgres-PROD', {
		env,
		stack,
		stage: 'PROD',
		app: 'postgres',
	}),

];

// synthing the riff-raff.yaml explicitly (rather than replacing 'new App()' with GuRoot) so we can alter deployments
export const riffRaff = new RiffRaffYamlFile(app);
riffRaff.synth();

