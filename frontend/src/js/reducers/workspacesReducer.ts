import { TreeNode } from '../types/Tree';
import { WorkspacesAction, WorkspacesActionType } from '../types/redux/GiantActions';
import { WorkspacesState } from '../types/redux/GiantState';
import { WorkspaceEntry } from '../types/Workspaces';

export default function workspaces(
    state: WorkspacesState = {
        workspacesMetadata: [],
        currentWorkspace: null,
        selectedEntries: [],
        focusedEntry: null,
        expandedNodes: [],
        entryBeingRenamed: null,
    },
    action: WorkspacesAction
): WorkspacesState {
    switch (action.type) {
        case WorkspacesActionType.WORKSPACES_METADATA_GET_RECEIVE:
            return { ...state, workspacesMetadata: action.workspacesMetadata };

        case WorkspacesActionType.WORKSPACE_GET_RECEIVE: {
            return { ...state, currentWorkspace: action.workspace };
        }

        case WorkspacesActionType.SET_SELECTED_ENTRIES:
            return { ...state, selectedEntries: action.entries };

        case WorkspacesActionType.SET_FOCUSED_ENTRY:
            return { ...state, focusedEntry: action.entry };

        case WorkspacesActionType.SET_ENTRY_BEING_RENAMED:
            return { ...state, entryBeingRenamed: action.entry };

        case WorkspacesActionType.SET_NODE_AS_EXPANDED:
            return { ...state, expandedNodes: [...state.expandedNodes, action.node] };

        case WorkspacesActionType.SET_NODE_AS_COLLAPSED:
            // remove node from array
            return ({
                ...state,
                expandedNodes: state.expandedNodes.reduce((acc: TreeNode<WorkspaceEntry>[], node: TreeNode<WorkspaceEntry>) =>
                    node.id === action.node.id ? [...acc] : [...acc, node], []
                )
            });

        default:
            return state;
    }
}

