import { getMyPermissions as fetchMyPermissions } from "../../services/UserApi";

export function getMyPermissions() {
  return (dispatch: any) => {
    return fetchMyPermissions()
      .then((res) => {
        dispatch(receiveMyPermissions(res.granted));
      })
      .catch((error) => dispatch(errorReceivingMyPermissions(error)));
  };
}

function receiveMyPermissions(permissions: any) {
  return {
    type: "GET_MY_PERMISSIONS_RECEIVE",
    permissions: permissions,
    receivedAt: Date.now(),
  };
}

function errorReceivingMyPermissions(error: any) {
  return {
    type: "LIST_USERS_ERROR",
    message: "Failed to get permissions",
    error: error,
    receivedAt: Date.now(),
  };
}
