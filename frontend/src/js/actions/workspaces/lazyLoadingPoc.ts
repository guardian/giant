// POC (issue #369 lazy-loading spike) — throwaway, not for production merge.
// Loads only the workspace root + its direct children, then fetches each folder's
// children on demand when it is expanded. No counts, mutations, polling, or deep
// linking — see the spike notes. Mirrors the viewer's LazyTreeBrowser pattern.
import {
  getWorkspacePocRoot as getWorkspacePocRootApi,
  getWorkspacePocChildren as getWorkspacePocChildrenApi,
} from "../../services/WorkspaceApi";
import { ThunkAction } from "redux-thunk";
import {
  AppAction,
  AppActionType,
  WorkspacesAction,
  WorkspacesActionType,
} from "../../types/redux/GiantActions";
import { GiantState } from "../../types/redux/GiantState";

// Open a workspace by loading only the root node + its top-level children.
// Signature-compatible with the real `getWorkspace` so it can be dropped in via
// mapDispatchToProps without touching call sites.
export function getWorkspacePoc(
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
    dispatch({ type: WorkspacesActionType.WORKSPACE_GET_START });
    return getWorkspacePocRootApi(id)
      .then((workspace) =>
        dispatch({
          type: WorkspacesActionType.WORKSPACE_GET_RECEIVE,
          workspace,
        }),
      )
      .catch((error) =>
        dispatch({
          type: AppActionType.APP_SHOW_ERROR,
          message: "Failed to get workspace " + id,
          error,
        }),
      );
  };
}

// Fetch a folder's direct children on expand and merge them into the loaded tree.
export function expandWorkspaceNode(
  workspaceId: string,
  nodeId: string,
): ThunkAction<void, GiantState, null, WorkspacesAction | AppAction> {
  return (dispatch) => {
    return getWorkspacePocChildrenApi(workspaceId, nodeId)
      .then((node) =>
        dispatch({
          type: WorkspacesActionType.WORKSPACE_POC_MERGE_NODE,
          node,
        }),
      )
      .catch((error) =>
        dispatch({
          type: AppActionType.APP_SHOW_ERROR,
          message: "Failed to load folder contents " + nodeId,
          error,
        }),
      );
  };
}
