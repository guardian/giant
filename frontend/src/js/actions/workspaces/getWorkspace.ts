import { getWorkspace as getWorkspaceApi } from "../../services/WorkspaceApi";
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
      return getWorkspaceApi(id)
        .then((workspace) => {
          if (idInProgress === id) {
            // only dispatch if still relevant
            dispatch({
              type: WorkspacesActionType.WORKSPACE_GET_RECEIVE,
              workspace,
            });
          }
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
