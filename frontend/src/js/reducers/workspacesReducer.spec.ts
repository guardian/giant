import workspaces from "./workspacesReducer";
import { WorkspacesState } from "../types/redux/GiantState";
import { WorkspacesActionType } from "../types/redux/GiantActions";
import { TreeEntry, TreeLeaf, TreeNode } from "../types/Tree";
import {
  Workspace,
  WorkspaceEntry,
  WorkspaceLeaf,
  WorkspaceNode,
} from "../types/Workspaces";
import { PartialUser } from "../types/User";

// --- fixtures ---

const user: PartialUser = { username: "paul", displayName: "Paul" };

const folderData: WorkspaceNode = {
  addedBy: user,
  descendantsLeafCount: 0,
  descendantsNodeCount: 0,
  descendantsProcessingTaskCount: 0,
  descendantsProcessingLeafCount: 0,
  descendantsFailedCount: 0,
};

const leafData: WorkspaceLeaf = {
  addedBy: user,
  processingStage: { type: "processed" },
  uri: "file-uri",
  mimeType: "text/plain",
};

const mkFolder = (
  id: string,
  children: TreeEntry<WorkspaceEntry>[],
): TreeNode<WorkspaceEntry> => ({ id, name: id, data: folderData, children });

const mkLeaf = (id: string): TreeLeaf<WorkspaceEntry> => ({
  id,
  name: id,
  data: leafData,
  isExpandable: false,
});

const mkWorkspace = (rootNode: TreeNode<WorkspaceEntry>): Workspace => ({
  id: "workspace-1",
  name: "workspace-1",
  isPublic: false,
  tagColor: "#dddddd",
  owner: user,
  creator: user,
  followers: [],
  rootNode,
});

const mkState = (overrides: Partial<WorkspacesState>): WorkspacesState => ({
  workspacesMetadata: [],
  isGettingWorkspace: false,
  currentWorkspace: null,
  currentWorkspaceLastRefreshedAt: new Date(),
  selectedEntries: [],
  focusedEntry: null,
  expandedNodes: [],
  entryBeingRenamed: null,
  loadedNodeIds: [],
  ...overrides,
});

// --- lazy loading (#744): WORKSPACE_MERGE_NODE ---

describe("workspacesReducer WORKSPACE_MERGE_NODE", () => {
  test("merges the fetched node into the tree and records it as loaded", () => {
    const state = mkState({
      currentWorkspace: mkWorkspace(mkFolder("root", [mkFolder("x", [])])),
      loadedNodeIds: ["root"],
    });

    const next = workspaces(state, {
      type: WorkspacesActionType.WORKSPACE_MERGE_NODE,
      node: mkFolder("x", [mkLeaf("x1")]),
    });

    const root = next.currentWorkspace?.rootNode as TreeNode<WorkspaceEntry>;
    const x = root.children[0] as TreeNode<WorkspaceEntry>;
    expect(x.children.map((c) => c.id)).toStrictEqual(["x1"]);
    expect(next.loadedNodeIds).toStrictEqual(["root", "x"]);
  });

  test("does not duplicate an id already recorded as loaded", () => {
    const state = mkState({
      currentWorkspace: mkWorkspace(mkFolder("root", [mkFolder("x", [])])),
      loadedNodeIds: ["root", "x"],
    });

    const next = workspaces(state, {
      type: WorkspacesActionType.WORKSPACE_MERGE_NODE,
      node: mkFolder("x", [mkLeaf("x1")]),
    });

    expect(next.loadedNodeIds).toStrictEqual(["root", "x"]);
  });

  test("is a no-op when the fetched node is no longer in the tree", () => {
    // The node was deleted or moved while the fetch was in flight, or the workspace switched:
    // the tree must not change and — crucially — the id must not be marked as loaded.
    const state = mkState({
      currentWorkspace: mkWorkspace(mkFolder("root", [])),
      loadedNodeIds: ["root"],
    });

    const next = workspaces(state, {
      type: WorkspacesActionType.WORKSPACE_MERGE_NODE,
      node: mkFolder("gone", [mkLeaf("g1")]),
    });

    expect(next).toBe(state);
  });

  test("is a no-op when no workspace is loaded", () => {
    const state = mkState({});

    const next = workspaces(state, {
      type: WorkspacesActionType.WORKSPACE_MERGE_NODE,
      node: mkFolder("x", []),
    });

    expect(next).toBe(state);
  });

  test("is a no-op when the payload is not a folder node", () => {
    const state = mkState({
      currentWorkspace: mkWorkspace(mkFolder("root", [mkLeaf("l")])),
      loadedNodeIds: ["root"],
    });

    const next = workspaces(state, {
      type: WorkspacesActionType.WORKSPACE_MERGE_NODE,
      node: mkLeaf("l"),
    });

    expect(next).toBe(state);
  });
});

// --- lazy loading (#744): loadedNodeIds on a full receive ---

describe("workspacesReducer WORKSPACE_GET_RECEIVE", () => {
  test("marks every folder of an eagerly-received tree as loaded", () => {
    const workspace = mkWorkspace(
      mkFolder("root", [mkFolder("a", [mkFolder("b", []), mkLeaf("l")])]),
    );

    const next = workspaces(mkState({}), {
      type: WorkspacesActionType.WORKSPACE_GET_RECEIVE,
      workspace,
    });

    expect([...next.loadedNodeIds].sort()).toStrictEqual(["a", "b", "root"]);
  });

  test("clears loadedNodeIds when the workspace is cleared", () => {
    const state = mkState({ loadedNodeIds: ["root", "a"] });

    const next = workspaces(state, {
      type: WorkspacesActionType.WORKSPACE_GET_RECEIVE,
      workspace: null,
    });

    expect(next.loadedNodeIds).toStrictEqual([]);
  });
});
