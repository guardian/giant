import {
  AddItemParameters,
  addResourceToWorkspace as addResourceToWorkspaceApi,
} from "../../services/WorkspaceApi";
import { getWorkspace } from "./getWorkspace";
import { ThunkAction } from "redux-thunk";
import {
  AppAction,
  AppActionType,
  WorkspacesAction,
} from "../../types/redux/GiantActions";
import { GiantState } from "../../types/redux/GiantState";

export function addResourceToWorkspace(
  workspaceId: string,
  parentId: string,
  name: string,
  icon: string | undefined,
  parameters: AddItemParameters,
): ThunkAction<void, GiantState, null, WorkspacesAction | AppAction> {
  return (dispatch) => {
    return addResourceToWorkspaceApi(
      workspaceId,
      parentId,
      name,
      icon,
      parameters,
    )
      .then(() => {
        dispatch(getWorkspace(workspaceId));
      })
      .catch((error) => dispatch(errorAddingResource(error)));
  };
}

function errorAddingResource(error: Error): AppAction {
  return {
    type: AppActionType.APP_SHOW_ERROR,
    message: "Failed to add resource to workspace",
    error: error,
  };
}
