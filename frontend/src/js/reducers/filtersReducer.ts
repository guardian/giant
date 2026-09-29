import { FiltersState } from "../types/redux/GiantState";
import { GiantAction } from "../types/redux/GiantActions";

export default function filters(
  state: FiltersState = [],
  action: GiantAction,
): FiltersState {
  switch (action.type) {
    case "FILTERS_GET_RECEIVE":
      return action.filters || false;

    default:
      return state;
  }
}
