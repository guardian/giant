import { getWorkspaceNodeChildren as getWorkspaceNodeChildrenApi } from "../../services/WorkspaceApi";
import { ThunkAction } from "redux-thunk";
import {
  AppAction,
  AppActionType,
  WorkspacesAction,
  WorkspacesActionType,
} from "../../types/redux/GiantActions";
import { GiantState } from "../../types/redux/GiantState";

// Lazy loading (#744): fetch a node's direct children and merge them into the loaded tree. The
// reducer's mergeFetchedNode preserves already-loaded descendant subtrees, so this is used both to
// expand a folder for the first time and to refresh a parent after a mutation. Plumbing only — no
// component dispatches it yet; Stage 4 uses it to refresh mutated parents, Stage 5 wires it to
// the expand handler.
export function loadWorkspaceNodeChildren(
  workspaceId: string,
  nodeId: string,
  nodeName: string,
): ThunkAction<void, GiantState, null, WorkspacesAction | AppAction> {
  return (dispatch) => {
    return getWorkspaceNodeChildrenApi(workspaceId, nodeId)
      .then((node) =>
        dispatch({
          type: WorkspacesActionType.WORKSPACE_MERGE_NODE,
          node,
        }),
      )
      .catch((error) =>
        dispatch({
          type: AppActionType.APP_SHOW_ERROR,
          message: `Failed to load the contents of folder "${nodeName}"`,
          error,
        }),
      );
  };
}
