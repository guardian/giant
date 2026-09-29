import { fetchFilters } from "../services/FiltersApi";

import { SearchFilter } from "../types/SearchFilter";
import {
  AppActionType,
  ErrorAction,
  FiltersAction,
} from "../types/redux/GiantActions";
import { GiantDispatch } from "../types/redux/GiantDispatch";

export function getFilters() {
  return (dispatch: GiantDispatch) => {
    dispatch(requestFilters());
    return fetchFilters()
      .then((res) => {
        dispatch(recieveFilters(res));
      })
      .catch((error) => dispatch(errorReceivingFilters(error)));
  };
}

function requestFilters(): FiltersAction {
  return {
    type: "FILTERS_GET_REQUEST",
    receivedAt: Date.now(),
  };
}

function recieveFilters(filters: SearchFilter[]): FiltersAction {
  return {
    type: "FILTERS_GET_RECEIVE",
    filters: filters,
    receivedAt: Date.now(),
  };
}

function errorReceivingFilters(error: unknown): ErrorAction {
  return {
    type: AppActionType.APP_SHOW_ERROR,
    message: "Failed to get filters",
    error: error,
    receivedAt: Date.now(),
  };
}
