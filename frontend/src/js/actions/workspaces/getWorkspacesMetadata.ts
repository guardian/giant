import { getWorkspacesMetadata as getWorkspacesApi } from "../../services/WorkspaceApi";
import { ThunkAction } from "redux-thunk";
import {
  AppAction,
  AppActionType,
  WorkspacesAction,
  WorkspacesActionType,
} from "../../types/redux/GiantActions";
import { WorkspaceMetadata } from "../../types/Workspaces";
import { GiantState } from "../../types/redux/GiantState";

export function getWorkspacesMetadata(): ThunkAction<
  void,
  GiantState,
  null,
  WorkspacesAction | AppAction
> {
  return (dispatch) => {
    return getWorkspacesApi()
      .then((workspaces) => {
        dispatch(receiveGetWorkspacesMetadata(workspaces));
      })
      .catch((error) => dispatch(errorGettingWorkspaces(error)));
  };
}

function receiveGetWorkspacesMetadata(
  workspacesMetadata: WorkspaceMetadata[],
): WorkspacesAction {
  return {
    type: WorkspacesActionType.WORKSPACES_METADATA_GET_RECEIVE,
    workspacesMetadata,
  };
}

function errorGettingWorkspaces(error: Error): AppAction {
  return {
    type: AppActionType.APP_SHOW_ERROR,
    message: "Failed to get workspace",
    error: error,
  };
}
