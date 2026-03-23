import {Template} from 'aws-cdk-lib/assertions';
import {guStacks, riffRaff} from "./cdk";

describe("Giant's", () => {

	it("stacks should match the snapshots", () => {
		guStacks.forEach(stack =>
			expect(Template.fromStack(stack)).toMatchSnapshot()
		);
	});

	it("riff-raff.yaml should match the snapshot", () => {
		// @ts-expect-error - this is a private property but we need it to make the snapshot test work
		const outdir = riffRaff.outdir as string; // this changes for every test execution and best not to change cdk.ts too much
		const riffRaffYaml = riffRaff.toYAML().replaceAll(outdir, 'cdk.out');
		expect(riffRaffYaml).toMatchSnapshot();
	});

});
