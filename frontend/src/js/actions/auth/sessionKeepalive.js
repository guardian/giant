import { sessionKeepalive as sessionKeepaliveApi } from "../../services/AuthApi";

export function sessionKeepalive() {
  return (dispatch) => {
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
      .catch((error) => dispatch(errorReceivingSessionKeepalive(error)));
  };
}

function requestSessionKeepalive() {
  return {
    type: "AUTH_SESSION_KEEPALIVE_REQUEST",
    receivedAt: Date.now(),
  };
}

function receiveSessionKeepalive() {
  return {
    type: "AUTH_SESSION_KEEPALIVE_RECEIVE",
    receivedAt: Date.now(),
  };
}

function errorReceivingSessionKeepalive(error) {
  return {
    type: "AUTH_SESSION_KEEPALIVE_ERROR",
    message: "Attempt to keep session alive failed.",
    error: error,
    receivedAt: Date.now(),
  };
}
