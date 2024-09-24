import { deleteItem as deleteItemApi } from '../../services/WorkspaceApi';
import { getWorkspace } from './getWorkspace';
import { ThunkAction } from 'redux-thunk';
import { AppAction, AppActionType, WorkspacesAction } from '../../types/redux/GiantActions';
import { GiantState } from '../../types/redux/GiantState';

export function deleteItem(
    workspaceId: string,
    itemId: string,
    onCompleteHandler: (isSuccess: boolean) => void
): ThunkAction<void, GiantState, null, WorkspacesAction | AppAction> {
    return dispatch => {
        return deleteItemApi(workspaceId, itemId)
            .then(() => {
                dispatch(getWorkspace(workspaceId));
                onCompleteHandler(true);
            })
            .catch(error => {
                onCompleteHandler(false);
                dispatch(errorRenamingItem(error))
            });
    };
}

function errorRenamingItem(error: Error): AppAction {
    return {
        type:        AppActionType.APP_SHOW_ERROR,
        message:     'Failed to delete item',
        error:       error,
    };
}
