import { getWorkspace as getWorkspaceApi } from '../../services/WorkspaceApi';
import { ThunkAction } from 'redux-thunk';
import { AppAction, AppActionType, WorkspacesAction, WorkspacesActionType } from '../../types/redux/GiantActions';
import { GiantState } from '../../types/redux/GiantState';

export function getWorkspace(id: string): ThunkAction<void, GiantState, null, WorkspacesAction | AppAction> {
    return (dispatch) => {
        return getWorkspaceApi(id)
            .then(workspace => {
                dispatch({
                    type: WorkspacesActionType.WORKSPACE_GET_RECEIVE,
                    workspace
                });
            })
            .catch(error => dispatch({
                type:        AppActionType.APP_SHOW_ERROR,
                message:     'Failed to get workspace ' + id,
                error:       error,
            }));
    };
}
