import { ThunkAction } from "redux-thunk";
import {
  getSortedHighlightIds,
  getNextOrPreviousHighlight,
} from "../../reducers/pagesReducer";
import { GiantAction, PagesActionType } from "../../types/redux/GiantActions";
import { GiantState, PagesState } from "../../types/redux/GiantState";

export function navigateToHighlight(
  state: PagesState,
  action: "next" | "previous",
): ThunkAction<void, GiantState, void, GiantAction> {
  return (dispatch) => {
    if (state.doc && state.currentHighlightId) {
      const newHighlightId = getNextOrPreviousHighlight(
        getSortedHighlightIds(state.doc),
        action,
        state.currentHighlightId,
      );
      dispatch({
        type: PagesActionType.SET_CURRENT_HIGHLIGHT_ID,
        newHighlightId,
      });
    }
  };
}
