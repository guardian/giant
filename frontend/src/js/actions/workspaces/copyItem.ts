import { copyItem as copyItemApi } from '../../services/WorkspaceApi';
import {ThunkAction} from "redux-thunk";
import {GiantState} from "../../types/redux/GiantState";
import {AppAction, AppActionType, WorkspacesAction} from "../../types/redux/GiantActions";
import {getWorkspace} from "./getWorkspace";

export function copyItems(
    workspaceId: string,
    itemIds: string[],
    newWorkspaceId?: string,
    newParentId?: string
): ThunkAction<void, GiantState, null, WorkspacesAction | AppAction> {
    return dispatch => {
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
    newParentId?: string
): ThunkAction<void, GiantState, null, WorkspacesAction | AppAction> {
    return dispatch => {
        return copyItemApi(workspaceId, itemId, newWorkspaceId, newParentId)
            .then(() => {
                dispatch(getWorkspace(workspaceId));
            })
            .catch(error => dispatch(() => errorCopyingItem(error)));
    };
}

function errorCopyingItem(error: Error): AppAction {
    return {
        type:        AppActionType.APP_SHOW_ERROR,
        message:     'Failed to copy item',
        error:       error,
    };
}
