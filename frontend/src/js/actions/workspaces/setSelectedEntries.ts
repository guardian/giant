import { TreeEntry } from "../../types/Tree";
import {
  WorkspacesAction,
  WorkspacesActionType,
} from "../../types/redux/GiantActions";
import { WorkspaceEntry } from "../../types/Workspaces";

export function setSelectedEntries(
  entries: TreeEntry<WorkspaceEntry>[],
): WorkspacesAction {
  return {
    type: WorkspacesActionType.SET_SELECTED_ENTRIES,
    entries,
  };
}
