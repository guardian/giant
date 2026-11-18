import { sessionKeepalive as sessionKeepaliveApi } from "../../services/AuthApi";
import { AuthAction } from "../../types/redux/GiantActions";
import { GiantDispatch } from "../../types/redux/GiantDispatch";

export function sessionKeepalive() {
  return (dispatch: GiantDispatch) => {
    dispatch(requestSessionKeepalive());
    return sessionKeepaliveApi()
      .then((response) => {
        const status = response.status;
        if (status === 204) {
          dispatch(receiveSessionKeepalive());
        } else {
          dispatch(
            errorReceivingSessionKeepalive("unexpected server response"),
          );
        }
      })
      .catch((error: unknown) =>
        dispatch(errorReceivingSessionKeepalive(error)),
      );
  };
}

function requestSessionKeepalive(): AuthAction {
  return {
    type: "AUTH_SESSION_KEEPALIVE_REQUEST",
    receivedAt: Date.now(),
  };
}

function receiveSessionKeepalive(): AuthAction {
  return {
    type: "AUTH_SESSION_KEEPALIVE_RECEIVE",
    receivedAt: Date.now(),
  };
}

function errorReceivingSessionKeepalive(error: unknown): AuthAction {
  return {
    type: "AUTH_SESSION_KEEPALIVE_ERROR",
    message: "Attempt to keep session alive failed.",
    error: error,
    receivedAt: Date.now(),
  };
}
