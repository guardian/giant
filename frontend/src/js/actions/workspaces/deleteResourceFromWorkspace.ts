import { deleteResourceFromWorkspace as deleteResourceFromWorkspaceApi } from "../../services/WorkspaceApi";
import { refreshAfterMutation } from "./lazyLoadingPoc";
import { ThunkAction } from "redux-thunk";
import {
  AppAction,
  AppActionType,
  WorkspacesAction,
} from "../../types/redux/GiantActions";
import { GiantState } from "../../types/redux/GiantState";

export function deleteResourceFromWorkspace(
  workspaceId: string,
  blobUri: string,
  onCompleteHandler: (isSuccess: boolean) => void,
  // POC: parent folder(s) to refresh after the mutation instead of reloading the whole tree.
  affectedParentIds?: (string | undefined)[],
): ThunkAction<void, GiantState, null, WorkspacesAction | AppAction> {
  return (dispatch) => {
    return deleteResourceFromWorkspaceApi(workspaceId, blobUri)
      .then(() => {
        refreshAfterMutation(dispatch, workspaceId, affectedParentIds);
        onCompleteHandler(true);
      })
      .catch((error) => {
        onCompleteHandler(false);
        dispatch(errorRenamingItem(error));
      });
  };
}

function errorRenamingItem(error: Error): AppAction {
  return {
    type: AppActionType.APP_SHOW_ERROR,
    message: `Failed to delete or remove`,
    error: error,
  };
}
