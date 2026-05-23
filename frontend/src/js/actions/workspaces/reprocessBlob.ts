import { reprocessBlob as reprocessBlobApi } from "../../services/BlobApi";
import { ThunkAction } from "redux-thunk";
import { GiantState } from "../../types/redux/GiantState";
import {
  AppAction,
  AppActionType,
  WorkspacesAction,
} from "../../types/redux/GiantActions";
import { refreshAfterMutation } from "./lazyLoadingPoc";

export function reprocessBlob(
  workspaceID: string,
  itemId: string,
  // POC: parent folder(s) to refresh after reprocessing instead of reloading the whole tree.
  affectedParentIds?: (string | undefined)[],
): ThunkAction<void, GiantState, null, WorkspacesAction | AppAction> {
  return (dispatch) => {
    return reprocessBlobApi(itemId)
      .then(() =>
        refreshAfterMutation(dispatch, workspaceID, affectedParentIds),
      )
      .catch((error) => dispatch(errorReprocessingBlob(error)));
  };
}

function errorReprocessingBlob(error: Error): AppAction {
  return {
    type: AppActionType.APP_SHOW_ERROR,
    message: "Failed to start reprocessing",
    error: error,
  };
}
