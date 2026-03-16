import { Postgres } from '../lib/postgres';
import {App} from "aws-cdk-lib";
import {RiffRaffYamlFile} from "@guardian/cdk/lib/riff-raff-yaml-file";

const app = new App();

const stack = 'pfi-giant';

const env = { region: "eu-west-1" };

new Postgres(app, 'pfi-giant-postgres-CODE', {
	env,
	stack,
	stage: 'CODE',
	app: 'postgres',
});
new Postgres(app, 'pfi-giant-postgres-PROD', {
	env,
	stack,
	stage: 'PROD',
	app: 'postgres',
});

// synthing the riff-raff.yaml explicitly (rather than replacing 'new App()' with GuRoot) so we can alter deployments
const riffRaff = new RiffRaffYamlFile(app);
riffRaff.synth();
