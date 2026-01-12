import { invalidateExistingTokens } from "../../services/AuthApi";

export function invalidateAuthToken() {
  return (dispatch) => {
    dispatch(requestTokenInvalidation());
    return invalidateExistingTokens()
      .then((response) => {
        const status = response.status;
        if (status === 204) {
          dispatch(receiveTokenInvalidation());
          localStorage.removeItem("pfiAuthHeader");
        } else {
          dispatch(
            errorReceivingTokenInvalidation("unexpected server response"),
          );
        }
      })
      .catch((error) => dispatch(errorReceivingTokenInvalidation(error)));
  };
}

function requestTokenInvalidation() {
  return {
    type: "AUTH_TOKEN_INVALIDATION_REQUEST",
    receivedAt: Date.now(),
  };
}

function receiveTokenInvalidation() {
  return {
    type: "AUTH_TOKEN_INVALIDATION_RECEIVE",
    receivedAt: Date.now(),
  };
}

function errorReceivingTokenInvalidation(error) {
  return {
    type: "AUTH_TOKEN_INVALIDATION_ERROR",
    message: "Logout failed.",
    error: error,
    receivedAt: Date.now(),
  };
}
