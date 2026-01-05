import { createUserApi } from "../../services/UserApi";
import { listUsers } from "./listUsers";
import { getCollections } from "../collections/getCollections";
import { UserActionType, UserAction } from "../../types/redux/GiantActions";
import { GiantDispatch } from "../../types/redux/GiantDispatch";

export function createUser(username: string, password: string) {
  return (dispatch: GiantDispatch) => {
    dispatch(requestCreateUser(username));
    return createUserApi(username, password)
      .then(() => {
        listUsers()(dispatch);
        getCollections()(dispatch);
        dispatch(receiveCreateUser(username));
      })
      .catch((error) => {
        dispatch(errorReceivingCreateUser(error, username));
      });
  };
}

function requestCreateUser(username: string): UserAction {
  return {
    type: UserActionType.CREATE_USER_REQUEST,
    username: username,
    receivedAt: Date.now(),
  };
}

function receiveCreateUser(username: string): UserAction {
  return {
    type: UserActionType.CREATE_USER_RECEIVE,
    username: username,
    receivedAt: Date.now(),
  };
}

function errorReceivingCreateUser(error: string, username: string): UserAction {
  return {
    type: UserActionType.CREATE_USER_ERROR,
    message: `Failed to create user ${username}`,
    error: error,
    receivedAt: Date.now(),
  };
}
