import {App, Stack} from "aws-cdk-lib";
import {GiantApp} from "../lib/constructs/GiantApp";
import {GuAppWithExposedRiffRaff} from "../lib/constructs/GuAppWithExposedRiffRaff";
import type {GuStackWithGiantVPC} from "../lib/constructs/GuStackWithGiantVPC";
import {MainGiantStack} from "../lib/giant";
import {Postgres} from '../lib/postgres';

const postgresScope = new GuAppWithExposedRiffRaff({ outdir: "cdk.out/postgres"});
const postgresStack = 'pfi-giant';

const env = { region: "eu-west-1" };

// NOTE how the stack / stage combos are a little confusing here (we really should move all playground stuff to 'CODE')
export const guStacks: GuStackWithGiantVPC[] = [

	new Postgres(postgresScope, 'pfi-giant-postgres-CODE', {
		env,
		stack: postgresStack,
		stage: 'CODE',
		app: 'postgres',
	}),
	new Postgres(postgresScope, 'pfi-giant-postgres-PROD', {
		env,
		stack: postgresStack,
		stage: 'PROD',
		app: 'postgres',
	}),

	new MainGiantStack(new GiantApp({outdir: "cdk.out/main/pfi-playground"}), 'pfi-playground-investigations-rex', {
		env,
		stack: "pfi-playground",
		stage: 'rex', // CODE
		app: "pfi",
	}),

	new MainGiantStack(new GiantApp({outdir: "cdk.out/main/pfi-giant"}), 'pfi-giant-investigations-rex', {
		env,
		stack: "pfi-giant",
		stage: 'rex', // PROD
		app: "pfi",
	}),
];

/*
* since the others stacks all write to separate custom 'outdir', and cdk checks the default cdk.out/manifest.json
* after synth, we need to create an empty App here to ensure that the cdk.out/manifest.json is created, to prevent
* NOENT: no such file or directory, open 'cdk.out/manifest.json'
* */
new Stack(new App());
