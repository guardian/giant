Migrate a small, coherent batch of frontend JavaScript to TypeScript. Follow AGENTS.md.
Make the changes now; the workflow will commit them and open a pull request.

Aim for five existing .js/.jsx files under frontend/src, choosing related, manageable
files. Five is a rough target, not a quota: migrate fewer for a complex boundary,
or a few more when that keeps a closely related group together. Judge reviewability
by the actual diff, including supporting types, schemas, tests, and import changes.
Prefer a few hundred substantive changed lines; defer large files or broad refactors.

Only edit frontend/src. Do not change dependencies, configuration, workflows, or
generated files. Dependencies are already installed, including Zod 4. Do not commit,
push, or create a PR yourself. Do not change git configuration or branches.

Use .tsx for JSX and .ts otherwise. Preserve behavior and public interfaces; update
explicit .js imports where necessary. Keep the functional style simple and readable.
Create useful types for props, state, parameters, results, and domain objects.
Reuse existing types where accurate; keep local types local and share types only
where relevant. Do not use any, @ts-ignore, @ts-nocheck, broad assertions, or weaker
checks to make the migration compile. Do not remove runtime PropTypes that existing
JavaScript consumers still use.

At JSON boundaries touched by this batch (API responses, JSON.parse, persisted data),
create or reuse an accurate Zod schema and infer its TypeScript type with z.infer.
Treat incoming values as unknown and actually call schema.safeParse before consuming
them. Use result.data only on success. Handle failure explicitly through the existing
error path or an appropriate documented fallback; never cast unvalidated JSON to a
domain type or silently turn invalid data into success. Remember JSON.parse and
response.json can themselves throw/reject before safeParse runs.

Inspect backend serializers, callers, fixtures, and existing schemas to establish
the wire format rather than guessing. Account for optional versus nullable fields,
arrays, and date strings. Preserve unknown fields if callers rely on them (Zod object
schemas strip them by default). Do not expand this into a project-wide API rewrite.
If a boundary cannot be understood or migrated safely within this batch, pick a
different batch. Add focused tests for new schema validation and failure handling,
covering valid data and relevant malformed, missing, or nullable values.

The baseline checks passed before your run. Run these from frontend and fix any
regressions before finishing: npm run build, npm run lint, npm test, and
npm run prettier:check. Format only changed files. Inspect the final diff for
accidental behavior changes, unrelated formatting, and unnecessary complexity.

Your final response will become the PR description. Concisely describe the concrete
changes, list migrated files and why they belong together, explain deviations from
five files, identify schemas and invalid-data behavior, and report checks actually
run and any review concerns. Do not claim checks passed unless they did.
