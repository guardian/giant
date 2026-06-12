# Workspace lazy loading — design notes and invariants

Working notes for the [#744](https://github.com/guardian/giant/issues/744) series (out of epic
[#369](https://github.com/guardian/giant/issues/369)). The plan and stage sequencing live in the
issue; **this document holds the things every PR in the series must stay true to**, so reviews can
check changes against named invariants instead of reconstructing them from the series history.
Update it in the same PR as any change that affects it.

## What and why, in one paragraph

Very large workspaces (100k+ items) time out because every open fetches, assembles and ships the
entire tree. The fix is to fetch lazily — root + one level first, each folder's children on
expand — for workspaces **above a size gate**, while workspaces below the gate keep today's eager
path untouched. A throwaway POC (`ljh-lazy-loading-poc`, see its `POC_KNOWN_LIMITATIONS.md`)
validated the approach end-to-end: a 101k-item workspace opened in ~2s versus ~20s eager.

## The invariants

1. **Folders are always real `TreeNode`s.** An unfetched folder is a `TreeNode` with empty
   `children`, never an "expandable leaf". Everything that identifies a folder structurally —
   drag-move, drop-upload, create-subfolder, context menu, stable sort — depends on this; the POC
   tried the leaf representation first and it broke all of them.
2. **`loadedNodeIds` is the single source of truth for "children fetched".** It distinguishes a
   loaded-but-empty folder from an unfetched one, gates refetch-on-expand, and must therefore be
   updated only when a fetch result actually lands in the tree — and pruned when nodes drop out of
   it. On the eager path every folder id is recorded at load, so "fully loaded" is the special
   case, not a different mechanism.
3. **Merges preserve already-loaded subtrees.** Refreshing a parent must not collapse or discard
   its loaded descendants (`mergeFetchedNode` keeps the old child subtree, adopting fresh
   name/data). Corollary: anything the children endpoint returns as parent/child *data* must be
   complete, because the merge adopts it wholesale — this is why the lazy queries return
   `capturedFromURL` and inline processing status, not a folder-shaped subset.
4. **Untouched branches keep their object identity.** A merge returns the same references for
   branches it didn't change, so an unapplied merge is detectable (`result === tree`) and stored
   references (selection, focus, expansion) stay meaningful.
5. **Authorisation lives in the query.** Every lazy read binds the workspace through the shared
   `FOLLOWING|OWNS … OR isPublic` clause (`matchAuthorisedWorkspace`) — the same rule as the eager
   queries — and unauthorised or cross-workspace probes are clean 404s. New lazy queries reuse the
   shared fragments rather than restating them.
6. **Under-gate workspaces are untouched.** Workspaces below the size gate keep the eager path —
   full fidelity, no lazy behaviour — at every stage of the series. The gate is config-driven and
   doubles as the kill-switch: raising it above the largest workspace reverts everything to the
   known-safe eager path.
7. **Shown counts are honest.** Where an exact number isn't known, the UI says so ("counts
   pending…"), never a precise-looking wrong figure. The workspace-level header total stays exact
   at any size (aggregate endpoint). A journalist may read a folder count as a completeness check.
8. **Shared tree components stay shared.** `TreeBrowser`/`Node`/`Leaf` have 8 consumers; lazy
   behaviour lives in the workspace-side handlers and store. (The POC needed zero shared-component
   changes; the only sanctioned exception is an optional loading affordance.)

## Known regressions and which stage retires them

Lazy loading ships value before it reaches parity. This table is the honest list — each entry
names the stage that retires it, so nothing is lost between plan revisions (the remote-ingest row
was nearly lost exactly this way: recorded in the POC limitations, absent from the first plan).

| Regression (over-gate workspaces only) | Introduced | Retired by |
|---|---|---|
| Per-folder rollup counts/badges absent on un-drilled branches ("counts pending…") | Stage 5 | Stage 8/9 (Phase III decision); fully-loaded subtrees show real counts from Stage 4's client recompute |
| Status polling paused (file status refreshes only on expand/refetch) | Stage 5 | Stage 7 |
| In-progress remote ingests not mixed into the tree | Stage 5 unless mixed in there (acceptance criterion) | Stage 5 |
| Deep links resolve only to already-loaded nodes | Stage 5 | Stage 6 |
| "Reprocess errored" button gated on a count that may read zero | Stage 5 | offer it unconditionally in lazy mode (Stage 5) or exact on-open count (Stage 8) |
| Flat folders >5,000 children still truncate (pre-existing) | — | Stage 10 |

## Decision log

- **Children fetch returns status inline** (no separate per-folder status round-trip) — POC
  confirmed cheap because scoped to one folder.
- **Per-folder children fetch is an index seek**: the known-node and root predicates are separate
  queries because OR-ing them defeats the `WorkspaceNode.id` index (~1,600 db hits vs ~9 on an
  800-node workspace). Finding the root scans until the Stage 3.5 `rootNodeId` marker lands.
- **Ancestors returns the whole path with children in one round-trip** — the POC's sequential
  per-level fetch made deep links O(depth) round-trips.
- **The aggregate endpoint is separate from metadata** so the (potentially slow at giant sizes)
  status probes never block first paint; benchmark on playground before Stage 7 polls it.

## References

- Plan and stages: [#744](https://github.com/guardian/giant/issues/744) (changelog at top)
- Performance epic: [#369](https://github.com/guardian/giant/issues/369)
- POC: branch `ljh-lazy-loading-poc` + its `POC_KNOWN_LIMITATIONS.md` (reference, not for merge)
