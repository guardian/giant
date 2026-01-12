import { addFolderToWorkspace as addFolderToWorkspaceApi } from "../../services/WorkspaceApi";
import { getWorkspace } from "./getWorkspace";
import { ThunkAction } from "redux-thunk";
import {
  AppAction,
  AppActionType,
  WorkspacesAction,
} from "../../types/redux/GiantActions";
import { GiantState } from "../../types/redux/GiantState";

export function addFolderToWorkspace(
  workspaceId: string,
  parentId: string,
  name: string,
): ThunkAction<void, GiantState, null, WorkspacesAction | AppAction> {
  return (dispatch) => {
    return addFolderToWorkspaceApi(workspaceId, parentId, name)
      .then(() => {
        dispatch(getWorkspace(workspaceId));
      })
      .catch((error) => dispatch(errorAddingFolder(error)));
  };
}

function errorAddingFolder(error: Error): AppAction {
  return {
    type: AppActionType.APP_SHOW_ERROR,
    message: "Failed to create folder",
    error: error,
  };
}
