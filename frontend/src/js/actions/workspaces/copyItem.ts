import { copyItem as copyItemApi } from "../../services/WorkspaceApi";
import { ThunkAction } from "redux-thunk";
import { GiantState } from "../../types/redux/GiantState";
import {
  AppAction,
  AppActionType,
  WorkspacesAction,
} from "../../types/redux/GiantActions";
import { refreshAfterMutation } from "./lazyLoadingPoc";

export function copyItems(
  workspaceId: string,
  itemIds: string[],
  newWorkspaceId?: string,
  newParentId?: string, // Note: not currently used but could be useful for future 'copy to folder' functionality
): ThunkAction<void, GiantState, null, WorkspacesAction | AppAction> {
  return (dispatch) => {
    for (const itemId of itemIds) {
      if (itemId !== newParentId) {
        dispatch(copyItem(workspaceId, itemId, newWorkspaceId, newParentId));
      }
    }
  };
}

export function copyItem(
  workspaceId: string,
  itemId: string,
  newWorkspaceId?: string,
  newParentId?: string, // Note: not currently used but could be useful for future 'copy to folder' functionality
): ThunkAction<void, GiantState, null, WorkspacesAction | AppAction> {
  return (dispatch) => {
    return copyItemApi(workspaceId, itemId, newWorkspaceId, newParentId)
      .then(() => {
        // POC: refresh the copy destination (falls back to a depth-1 reload if unknown)
        refreshAfterMutation(dispatch, workspaceId, [newParentId]);
      })
      .catch((error) => dispatch(() => errorCopyingItem(error)));
  };
}

function errorCopyingItem(error: Error): AppAction {
  return {
    type: AppActionType.APP_SHOW_ERROR,
    message: "Failed to copy item",
    error: error,
  };
}
