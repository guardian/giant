import { GuRoot } from '@guardian/cdk/lib/constructs/root';
import { RiffRaffYamlFile } from '@guardian/cdk/lib/riff-raff-yaml-file';
import { App, Stack } from 'aws-cdk-lib';
import { Neo4j } from '../lib/neo4j';
import { Postgres } from '../lib/postgres';

export const postgresScope = new GuRoot({ outdir: 'cdk.out/postgres' });
const neo4jScope = new App({ outdir: 'cdk.out/neo4j' });

const stack = 'pfi-giant';

const env = { region: 'eu-west-1' };

export const guStacks = [
	new Postgres(postgresScope, 'pfi-giant-postgres-CODE', {
		env,
		stack,
		stage: 'CODE',
		app: 'postgres',
	}),
	new Postgres(postgresScope, 'pfi-giant-postgres-PROD', {
		env,
		stack,
		stage: 'PROD',
		app: 'postgres',
	}),

	new Neo4j(neo4jScope, 'pfi-giant-neo4j-CODE', {
		env,
		stack,
		stage: 'CODE',
		app: 'neo4j',
	}),
	new Neo4j(neo4jScope, 'pfi-giant-neo4j-PROD', {
		env,
		stack,
		stage: 'PROD',
		app: 'neo4j',
	}),
];

// synthing neo4j's riff-raff.yaml explicitly (rather than replacing 'new App()' with GuRoot) so we can alter deployments
export const neo4JRiffRaff = new RiffRaffYamlFile(neo4jScope);
const neo4jDeployments = neo4JRiffRaff.riffRaffYaml.deployments;

// Remove neo4j ASG deployment steps, since neo4j rotation is handled by
// https://github.com/guardian/investigations-platform/tree/main/giant-deploy/src/main/resources/neo4j/rotation
neo4jDeployments.forEach((deployment, key) => {
	// giant uses its own image-copier FIXME remove below block when we start using standard image-copier
	{
		const maybeAmiParametersToTags =
			deployment.parameters['amiParametersToTags'];
		if (maybeAmiParametersToTags) {
			const amiParametersToTags = maybeAmiParametersToTags as Record<
				string,
				Record<string, string>
			>;
			amiParametersToTags['AMINeo4j']['Encrypted'] = 'investigations';
			// riff-raff filters responses from prism for unencrypted AMIs if `Encrypted` is not set to `true`, unless we...
			deployment.parameters['amiEncrypted'] = true;
		}
	}

	deployment.dependencies = deployment.dependencies?.filter(
		(dep) => !dep.startsWith('asg-'),
	);
	if (deployment.type === 'autoscaling') {
		neo4jDeployments.delete(key);
	}
});

neo4JRiffRaff.synth();

// workaround for 'ENOENT: no such file or directory, open 'cdk.out/manifest.json' given we set custom outdir(s)
// see https://github.com/aws/aws-cdk/issues/3717 and
new Stack(new App());
