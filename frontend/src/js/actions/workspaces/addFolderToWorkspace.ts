import { addFolderToWorkspace as addFolderToWorkspaceApi } from "../../services/WorkspaceApi";
import { refreshAfterMutation } from "./lazyLoadingPoc";
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
        // POC: the new folder's parent is exactly `parentId` — refresh just that.
        refreshAfterMutation(dispatch, workspaceId, [parentId]);
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
