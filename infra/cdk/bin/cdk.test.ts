import {Template} from 'aws-cdk-lib/assertions';
import {guStacks} from "./cdk";

describe("Giant's", () => {

	it("stacks should match the snapshots", () => {
		guStacks.forEach(stack =>
			expect(Template.fromStack(stack)).toMatchSnapshot()
		);
	});

	it("riff-raff.yaml(s) should match the snapshot", () => {
		new Set(guStacks.map(_ => _.guAppWithExposedRiffRaff)).forEach(guAppWithExposedRiffRaff => {
			const riffRaff = guAppWithExposedRiffRaff.riffRaff;
			// @ts-expect-error - this is a private property, but we need it to make the snapshot test work
			const outdir = riffRaff.outdir as string; // this changes for every test execution and best not to change cdk.ts too much
			const riffRaffYaml = riffRaff.toYAML().replaceAll(outdir, 'cdk.out');
			expect(riffRaffYaml).toMatchSnapshot();
		});
	});

});
