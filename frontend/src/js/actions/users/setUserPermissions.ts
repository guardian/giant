import { setUserPermissionsApi } from "../../services/UserApi";
import { listUsers } from "./listUsers";

export function setUserPermissions(username: string, granted: string[]) {
  return (dispatch: any) => {
    return setUserPermissionsApi(username, granted)
      .then(() => {
        listUsers()(dispatch);
      })
      .catch((error) => dispatch(errorSetUserPermissions(username, error)));
  };
}

function errorSetUserPermissions(error: any, username: string) {
  return {
    type: "APP_SHOW_ERROR",
    message: `Failed to set permissions for user ${username}`,
    error: error,
    receivedAt: Date.now(),
  };
}
