import { listUsersApi } from "../../services/UserApi";
import { UserActionType, GiantAction } from "../../types/redux/GiantActions";
import { GiantDispatch } from "../../types/redux/GiantDispatch";

export function listUsers() {
  return (dispatch: GiantDispatch) => {
    dispatch(requestUserList());
    return listUsersApi()
      .then((res) => {
        dispatch(receiveUserList(res.users));
      })
      .catch((error) => dispatch(errorReceivingUserList(error)));
  };
}

function requestUserList(): GiantAction {
  return {
    type: UserActionType.LIST_USERS_REQUEST,
    receivedAt: Date.now(),
  };
}

function receiveUserList(users: string[]): GiantAction {
  return {
    type: UserActionType.LIST_USERS_RECEIVE,
    users: users,
    receivedAt: Date.now(),
  };
}

function errorReceivingUserList(error: string): GiantAction {
  return {
    type: UserActionType.LIST_USERS_ERROR,
    message: "Failed to list users",
    error: error,
    receivedAt: Date.now(),
  };
}
