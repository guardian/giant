import { ThunkAction } from "redux-thunk";
import { GiantAction, PagesActionType } from "../../types/redux/GiantActions";
import { GiantState } from "../../types/redux/GiantState";

export function resetPages(): ThunkAction<void, GiantState, void, GiantAction> {
  return (dispatch) => {
    dispatch({ type: PagesActionType.RESET_PAGES });
  };
}
