import { deleteOrRemoveItem as deleteOrRemoveItemApi } from '../../services/WorkspaceApi';
import { getWorkspace } from './getWorkspace';
import { ThunkAction } from 'redux-thunk';
import { AppAction, AppActionType, WorkspacesAction } from '../../types/redux/GiantActions';
import { GiantState } from '../../types/redux/GiantState';

export function deleteOrRemoveItem(
    workspaceId: string,
    blobUri: string,
    onCompleteHandler: (isSuccess: boolean) => void
): ThunkAction<void, GiantState, null, WorkspacesAction | AppAction> {
    return dispatch => {
        return deleteOrRemoveItemApi(workspaceId, blobUri)
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
        message:     `Failed to delete or remove`,
        error:       error,
    };
}
