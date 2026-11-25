import { invalidateExistingTokens } from "../../services/AuthApi";
import { AuthAction } from "../../types/redux/GiantActions";
import { GiantDispatch } from "../../types/redux/GiantDispatch";

export function invalidateAuthToken() {
  return (dispatch: GiantDispatch) => {
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
      .catch((error: unknown) =>
        dispatch(errorReceivingTokenInvalidation(error)),
      );
  };
}

function requestTokenInvalidation(): AuthAction {
  return {
    type: "AUTH_TOKEN_INVALIDATION_REQUEST",
    receivedAt: Date.now(),
  };
}

function receiveTokenInvalidation(): AuthAction {
  return {
    type: "AUTH_TOKEN_INVALIDATION_RECEIVE",
    receivedAt: Date.now(),
  };
}

function errorReceivingTokenInvalidation(error: unknown): AuthAction {
  return {
    type: "AUTH_TOKEN_INVALIDATION_ERROR",
    message: "Logout failed.",
    error: error,
    receivedAt: Date.now(),
  };
}
