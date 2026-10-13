import { GiantDispatch } from "../../types/redux/GiantDispatch";

export function clearSearch() {
  return (dispatch: GiantDispatch) => {
    dispatch({
      type: "SEARCH_CLEAR",
      receivedAt: Date.now(),
    });
  };
}
