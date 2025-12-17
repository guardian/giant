import { moveItem as moveItemApi } from '../../services/WorkspaceApi';
import { getWorkspace } from './getWorkspace';
import { ThunkAction } from 'redux-thunk';
import { AppAction, AppActionType, WorkspacesAction } from '../../types/redux/GiantActions';
import { GiantState } from '../../types/redux/GiantState';
import throttle from 'lodash/throttle';

export function moveItems(
    workspaceId: string,
    itemIds: string[],
    newWorkspaceId?: string,
    newParentId?: string,
    onEachSettled?: () => void,
): ThunkAction<void, GiantState, null, WorkspacesAction | AppAction> {
    return async dispatch => {
        const throttledCallback =
          throttle(
            () => {dispatch(getWorkspace(workspaceId))},
            1000 // don't refresh the workspace more than once per second
          );
        const batchSize = Math.ceil(itemIds.length / 5);

        await Promise.allSettled(
          // Create 5 batches to move items in parallel
          [0, 1, 2, 3, 4].map(async batchIndex => {
                const batchItemIds = itemIds.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);
                for (const itemId of batchItemIds) {
                    if (itemId !== newParentId) {
                        await moveItemApi(workspaceId, itemId, newWorkspaceId, newParentId)
                        .then(throttledCallback)
                        .catch(error => dispatch(() => errorMovingItem(error)))
                        .finally(onEachSettled);
                    }
                }
            }
          )
        );
    };
}

function errorMovingItem(error: Error): AppAction {
    return {
        type:        AppActionType.APP_SHOW_ERROR,
        message:     'Failed to move item',
        error:       error,
    };
}
