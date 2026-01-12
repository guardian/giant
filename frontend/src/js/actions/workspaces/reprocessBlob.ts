import { reprocessBlob as reprocessBlobApi } from "../../services/BlobApi";
import { ThunkAction } from "redux-thunk";
import { GiantState } from "../../types/redux/GiantState";
import {
  AppAction,
  AppActionType,
  WorkspacesAction,
} from "../../types/redux/GiantActions";
import { getWorkspace } from "./getWorkspace";

export function reprocessBlob(
  workspaceID: string,
  itemId: string,
): ThunkAction<void, GiantState, null, WorkspacesAction | AppAction> {
  return (dispatch) => {
    return reprocessBlobApi(itemId)
      .then(() => dispatch(getWorkspace(workspaceID)))
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
