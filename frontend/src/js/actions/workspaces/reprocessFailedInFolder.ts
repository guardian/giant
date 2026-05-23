import { reprocessFolder as reprocessFolderApi } from "../../services/WorkspaceApi";
import { ThunkAction } from "redux-thunk";
import { GiantState } from "../../types/redux/GiantState";
import {
  AppAction,
  AppActionType,
  WorkspacesAction,
} from "../../types/redux/GiantActions";
import { refreshAfterMutation } from "./lazyLoadingPoc";

export function reprocessFolder(
  workspaceId: string,
  folderId: string,
  mode: "all" | "errored",
): ThunkAction<void, GiantState, null, WorkspacesAction | AppAction> {
  return (dispatch) => {
    return (
      reprocessFolderApi(workspaceId, folderId, mode)
        // POC: refresh just the reprocessed folder (its children's status changes)
        .then(() => refreshAfterMutation(dispatch, workspaceId, [folderId]))
        .catch((error) =>
          dispatch({
            type: AppActionType.APP_SHOW_ERROR,
            message: "Failed to reprocess folder contents",
            error,
          }),
        )
    );
  };
}
