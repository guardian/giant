import { TreeEntry, TreeNode, isTreeNode } from "../types/Tree";
import {
  WorkspacesAction,
  WorkspacesActionType,
} from "../types/redux/GiantActions";
import { WorkspacesState } from "../types/redux/GiantState";
import { WorkspaceEntry } from "../types/Workspaces";

// POC (issue #369 lazy-loading spike): merge a freshly-fetched node (`fresh`, with its
// direct children) into the tree at the node with the same id. Used both for first
// expansion and for refreshing a parent after a mutation.
//
// Crucially it *preserves already-loaded descendant subtrees*: when refreshing a parent,
// any child folder that was already loaded keeps its expanded subtree (we only adopt the
// fresh name/data), so a rename/delete/move of one item doesn't collapse its expanded
// siblings. New children appear as placeholders; removed children drop out.
function mergeFetchedNode(
  entry: TreeEntry<WorkspaceEntry>,
  fresh: TreeNode<WorkspaceEntry>,
  loadedNodeIds: string[],
): TreeEntry<WorkspaceEntry> {
  if (entry.id === fresh.id) {
    if (!isTreeNode(entry)) {
      return fresh;
    }
    const oldChildrenById = new Map(entry.children.map((c) => [c.id, c]));
    const children = fresh.children.map((freshChild) => {
      const oldChild = oldChildrenById.get(freshChild.id);
      if (
        oldChild &&
        isTreeNode(oldChild) &&
        isTreeNode(freshChild) &&
        loadedNodeIds.includes(freshChild.id)
      ) {
        // keep the previously-loaded subtree, but take fresh name/data (handles rename)
        return { ...oldChild, name: freshChild.name, data: freshChild.data };
      }
      return freshChild;
    });
    return { ...fresh, children };
  }
  if (isTreeNode(entry)) {
    return {
      ...entry,
      children: entry.children.map((c) =>
        mergeFetchedNode(c, fresh, loadedNodeIds),
      ),
    };
  }
  return entry;
}

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
        // POC: the initial fetch loads the root + its direct children, so the root
        // counts as loaded; everything below it is fetched lazily on expand.
        loadedNodeIds: action.workspace ? [action.workspace.rootNode.id] : [],
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

    // POC (issue #369 lazy-loading spike): a node's children have been fetched (on
    // expand, or to refresh a parent after a mutation). Merge them in, preserving any
    // already-loaded descendant subtrees, and record the node as loaded so re-expanding
    // doesn't refetch. Expansion state is handled by onExpandNode, not here.
    case WorkspacesActionType.WORKSPACE_POC_MERGE_NODE: {
      if (!state.currentWorkspace || !isTreeNode(action.node)) {
        return state;
      }
      const rootNode = mergeFetchedNode(
        state.currentWorkspace.rootNode,
        action.node,
        state.loadedNodeIds,
      ) as TreeNode<WorkspaceEntry>;
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
