import { RiffRaffYamlFile } from '@guardian/cdk/lib/riff-raff-yaml-file';
import { Template } from 'aws-cdk-lib/assertions';
import { guStacks, neo4JRiffRaff, postgresScope } from './cdk';

describe("Giant's", () => {
	it('stacks should match the snapshots', () => {
		guStacks.forEach((stack) =>
			expect(Template.fromStack(stack)).toMatchSnapshot(),
		);
	});

	it('riff-raff.yaml(s) should match the snapshot', () => {
		expect(neo4JRiffRaff.toYAML()).toMatchSnapshot();
		expect(new RiffRaffYamlFile(postgresScope).toYAML()).toMatchSnapshot();
	});
});
