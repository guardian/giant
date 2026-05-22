import {
  findNodeById,
  mergeWorkspaceStatus,
  workspaceHasProcessingFiles,
} from "./workspaceUtils";
import {
  workspaceFlatWithOneProcessing,
  workspaceFlatWithZeroProcessing,
  workspaceWithOneProcessing,
  workspaceWithOneProcessingBottomHeavyTree,
  workspaceWithTwoProcessing,
  workspaceWithZeroProcessing,
  workspaceWithZeroProcessingBottomHeavyTree,
} from "./workspaceUtils.fixtures";
import { makeLeaf, makeNode } from "./workspaceNavigation.spec";
import {
  isWorkspaceLeaf,
  isWorkspaceNode,
  Workspace,
  WorkspaceEntry,
  WorkspaceFileStatus,
  WorkspaceLeaf,
  WorkspaceNode,
} from "../types/Workspaces";
import { isTreeLeaf, TreeEntry, TreeNode } from "../types/Tree";

test("workspaceHasProcessingFiles", () => {
  expect(workspaceHasProcessingFiles(workspaceWithZeroProcessing)).toBe(false);
  expect(
    workspaceHasProcessingFiles(workspaceWithZeroProcessingBottomHeavyTree),
  ).toBe(false);
  expect(workspaceHasProcessingFiles(workspaceWithOneProcessing)).toBe(true);
  expect(
    workspaceHasProcessingFiles(workspaceWithOneProcessingBottomHeavyTree),
  ).toBe(true);
  expect(workspaceHasProcessingFiles(workspaceWithTwoProcessing)).toBe(true);

  expect(workspaceHasProcessingFiles(workspaceFlatWithZeroProcessing)).toBe(
    false,
  );
  expect(workspaceHasProcessingFiles(workspaceFlatWithOneProcessing)).toBe(
    true,
  );
});

describe("mergeWorkspaceStatus", () => {
  const user = { username: "joe", displayName: "Joe" };

  // A structure-tree leaf, as returned by /structure: stage always "unknown".
  function structureLeaf(uri: string): TreeEntry<WorkspaceEntry> {
    return {
      id: uri,
      name: uri,
      isExpandable: false,
      data: {
        uri,
        addedBy: user,
        mimeType: "application/pdf",
        processingStage: { type: "unknown" },
      },
    };
  }

  // A structure-tree folder: /structure preserves the structural counts but
  // zeroes the processing/failure roll-ups, which is what we recompute.
  function structureNode(
    id: string,
    children: TreeEntry<WorkspaceEntry>[],
    structuralCounts: { leaf: number; node: number },
  ): TreeNode<WorkspaceEntry> {
    return {
      id,
      name: id,
      children,
      data: {
        addedBy: user,
        descendantsLeafCount: structuralCounts.leaf,
        descendantsNodeCount: structuralCounts.node,
        descendantsProcessingTaskCount: 0,
        descendantsFailedCount: 0,
      },
    };
  }

  function makeWorkspace(rootNode: TreeNode<WorkspaceEntry>): Workspace {
    return {
      id: "ws",
      name: "ws",
      isPublic: false,
      tagColor: "blue",
      owner: user,
      creator: user,
      followers: [],
      rootNode,
    };
  }

  function leafByUri(
    workspace: Workspace,
    uri: string,
  ): WorkspaceLeaf | undefined {
    let found: WorkspaceLeaf | undefined;
    const visit = (entry: TreeEntry<WorkspaceEntry>) => {
      if (isTreeLeaf(entry) && isWorkspaceLeaf(entry.data)) {
        if (entry.data.uri === uri) found = entry.data;
      } else if (!isTreeLeaf(entry)) {
        entry.children.forEach(visit);
      }
    };
    visit(workspace.rootNode);
    return found;
  }

  function nodeData(node: TreeNode<WorkspaceEntry>): WorkspaceNode {
    if (!isWorkspaceNode(node.data)) throw new Error("expected a folder node");
    return node.data;
  }

  const processing = (
    tasksRemaining: number,
    note?: string,
  ): WorkspaceFileStatus["processingStage"] => ({
    type: "processing",
    tasksRemaining,
    note,
  });

  function status(
    uri: string,
    processingStage: WorkspaceFileStatus["processingStage"],
    overrides: Partial<WorkspaceFileStatus> = {},
  ): WorkspaceFileStatus {
    return {
      uri,
      processingStage,
      numberOfTodos:
        processingStage.type === "processing"
          ? processingStage.tasksRemaining
          : 0,
      hasFailures: processingStage.type === "failed",
      ...overrides,
    };
  }

  test("maps each status entry to the matching leaf by uri", () => {
    const workspace = makeWorkspace(
      structureNode(
        "root",
        [structureLeaf("u1"), structureLeaf("u2"), structureLeaf("u3")],
        { leaf: 3, node: 0 },
      ),
    );

    const merged = mergeWorkspaceStatus(workspace, [
      status("u1", processing(3, "ocr")),
      status("u2", { type: "failed" }),
      status("u3", { type: "processed" }),
    ]);

    expect(leafByUri(merged, "u1")?.processingStage).toEqual({
      type: "processing",
      tasksRemaining: 3,
      note: "ocr",
    });
    expect(leafByUri(merged, "u2")?.processingStage).toEqual({
      type: "failed",
    });
    expect(leafByUri(merged, "u3")?.processingStage).toEqual({
      type: "processed",
    });
  });

  test("leaves without a status entry keep their unknown stage", () => {
    const workspace = makeWorkspace(
      structureNode("root", [structureLeaf("u1"), structureLeaf("u2")], {
        leaf: 2,
        node: 0,
      }),
    );

    const merged = mergeWorkspaceStatus(workspace, [
      status("u1", { type: "processed" }),
    ]);

    expect(leafByUri(merged, "u2")?.processingStage).toEqual({
      type: "unknown",
    });
  });

  test("recomputes folder roll-ups from merged leaf stages", () => {
    const folderA = structureNode(
      "folderA",
      [structureLeaf("u1"), structureLeaf("u2")],
      { leaf: 2, node: 0 },
    );
    const root = structureNode("root", [folderA, structureLeaf("u3")], {
      leaf: 3,
      node: 1,
    });
    const workspace = makeWorkspace(root);

    const merged = mergeWorkspaceStatus(workspace, [
      status("u1", processing(3)),
      status("u2", { type: "failed" }),
      status("u3", processing(2)),
    ]);

    const mergedFolderA = merged.rootNode
      .children[0] as TreeNode<WorkspaceEntry>;
    expect(nodeData(mergedFolderA).descendantsProcessingTaskCount).toBe(3);
    expect(nodeData(mergedFolderA).descendantsFailedCount).toBe(1);

    // root aggregates the nested folder plus its own direct leaf
    expect(nodeData(merged.rootNode).descendantsProcessingTaskCount).toBe(5);
    expect(nodeData(merged.rootNode).descendantsFailedCount).toBe(1);
  });

  test("preserves structural roll-up counts", () => {
    const root = structureNode("root", [structureLeaf("u1")], {
      leaf: 1,
      node: 0,
    });
    const merged = mergeWorkspaceStatus(makeWorkspace(root), [
      status("u1", { type: "processed" }),
    ]);

    expect(nodeData(merged.rootNode).descendantsLeafCount).toBe(1);
    expect(nodeData(merged.rootNode).descendantsNodeCount).toBe(0);
  });

  test("does not mutate the input workspace", () => {
    const root = structureNode("root", [structureLeaf("u1")], {
      leaf: 1,
      node: 0,
    });
    const workspace = makeWorkspace(root);

    mergeWorkspaceStatus(workspace, [status("u1", processing(4))]);

    expect(leafByUri(workspace, "u1")?.processingStage).toEqual({
      type: "unknown",
    });
    expect(nodeData(workspace.rootNode).descendantsProcessingTaskCount).toBe(0);
  });
});

describe("findNodeById", () => {
  test("returns the root when id matches", () => {
    const root = makeNode("root", []);
    expect(findNodeById(root, "root")).toBe(root);
  });

  test("returns undefined when not found", () => {
    const root = makeNode("root", [makeLeaf("doc.pdf", "uri-1")]);
    expect(findNodeById(root, "nonexistent")).toBeUndefined();
  });

  test("finds deeply nested node", () => {
    const deep = makeNode("deep", []);
    const root = makeNode("root", [makeNode("a", [makeNode("b", [deep])])]);
    expect(findNodeById(root, "deep")).toBe(deep);
  });
});
