import { addUserCollections } from "../../services/UserApi";
import { listUsers } from "./listUsers";

export function addCollectionsToUser(username, collections) {
  return (dispatch) => {
    dispatch(requestAddCollectionsToUser());
    return addUserCollections(username, collections)
      .then(() => {
        listUsers()(dispatch);
        dispatch(receiveAddCollectionsToUser());
      })
      .catch((error) => dispatch(errorAddCollectionsToUser(error)));
  };
}

function requestAddCollectionsToUser() {
  return {
    type: "ADD_COLLECTION_TO_USER_REQUEST",
    receivedAt: Date.now(),
  };
}

function receiveAddCollectionsToUser() {
  return {
    type: "ADD_COLLECTION_TO_UR_RECEIVE",
    receivedAt: Date.now(),
  };
}

function errorAddCollectionsToUser(error, username, collection) {
  return {
    type: "ADD_COLLECTION_TO_USER_ERROR",
    message: `Failed to add collection ${collection} to user ${username}`,
    error: error,
    receivedAt: Date.now(),
  };
}
