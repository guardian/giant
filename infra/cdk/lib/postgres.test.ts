import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Postgres } from './postgres';

describe("Giant's 'postgres' stack", () => {
	it('matches the snapshot', () => {
		const app = new App();
		const stack = new Postgres(app, 'postgres', {
			stack: 'pfi-playground',
			stage: 'TEST',
		});
		const template = Template.fromStack(stack);
		expect(template.toJSON()).toMatchSnapshot();
	});
});
