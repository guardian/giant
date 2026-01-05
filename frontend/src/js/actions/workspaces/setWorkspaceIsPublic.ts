import { updateWorkspaceIsPublic } from "../../services/WorkspaceApi";
import { getWorkspacesMetadata } from "./getWorkspacesMetadata";
import { ThunkAction } from "redux-thunk";
import {
  AppAction,
  AppActionType,
  WorkspacesAction,
} from "../../types/redux/GiantActions";
import { GiantState } from "../../types/redux/GiantState";
import { getWorkspace } from "./getWorkspace";

export function setWorkspaceIsPublic(
  id: string,
  isPublic: boolean,
): ThunkAction<void, GiantState, null, WorkspacesAction | AppAction> {
  return (dispatch) => {
    return updateWorkspaceIsPublic(id, isPublic)
      .then((res) => {
        dispatch(getWorkspacesMetadata());
        // We need to fire off this second call because "is public" metadata as
        // displayed in the "current workspace" view is accessed from the currentWorkspace state,
        // so we need to refresh it. It's also in the workspacesMetadata state, but we don't want to
        // search through that array to find the current workspace: currentWorkspace should always
        // be the canonical source of info for that.
        dispatch(getWorkspace(id));
      })
      .catch((error) => dispatch(errorUpdatingWorkspaceMetadata(error)));
  };
}

function errorUpdatingWorkspaceMetadata(error: Error): AppAction {
  return {
    type: AppActionType.APP_SHOW_ERROR,
    message: "Failed to share workspace",
    error: error,
  };
}
