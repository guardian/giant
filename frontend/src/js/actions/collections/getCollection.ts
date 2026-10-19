import { GiantDispatch } from "../../types/redux/GiantDispatch";
import { Collection } from "../../types/Collection";
import {
  CollectionAction,
  AppAction,
  AppActionType,
} from "../../types/redux/GiantActions";
import { fetchCollection } from "../../services/CollectionsApi";

export function getCollection(uri: string) {
  return (dispatch: GiantDispatch) => {
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

function requestCollection(uri: string): CollectionAction {
  return {
    type: "COLLECTION_GET_REQUEST",
    uri: uri,
    receivedAt: Date.now(),
  };
}

function receiveCollection(collection: Collection): CollectionAction {
  return {
    type: "COLLECTION_GET_RECEIVE",
    collection: collection,
    receivedAt: Date.now(),
  };
}

function errorReceivingCollection(error: unknown, uri: string): AppAction {
  return {
    type: AppActionType.APP_SHOW_ERROR,
    message: `Failed to get collection: ${uri}`,
    error: error,
    receivedAt: Date.now(),
  };
}
