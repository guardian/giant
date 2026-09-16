import guardian from '@guardian/eslint-config';
import importX from 'eslint-plugin-import-x';

export default [
	{
		ignores: ['**/*.js', 'node_modules', 'cdk.out'],
	},
	...guardian.configs.recommended,
	...guardian.configs.jest,
	{
		plugins: {
			import: importX,
		},
		rules: {
			'import/no-namespace': 'error',
		},
	},
];
