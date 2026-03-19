import { fetchFilters } from "../services/FiltersApi";

export function getFilters() {
  return (dispatch: any) => {
    dispatch(requestFilters());
    return fetchFilters()
      .then((res) => {
        dispatch(recieveFilters(res));
      })
      .catch((error) => dispatch(errorReceivingFilters(error)));
  };
}

function requestFilters() {
  return {
    type: "FILTERS_GET_REQUEST",
    receivedAt: Date.now(),
  };
}

function recieveFilters(filters: any) {
  return {
    type: "FILTERS_GET_RECEIVE",
    filters: filters,
    receivedAt: Date.now(),
  };
}

function errorReceivingFilters(error: any) {
  return {
    type: "APP_SHOW_ERROR",
    message: "Failed to get filters",
    error: error,
    receivedAt: Date.now(),
  };
}
