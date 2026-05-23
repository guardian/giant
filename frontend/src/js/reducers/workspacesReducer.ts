import { TreeEntry, TreeNode, isTreeNode } from "../types/Tree";
import {
  WorkspacesAction,
  WorkspacesActionType,
} from "../types/redux/GiantActions";
import { WorkspacesState } from "../types/redux/GiantState";
import { WorkspaceEntry } from "../types/Workspaces";

// POC (issue #369 lazy-loading spike): replace the entry with id === replacement.id
// anywhere in the tree (an expandable leaf "becomes" a node once its children load).
function replaceEntryById(
  entry: TreeEntry<WorkspaceEntry>,
  replacement: TreeEntry<WorkspaceEntry>,
): TreeEntry<WorkspaceEntry> {
  if (entry.id === replacement.id) {
    return replacement;
  }
  if (isTreeNode(entry)) {
    return {
      ...entry,
      children: entry.children.map((c) => replaceEntryById(c, replacement)),
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

    // POC (issue #369 lazy-loading spike): a folder's children have been fetched.
    // Replace the placeholder folder node (empty children) with the loaded one, and
    // record its id as loaded so re-expanding doesn't refetch. Expansion is handled by
    // the onExpandNode handler, so we don't touch expandedNodes here.
    case WorkspacesActionType.WORKSPACE_POC_MERGE_NODE: {
      if (!state.currentWorkspace) {
        return state;
      }
      const rootNode = replaceEntryById(
        state.currentWorkspace.rootNode,
        action.node,
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
