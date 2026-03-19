import { fetchCollection } from "../../services/CollectionsApi";

export function getCollection(uri: string) {
  return (dispatch: any) => {
    dispatch(requestCollection(uri));
    return fetchCollection(uri)
      .then((res) => {
        if (!res) {
          dispatch(errorReceivingCollection("Collection does not exist", uri));
        } else {
          dispatch(receiveCollection(res));
        }
      })
      .catch((error) => dispatch(errorReceivingCollection(error, uri)));
  };
}

function requestCollection(uri: string) {
  return {
    type: "COLLECTION_GET_REQUEST",
    uri: uri,
    receivedAt: Date.now(),
  };
}

function receiveCollection(collection: any) {
  return {
    type: "COLLECTION_GET_RECEIVE",
    collection: collection,
    receivedAt: Date.now(),
  };
}

function errorReceivingCollection(error: any, uri: string) {
  return {
    type: "APP_SHOW_ERROR",
    message: `Failed to get collection: ${uri}`,
    error: error,
    receivedAt: Date.now(),
  };
}
