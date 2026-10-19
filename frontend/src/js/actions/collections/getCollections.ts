import { GiantDispatch } from "../../types/redux/GiantDispatch";
import { Collection } from "../../types/Collection";
import {
  CollectionAction,
  AppAction,
  AppActionType,
} from "../../types/redux/GiantActions";
import { fetchCollections } from "../../services/CollectionsApi";

export function getCollections() {
  return (dispatch: GiantDispatch) => {
    dispatch(requestCollections());
    return fetchCollections()
      .then((res) => {
        dispatch(receiveCollections(res));
      })
      .catch((error) => dispatch(errorReceivingCollections(error)));
  };
}

export function requestCollections(): CollectionAction {
  return {
    type: "COLLECTIONS_GET_REQUEST",
    receivedAt: Date.now(),
  };
}

export function receiveCollections(
  collections: Collection[],
): CollectionAction {
  return {
    type: "COLLECTIONS_GET_RECEIVE",
    collections: collections,
    receivedAt: Date.now(),
  };
}

export function errorReceivingCollections(error: unknown): AppAction {
  return {
    type: AppActionType.APP_SHOW_ERROR,
    message: "Failed to get collections",
    error: error,
    receivedAt: Date.now(),
  };
}
