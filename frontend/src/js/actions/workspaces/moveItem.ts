import { moveItem as moveItemApi } from '../../services/WorkspaceApi';
import { getWorkspace } from './getWorkspace';
import { ThunkAction } from 'redux-thunk';
import { AppAction, AppActionType, WorkspacesAction } from '../../types/redux/GiantActions';
import { GiantState } from '../../types/redux/GiantState';

export function moveItems(
    workspaceId: string,
    itemIds: string[],
    newWorkspaceId?: string,
    newParentId?: string
): ThunkAction<void, GiantState, null, WorkspacesAction | AppAction> {
    return dispatch => {
        for (const itemId of itemIds) {
            if (itemId !== newParentId) {
                dispatch(moveItem(workspaceId, itemId, newWorkspaceId, newParentId));
            }
        }
    };
}

export function moveItem(
    workspaceId: string,
    itemId: string,
    newWorkspaceId?: string,
    newParentId?: string
): ThunkAction<void, GiantState, null, WorkspacesAction | AppAction> {
    return dispatch => {
        return moveItemApi(workspaceId, itemId, newWorkspaceId, newParentId)
            .then(() => {
                dispatch(getWorkspace(workspaceId));
            })
            .catch(error => dispatch(() => errorMovingItem(error)));
    };
}

function errorMovingItem(error: Error): AppAction {
    return {
        type:        AppActionType.APP_SHOW_ERROR,
        message:     'Failed to move item',
        error:       error,
    };
}
