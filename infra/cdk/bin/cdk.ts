import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { Giant } from '../lib/giant';

const app = new App();
new Giant(app, 'pfi-giant-postgres-CODE', {
	stack: 'pfi-giant',
	stage: 'CODE',
	app: 'postgres',
});
new Giant(app, 'pfi-giant-postgres-PROD', {
	stack: 'pfi-giant',
	stage: 'PROD',
	app: 'postgres',
});