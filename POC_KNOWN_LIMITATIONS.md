# Lazy-loading POC — known limitations

Throwaway spike for [#369](https://github.com/guardian/giant/issues/369), on
branch `ljh-lazy-loading-poc` (off `ljh-targeted-folder-blob-query`).
**Not for merge.** It exists to demonstrate, on playground, that a workspace
which currently times out can be opened and navigated. It loads only the root +
depth 1 and fetches each folder's children on expand.

This is a living list — add to it as more shows up.

## Representation: folders are lazy `TreeNode`s

An unexpanded folder is a real `TreeNode` with **no children loaded yet** (empty
`children`). The frontend records which node ids have had their children fetched
(`loadedNodeIds` in Redux) and loads them on first expand; collapse/re-expand is
cached. This is the representation we'd use "properly", so the spike's learnings
transfer.

This deliberately replaced an earlier shortcut (folder = expandable `TreeLeaf`),
which had broken everything that identifies a folder **structurally** —
`isTreeNode`, `findNodeById`, the drop handlers on `Node.tsx`. With folders as
nodes again, that whole cluster works: **drag-move into a folder, drag-upload and
click-to-upload into a folder, create-subfolder, the right-click context menu,
and stable sort on expand are all restored** (a folder no longer changes type
when expanded).

## Mutations (now incremental)

All mutations now refresh only the **affected parent folder(s)** rather than
reloading the whole tree — rename, delete (item + resource), create-folder, move
(destination *plus* each item's old parent), copy, reprocess (blob → its parent;
folder → itself), and **upload** (the drop target / focused folder). The reducer
merge **preserves already-loaded descendant subtrees**, so mutating one item
doesn't collapse its expanded siblings. Mutation thunks take an
`affectedParentIds` argument supplied by the component (from each entry's
`maybeParentId`); `refreshAfterMutation` refetches those, falling back to a fast
depth-1 reload only when the affected parent is genuinely unknown. No eager
`/nodes` reload remains on any mutation path.

## Limitations

1. **A few mutation-refresh edge cases.** *Move:* old-parent ids come from
   `selectedEntries`, so dragging a *non-selected* item refreshes the destination
   only (source goes stale until next reload). *Upload:* the refreshed folder is a
   best-effort target (drop target → focused folder → root), so an upload via an
   unusual path may refresh the wrong folder. *Reprocess:* refreshes the folder's
   status immediately, but with polling disabled (below) it won't keep updating as
   reprocessing progresses. *Copy:* refreshes the destination if it's in the
   current workspace; cross-workspace copies fall back to a depth-1 reload.

2. **Counts: the cheap ones show; the hard one is deferred.** The header shows the
   **accurate workspace total** (a cheap `COUNT` on root load, any size). A folder
   shows its **real file/folder counts once its whole subtree is loaded** — so
   small/shallow workspaces and any fully-drilled folder show real numbers, while a
   folder with un-fetched descendants honestly shows **"counts pending..."**. Still
   deferred (the genuinely hard part): accurate roll-ups for *partially*-loaded
   folders in big, deep workspaces — that's the real Stage 9. Processing/error
   badges + spinners remain absent (status roll-ups deferred, polling disabled).

3. **No size gate — every workspace uses the lazy path.** The POC lazy-loads all
   workspaces regardless of size (the gate keys off `nodeCount`/PR #742, not in this
   branch). The real plan keeps workspaces under the gate (~50k) on the eager
   full-tree path with zero regression; here even a tiny workspace is lazy (now with
   real counts, so it still looks right).

4. **Polling is disabled.** Per-file processing status does not auto-refresh; a
   running poll would re-fetch the root and discard the expanded tree. Reopen the
   workspace to refresh status.

5. **Deep-linking does not auto-expand.** Opening `/workspaces/:id/:nodeId` will
   not reveal a node that hasn't been loaded — the client-side path search only
   sees the already-loaded tree. Open via the bare `/workspaces/:id` URL.

6. **Flat folders with >5,000 direct children** still hit the existing truncation
   ("N files. Click to load…"). Lazy-by-depth does nothing for a single huge
   folder — that needs pagination (a later stage), not depth-based loading.

7. **Remote-ingest in-progress items are not shown.** The POC endpoints skip the
   `remoteIngestsToMixin` synthetic entries that the real `get` endpoint mixes in,
   so in-progress captured URLs won't appear in the tree.

8. **Brief empty flash on expand.** Expanding a folder marks it open immediately
   but renders nothing until the children fetch returns (~ms on playground). A
   real build would show a per-folder loading row.

## What works

- Opening a large/deep workspace fast (root + depth 1).
- Drilling down — folders are nodes, fetched on first expand, cached thereafter.
- Drag/drop into folders, uploads into a selected folder, context menu, and
  sort-stable-on-expand (all fixed by the node representation).
- All mutations (rename / delete / create-folder / move / copy / reprocess /
  upload) — incremental, refreshing only the affected parent(s) and keeping the
  rest of the tree expanded.
- Accurate workspace total in the header, and real per-folder counts for any
  fully-loaded subtree (deeper un-drilled folders show "counts pending...").
- Selecting / focusing entries and search-within-folder (targeted Stage-1 query).
