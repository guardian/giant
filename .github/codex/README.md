# Daily TypeScript migrations

The workflow runs daily at 07:23 UTC, when its workflow file changes on `main`,
and can also be started from Actions → Daily
TypeScript migration → Run workflow. It starts from the triggering branch and
targets that branch with its generated PR; scheduled runs use the default branch.
It targets roughly five related frontend JavaScript files, adds relevant types and
Zod schemas, and opens a PR only after build/typecheck, lint, tests, and formatting
pass. The same checks run before generation so existing failures do not prompt
unrelated repairs. Changes are restricted to `frontend/src` and the migration plan.

## Setup

1. Add an Actions repository secret named `OPENAI_API_KEY` with an API key that has
   access to a coding model.
2. In Settings → Actions → General → Workflow permissions, enable **Allow GitHub
   Actions to create and approve pull requests**. Organisation policy must allow it.
   The workflow only creates PRs; it does not approve or merge them.
3. Optionally set the Actions variable `TYPESCRIPT_MIGRATION_MODEL` to a model
   available to your API project. Otherwise the Codex action uses its default model.
4. Merge these files into the default branch to activate the schedule.

The integration uses the [official Codex GitHub Action](https://learn.chatgpt.com/docs/github-action).
API usage is billed to the key's project. Generation has a 35-minute timeout and
the whole migration job has a 60-minute timeout; these are not monetary spend caps.

## Review and operation

Before merging the automation, changes to the workflow file on
`automation/setup-daily-typescript-migration` also trigger a run. These runs use
the instructions and source on that branch and open a PR against it from
`automation/typescript-migration-test`. This lets reviewers inspect a generated
migration without merging the setup PR. Test PRs do not block default-branch runs.
Close the test PR when finished; remove the setup branch from the push trigger
when pre-merge testing is no longer needed.

Only one migration PR is open at a time, on `automation/typescript-migration`.
While it is open, scheduled and manual runs skip generation, preserving the diff
under review and avoiding duplicate work. Merge or close it before the next batch.
Closing without merging may cause the same files to be selected again. Runs also
stop before generation once no JavaScript source files remain.

PRs use `GITHUB_TOKEN`, so their creation and push do not trigger other workflows.
The migration workflow runs frontend checks itself and links their run in the PR.
If branch protection requires other checks, run the existing manually dispatchable
CI/format workflows against the migration branch before merging. Apply the appropriate
CORE4 label during review, as required by the repository's label policy.

The ordered backlog in [typescript-migration-plan.md](typescript-migration-plan.md)
covers the remaining JavaScript files, starting with shared utilities, then API
contracts and Redux slices, their UI consumers, and finally store wiring and startup.
Large steps can span several PRs. Each migration PR removes its completed file
entries (and empty steps) from the plan; merging the PR advances the backlog.
The bot can update this plan but cannot edit its standing instructions or workflow.

Tune standing migration and JSON validation instructions in
`typescript-migration.md`. Five is a prompt target rather than a hard file limit;
supporting schemas and tests count toward the review effort. Failed generation or
checks do not publish a PR; inspect the Actions logs before retrying.
