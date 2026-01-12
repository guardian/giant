import { TreeNode } from "../../types/Tree";
import {
  WorkspacesAction,
  WorkspacesActionType,
} from "../../types/redux/GiantActions";
import { WorkspaceEntry } from "../../types/Workspaces";

export function setNodeAsExpanded(
  node: TreeNode<WorkspaceEntry>,
): WorkspacesAction {
  return {
    type: WorkspacesActionType.SET_NODE_AS_EXPANDED,
    node,
  };
}
