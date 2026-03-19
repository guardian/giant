import { getSuggestedFields as callGetSuggestedFields } from "../../services/SearchApi";

export function getSuggestedFields() {
  return (dispatch: any) => {
    return callGetSuggestedFields()
      .then((fields) => dispatch(receiveSuggestedFields(fields)))
      .catch((error) => dispatch(errorGettingSuggestedFields(error)));
  };
}

export function receiveSuggestedFields(fields: any) {
  return {
    type: "SUGGESTED_FIELDS_GET_RECEIVE",
    fields: fields,
    receivedAt: Date.now(),
  };
}

function errorGettingSuggestedFields(error: any) {
  return {
    type: "APP_SHOW_ERROR",
    message: "Failed to get suggested fields",
    error: error,
    receivedAt: Date.now(),
  };
}
