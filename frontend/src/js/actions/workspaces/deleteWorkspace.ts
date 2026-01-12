import { deleteWorkspace as deleteWorkspaceApi } from "../../services/WorkspaceApi";
import history from "../../util/history";
import { getWorkspacesMetadata } from "./getWorkspacesMetadata";
import { ThunkAction } from "redux-thunk";
import {
  AppAction,
  AppActionType,
  WorkspacesAction,
} from "../../types/redux/GiantActions";
import { GiantState } from "../../types/redux/GiantState";

export function deleteWorkspace(
  workspaceId: string,
): ThunkAction<void, GiantState, null, WorkspacesAction | AppAction> {
  return (dispatch) => {
    return deleteWorkspaceApi(workspaceId)
      .then(() => {
        // what seems a bit messed up to me is that changes which make/break the UI, e.g.
        // dispatch(getWorkspaces) or dispatch(() => getWorkspaces())
        // instead of the below make no difference to TypeScript.
        // I think this is because of the recursive definition of ThunkAction, i.e.
        // dispatch can accept a function that returns a function that returns a function etc....
        dispatch(getWorkspacesMetadata());
        history.push("/workspaces");
      })
      .catch((error) => dispatch(errorDeletingWorkspace(error)));
  };
}

function errorDeletingWorkspace(error: Error): AppAction {
  return {
    type: AppActionType.APP_SHOW_ERROR,
    message: "Failed to delete workspace",
    error: error,
  };
}
