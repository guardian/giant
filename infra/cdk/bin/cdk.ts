import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { Postgres } from '../lib/postgres';

const app = new App();

const stack = 'pfi-giant';

new Postgres(app, 'pfi-giant-postgres-CODE', {
	stack,
	stage: 'CODE',
	app: 'postgres',
});
new Postgres(app, 'pfi-giant-postgres-PROD', {
	stack,
	stage: 'PROD',
	app: 'postgres',
});
