# Lazy-loading POC — known limitations

Throwaway spike for [#369](https://github.com/guardian/giant/issues/369), on
branch `ljh-lazy-loading-poc` (off `ljh-targeted-folder-blob-query`).
**Not for merge.** It exists to demonstrate, on playground, that a workspace
which currently times out can be opened and navigated. It loads only the root +
depth 1 and fetches each folder's children on expand.

This is a living list — add to it as more shows up.

## Shared root cause behind several limitations

An **unexpanded folder is represented as a `TreeLeaf`** (the "ugly duckling":
`isExpandable: true`, `data` is a `WorkspaceNode`) so it can reuse the existing
`onExpandLeaf` fetch-on-expand machinery without modifying the shared
`TreeBrowser` / `Node` components.

The consequence: code that identifies a folder **structurally** —
`isTreeNode(entry)`, `findNodeById(...)`, or the drop handlers that live only on
`Node.tsx` — treats an unexpanded folder as a file. Code that identifies it
**semantically** via `isWorkspaceNode(entry.data)` still sees it correctly. Most
folder-targeted breakage below is this mismatch. Expanding a folder turns it into
a real `TreeNode` and restores the affordances (but see "mutations" below).

## Limitations

1. **You cannot put anything into an unexpanded folder.** All of these target a
   folder structurally and so fail or mis-route when it is a leaf:
   - **Drag-move** an item onto a folder — `Leaf.tsx` is not a drop target (only
     `Node.tsx` has `onDragOver`/`onDrop`).
   - **Drag-upload** files from the desktop onto a folder — same; additionally
     `onDropFiles` resolves the target via `findNodeById`, which skips leaves, so
     the upload **silently falls back to the workspace root**.
   - **Click-to-upload with a folder selected** — same target-resolution
     fallback to root.
   - **Create a subfolder** inside an unexpanded folder — `CreateFolderModal`
     gates on `isTreeLeaf` and mis-targets the parent.
   - *Workaround for the demo:* expand the folder first (it becomes a `TreeNode`
     and regains drop/upload/create), accepting the full-reload in #2.

2. **Every mutation triggers a full-tree reload.** Rename / move / delete / add /
   upload still call the real `getWorkspace` thunk, which fetches `/nodes` (slow
   on large workspaces) and replaces the tree, collapsing everything expanded.
   So mutations are effectively unusable on the large workspaces this POC targets.
   *For the demo: navigate and read; don't mutate.*

3. **No folder counts or badges.** `descendants*Count` are returned as `0`. The
   workspace summary header shows "0 folders & 0 files", and folders show no
   processing/error badges or spinner. (Counts deferred by design — see the plan.)

4. **Polling is disabled.** Per-file processing status does not auto-refresh; a
   running poll would re-fetch the root and discard the expanded tree. Reopen the
   workspace to refresh status.

5. **Deep-linking does not auto-expand.** Opening `/workspaces/:id/:nodeId` will
   not reveal a node that hasn't been loaded — the client-side path search only
   sees the already-loaded tree. Open via the bare `/workspaces/:id` URL.

6. **Flat folders with >5,000 direct children** still hit the existing truncation
   ("N files. Click to load…"). Lazy-by-depth does nothing for a single huge
   folder — that needs pagination (a later stage), not depth-based loading.

7. **Folders may lack other `Node.tsx`-only affordances until expanded** — e.g.
   the right-click context menu and folder-specific row styling.

8. **Remote-ingest in-progress items are not shown.** The POC endpoints skip the
   `remoteIngestsToMixin` synthetic entries that the real `get` endpoint mixes in,
   so in-progress captured URLs won't appear in the tree.

## What works

- Opening a large/deep workspace fast (root + depth 1).
- Expanding folders to drill down, with children fetched on demand.
- Selecting / focusing entries and search-within-folder (uses the targeted
  Stage-1 query from the base branch).
