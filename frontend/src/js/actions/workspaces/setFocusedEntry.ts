import { TreeEntry } from "../../types/Tree";
import {
  WorkspacesAction,
  WorkspacesActionType,
} from "../../types/redux/GiantActions";
import { WorkspaceEntry } from "../../types/Workspaces";

export function setFocusedEntry(
  entry: TreeEntry<WorkspaceEntry> | null,
): WorkspacesAction {
  return {
    type: WorkspacesActionType.SET_FOCUSED_ENTRY,
    entry,
  };
}
