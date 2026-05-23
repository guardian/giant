import { renameItem as renameItemApi } from "../../services/WorkspaceApi";
import { refreshAfterMutation } from "./lazyLoadingPoc";
import { ThunkAction } from "redux-thunk";
import { GiantState } from "../../types/redux/GiantState";
import {
  AppAction,
  AppActionType,
  WorkspacesAction,
} from "../../types/redux/GiantActions";

export function renameItem(
  workspaceId: string,
  itemId: string,
  name: string,
  // POC: parent folder(s) to refresh after the mutation instead of reloading the whole tree.
  affectedParentIds?: (string | undefined)[],
): ThunkAction<void, GiantState, null, WorkspacesAction | AppAction> {
  return (dispatch) => {
    return renameItemApi(workspaceId, itemId, name)
      .then(() => {
        refreshAfterMutation(dispatch, workspaceId, affectedParentIds);
      })
      .catch((error) => dispatch(errorRenamingItem(error)));
  };
}

function errorRenamingItem(error: Error): AppAction {
  return {
    type: AppActionType.APP_SHOW_ERROR,
    message: "Failed to rename item",
    error: error,
  };
}
