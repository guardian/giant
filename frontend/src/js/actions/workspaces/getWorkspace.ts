import {
  getWorkspaceStructure as getWorkspaceStructureApi,
  getWorkspaceStatus as getWorkspaceStatusApi,
} from "../../services/WorkspaceApi";
import { ThunkAction } from "redux-thunk";
import {
  AppAction,
  AppActionType,
  WorkspacesAction,
  WorkspacesActionType,
} from "../../types/redux/GiantActions";
import { GiantState } from "../../types/redux/GiantState";

let idInProgress: string | null = null;
let idRequestedAgainWhilstInProgress: string | null = null;

// Opens a workspace by firing /structure and /status concurrently. The tree
// skeleton renders as soon as /structure resolves (leaves indeterminate); the
// /status merge then fills in per-file processing state and folder roll-ups.
// The status merge is dispatched after the structure receive so it always
// applies to a loaded tree, even if /status wins the race.
export function getWorkspace(
  id: string,
  options: { shouldClearFirst?: boolean } = {},
): ThunkAction<void, GiantState, null, WorkspacesAction | AppAction> {
  return (dispatch) => {
    if (options?.shouldClearFirst) {
      dispatch({
        type: WorkspacesActionType.WORKSPACE_GET_RECEIVE,
        workspace: null,
      });
    }
    if (idInProgress === id) {
      idRequestedAgainWhilstInProgress = id;
      return Promise.resolve();
    }
    idInProgress = id;
    idRequestedAgainWhilstInProgress = null;
    const operation: () => Promise<unknown> = () => {
      dispatch({
        type: WorkspacesActionType.WORKSPACE_GET_START,
      });
      const structurePromise = getWorkspaceStructureApi(id);
      const statusPromise = getWorkspaceStatusApi(id);
      return structurePromise
        .then((workspace) => {
          if (idInProgress === id) {
            // only dispatch if still relevant
            dispatch({
              type: WorkspacesActionType.WORKSPACE_GET_RECEIVE,
              workspace,
            });
          }
          return statusPromise.then((statuses) => {
            if (idInProgress === id) {
              dispatch({
                type: WorkspacesActionType.WORKSPACE_STATUS_RECEIVE,
                workspaceId: id,
                statuses,
              });
            }
          });
        })
        .catch((error) =>
          dispatch({
            type: AppActionType.APP_SHOW_ERROR,
            message: "Failed to get workspace " + id,
            error: error,
          }),
        )
        .finally(() => {
          if (
            idRequestedAgainWhilstInProgress &&
            idInProgress === idRequestedAgainWhilstInProgress
          ) {
            idRequestedAgainWhilstInProgress = null;
            return operation();
          }
          idInProgress = null;
        });
    };

    return operation();
  };
}

// Refreshes only the volatile per-file processing state via /status, merging it
// into the already-loaded structure tree. Used by the workspace poller, where
// the tree shape is unchanged and only processing progress moves.
export function refreshWorkspaceStatus(
  id: string,
): ThunkAction<void, GiantState, null, WorkspacesAction | AppAction> {
  return (dispatch) => {
    return getWorkspaceStatusApi(id)
      .then((statuses) =>
        dispatch({
          type: WorkspacesActionType.WORKSPACE_STATUS_RECEIVE,
          workspaceId: id,
          statuses,
        }),
      )
      .catch((error) =>
        dispatch({
          type: AppActionType.APP_SHOW_ERROR,
          message: "Failed to refresh workspace status " + id,
          error: error,
        }),
      );
  };
}
