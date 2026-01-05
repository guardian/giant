import { fetchResource } from "../../services/ResourceApi";
import {
  hasSingleExpandableBlobChild,
  hasSingleIngestionChild,
} from "../../util/resourceUtils";

function handleResourceResponse(dispatch, res) {
  // In our clientside state, when a collection has just a single ingestion, this ingestion
  // carries no real information so we want to hide it in the UI.
  // So we fetch the grandchildren of the collection and join them directly to the collection.
  if (hasSingleIngestionChild(res)) {
    return fetchResource(res.children[0].uri, true).then((child) => {
      dispatch(
        receiveResource({
          ...res,
          children: child.children,
        }),
      );
      dispatch(setIsResourceLoading(false));
    });
  } else {
    dispatch(receiveResource(res));
    dispatch(setIsResourceLoading(false));
  }
}

export function getResource(uri, highlightQuery) {
  return (dispatch) => {
    dispatch(setIsResourceLoading(true));
    return fetchResource(uri, false, highlightQuery)
      .then((res) => {
        handleResourceResponse(dispatch, res);
      })
      .catch((error) => dispatch(errorReceivingResource(error)));
  };
}

export function getBasicResource(uri, highlightQuery) {
  return (dispatch) => {
    return fetchResource(uri, true, highlightQuery)
      .then((res) => {
        handleResourceResponse(dispatch, res);
      })
      .catch((error) => dispatch(errorReceivingResource(error)));
  };
}

export function getChildResource(uri) {
  return (dispatch) => {
    return fetchResource(uri, true)
      .then((res) => {
        // In our clientside state, when we have an expandable blob (e.g. a zip file)
        // we do not want this node to intervene between the parent file and the blob's
        // children (e.g. the contents of the zip file). So when we fetch a node which
        // turns out to be the parent of an expandable blob, we fetch the blob's children
        // and join them to the file parent, effectively hiding the blob node from the client.
        if (hasSingleExpandableBlobChild(res)) {
          return fetchResource(res.children[0].uri, true).then(
            (expandableBlobChild) => {
              dispatch(
                receiveChildResource({
                  ...res,
                  // Skip a generation by joining a parent to its grandchildren!
                  children: expandableBlobChild.children,
                }),
              );
            },
          );
        } else {
          dispatch(receiveChildResource(res));
        }
      })
      .catch((error) => dispatch(errorReceivingResource(error)));
  };
}

export function resetResource() {
  return {
    type: "RESET_RESOURCE",
    receivedAt: Date.now(),
  };
}

export function setIsResourceLoading(isLoadingResource) {
  return {
    type: "SET_RESOURCE_LOADING_STATE",
    isLoadingResource: isLoadingResource,
    receivedAt: Date.now(),
  };
}

function receiveResource(doc) {
  return {
    type: "RESOURCE_GET_RECEIVE",
    resource: doc,
    receivedAt: Date.now(),
  };
}

function receiveChildResource(doc) {
  return {
    type: "RESOURCE_CHILD_GET_RECEIVE",
    resource: doc,
    receivedAt: Date.now(),
  };
}

function errorReceivingResource(error) {
  return {
    type: "APP_SHOW_ERROR",
    message: "Failed to get resource",
    error: error,
    receivedAt: Date.now(),
  };
}
