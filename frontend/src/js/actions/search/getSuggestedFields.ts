import { GiantDispatch } from "../../types/redux/GiantDispatch";
import {
  AppActionType,
  ErrorAction,
  SearchAction,
} from "../../types/redux/GiantActions";
import { SuggestedField } from "../../types/SuggestedFields";
import { getSuggestedFields as callGetSuggestedFields } from "../../services/SearchApi";

export function getSuggestedFields() {
  return (dispatch: GiantDispatch) => {
    return callGetSuggestedFields()
      .then((fields) => dispatch(receiveSuggestedFields(fields)))
      .catch((error) => dispatch(errorGettingSuggestedFields(error)));
  };
}

export function receiveSuggestedFields(fields: SuggestedField[]): SearchAction {
  return {
    type: "SUGGESTED_FIELDS_GET_RECEIVE",
    fields: fields,
    receivedAt: Date.now(),
  };
}

function errorGettingSuggestedFields(error: unknown): ErrorAction {
  return {
    type: AppActionType.APP_SHOW_ERROR,
    message: "Failed to get suggested fields",
    error: error,
    receivedAt: Date.now(),
  };
}
