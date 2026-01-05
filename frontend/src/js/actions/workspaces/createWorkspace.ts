import { createWorkspace as createWorkspaceApi } from "../../services/WorkspaceApi";
import history from "../../util/history";
import { getWorkspacesMetadata } from "./getWorkspacesMetadata";
import { ThunkAction } from "redux-thunk";
import {
  AppAction,
  AppActionType,
  WorkspacesAction,
} from "../../types/redux/GiantActions";
import { GiantState } from "../../types/redux/GiantState";

export function createWorkspace(
  name: string,
  isPublic: boolean,
  tagColor: string,
): ThunkAction<void, GiantState, null, WorkspacesAction | AppAction> {
  return (dispatch) => {
    return createWorkspaceApi(name, isPublic, tagColor)
      .then((res) => {
        dispatch(getWorkspacesMetadata());
        history.push(`/workspaces/${res}`);
      })
      .catch((error) => dispatch(errorCreatingWorkspace(error)));
  };
}

function errorCreatingWorkspace(error: Error): AppAction {
  return {
    type: AppActionType.APP_SHOW_ERROR,
    message: "Failed to create workspace",
    error: error,
  };
}
