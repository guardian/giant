import { replace } from "connected-react-router";
import _isEqual from "lodash/isEqual";

import { objectToParamString, paramStringToObject } from "./UrlParameters";
import { updateUrlParams } from "../actions/urlParams/updateSearchQuery";

export const updateUrlFromStateChangeMiddleware =
  ({ dispatch, getState }) =>
  (next) =>
  (action) => {
    const prevState = getState();
    let result = next(action);
    const newState = getState();

    if (!_isEqual(prevState.urlParams, newState.urlParams)) {
      const location = newState.router.location;
      const paramString = `?${objectToParamString(newState.urlParams)}`;

      if (location && paramString !== location.search) {
        const newLocation = Object.assign({}, location, {
          search: paramString || "",
        });

        newLocation.pathname = encodeURI(location.pathname);
        const updateAction = replace(newLocation);
        dispatch(updateAction);
      }
    }

    return result;
  };

export const updateStateFromUrlChangeMiddleware =
  ({ dispatch, getState }) =>
  (next) =>
  (action) => {
    next(action);
    const newState = getState();

    if (action.type === "@@router/LOCATION_CHANGE") {
      const urlSearchParams = paramStringToObject(
        newState.router.location.search,
      );
      if (!_isEqual(urlSearchParams, newState.urlParams)) {
        dispatch(updateUrlParams(urlSearchParams));
      }
    }
  };
