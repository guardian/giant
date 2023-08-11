import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { Giant } from '../lib/giant';

const app = new App();
new Giant(app, 'giant-postgres-CODE', {
	stack: 'giant',
	stage: 'CODE',
	app: 'postgres',
});
