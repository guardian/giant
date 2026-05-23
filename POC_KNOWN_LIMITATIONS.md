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

Rename, delete (item + resource), create-folder, and **move** no longer reload the
whole tree: each refetches only the **affected parent folder(s)** — for move, the
destination *and* each item's old parent — via the same children endpoint, and the
reducer merge **preserves already-loaded descendant subtrees**, so mutating one
item doesn't collapse its expanded siblings. The mutation thunks take an
`affectedParentIds` argument supplied by the component (from each entry's
`maybeParentId`). No more eager `/nodes` reload on these paths, so no timeout.

## Limitations

1. **Upload, copy, and reprocess still reload to depth-1.** These refresh via paths
   the spike didn't rewire (`UploadFiles`' own refresh prop; copy/reprocess thunks),
   which now route through the lazy loader — so they reload **root + depth 1**
   rather than the full tree. That's fast (no timeout) but **collapses the expanded
   tree to the top level**. Same "refresh affected parent" treatment would fix them;
   left as follow-up. Move's old-parent set is taken from `selectedEntries`, so a
   drag of a non-selected item refreshes the destination only (source goes stale
   until reload) — an edge case.

2. **No folder counts or badges.** Descendant counts aren't computed under lazy
   loading, so folders and the workspace header show **"counts pending..."**
   rather than a (wrong) "empty"/"0 files", and there are no processing/error
   badges or spinners. Honest-but-absent, by design — counts are a later stage.

3. **Polling is disabled.** Per-file processing status does not auto-refresh; a
   running poll would re-fetch the root and discard the expanded tree. Reopen the
   workspace to refresh status.

4. **Deep-linking does not auto-expand.** Opening `/workspaces/:id/:nodeId` will
   not reveal a node that hasn't been loaded — the client-side path search only
   sees the already-loaded tree. Open via the bare `/workspaces/:id` URL.

5. **Flat folders with >5,000 direct children** still hit the existing truncation
   ("N files. Click to load…"). Lazy-by-depth does nothing for a single huge
   folder — that needs pagination (a later stage), not depth-based loading.

6. **Remote-ingest in-progress items are not shown.** The POC endpoints skip the
   `remoteIngestsToMixin` synthetic entries that the real `get` endpoint mixes in,
   so in-progress captured URLs won't appear in the tree.

7. **Brief empty flash on expand.** Expanding a folder marks it open immediately
   but renders nothing until the children fetch returns (~ms on playground). A
   real build would show a per-folder loading row.

## What works

- Opening a large/deep workspace fast (root + depth 1).
- Drilling down — folders are nodes, fetched on first expand, cached thereafter.
- Drag/drop into folders, uploads into a selected folder, context menu, and
  sort-stable-on-expand (all fixed by the node representation).
- Rename / delete / create-folder / move — incremental, refreshing only the
  affected parent(s) and keeping the rest of the tree expanded.
- Selecting / focusing entries and search-within-folder (targeted Stage-1 query).
