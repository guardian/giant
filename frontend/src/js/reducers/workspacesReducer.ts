import { TreeNode, isTreeNode } from "../types/Tree";
import {
  WorkspacesAction,
  WorkspacesActionType,
} from "../types/redux/GiantActions";
import { WorkspacesState } from "../types/redux/GiantState";
import { WorkspaceEntry } from "../types/Workspaces";
import { collectNodeIds, mergeFetchedNode } from "../util/treeUtils";

export default function workspaces(
  state: WorkspacesState = {
    workspacesMetadata: [],
    isGettingWorkspace: false,
    currentWorkspace: null,
    currentWorkspaceLastRefreshedAt: new Date(),
    selectedEntries: [],
    focusedEntry: null,
    expandedNodes: [],
    entryBeingRenamed: null,
    loadedNodeIds: [],
  },
  action: WorkspacesAction,
): WorkspacesState {
  switch (action.type) {
    case WorkspacesActionType.WORKSPACES_METADATA_GET_RECEIVE:
      return { ...state, workspacesMetadata: action.workspacesMetadata };

    case WorkspacesActionType.WORKSPACE_GET_START:
      return { ...state, isGettingWorkspace: true };

    case WorkspacesActionType.WORKSPACE_GET_RECEIVE: {
      return {
        ...state,
        currentWorkspace: action.workspace,
        isGettingWorkspace: false,
        currentWorkspaceLastRefreshedAt: new Date(),
        // The eager load returns the whole tree, so every folder is loaded. Lazy loading
        // (Stage 4) will instead record only the levels it has actually fetched.
        loadedNodeIds: action.workspace
          ? collectNodeIds(action.workspace.rootNode)
          : [],
      };
    }

    case WorkspacesActionType.SET_SELECTED_ENTRIES:
      return { ...state, selectedEntries: action.entries };

    case WorkspacesActionType.SET_FOCUSED_ENTRY:
      return { ...state, focusedEntry: action.entry };

    case WorkspacesActionType.SET_ENTRY_BEING_RENAMED:
      return { ...state, entryBeingRenamed: action.entry };

    case WorkspacesActionType.SET_NODE_AS_EXPANDED:
      return { ...state, expandedNodes: [...state.expandedNodes, action.node] };

    case WorkspacesActionType.SET_NODES_AS_EXPANDED:
      return {
        ...state,
        expandedNodes: [...state.expandedNodes, ...action.entries],
      };

    case WorkspacesActionType.SET_NODE_AS_COLLAPSED:
      // remove node from array
      return {
        ...state,
        expandedNodes: state.expandedNodes.reduce(
          (acc: TreeNode<WorkspaceEntry>[], node: TreeNode<WorkspaceEntry>) =>
            node.id === action.node.id ? [...acc] : [...acc, node],
          [],
        ),
      };

    // Lazy loading (#744): a node's children have been fetched (on first expand, or to refresh a
    // parent after a mutation). Merge them in — preserving any already-loaded descendant subtrees —
    // and record the node as loaded so re-expanding it doesn't refetch. Expansion state is handled
    // by the expand actions above, not here. No consumer dispatches this yet (Stage 4 wires it up).
    case WorkspacesActionType.WORKSPACE_MERGE_NODE: {
      if (!state.currentWorkspace || !isTreeNode(action.node)) {
        return state;
      }
      const rootNode = mergeFetchedNode(
        state.currentWorkspace.rootNode,
        action.node,
        state.loadedNodeIds,
      ) as TreeNode<WorkspaceEntry>;
      // An unchanged root means the fetched node is no longer in the tree — deleted or moved
      // while the fetch was in flight, or the workspace switched. Don't mark it loaded: ids in
      // loadedNodeIds must only ever describe nodes whose children are really in the tree.
      if (rootNode === state.currentWorkspace.rootNode) {
        return state;
      }
      return {
        ...state,
        currentWorkspace: { ...state.currentWorkspace, rootNode },
        loadedNodeIds: state.loadedNodeIds.includes(action.node.id)
          ? state.loadedNodeIds
          : [...state.loadedNodeIds, action.node.id],
      };
    }

    default:
      return state;
  }
}
