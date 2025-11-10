import { TreeNode } from '../../types/Tree';
import { WorkspacesAction, WorkspacesActionType } from '../../types/redux/GiantActions';
import { WorkspaceEntry } from '../../types/Workspaces';

export function setNodesAsExpanded(entries: TreeNode<WorkspaceEntry>[]): WorkspacesAction {
    return {
        type: WorkspacesActionType.SET_NODES_AS_EXPANDED,
        entries
    };
}
