import jwt_decode from "jwt-decode";
import { getToken } from "../../services/AuthApi";
import { clearAllErrors, clearAllWarnings } from "../problems";

export function getAuthToken(username, password, tfaCode) {
  return (dispatch) => {
    dispatch(requestToken(username));
    return getToken(username, password, tfaCode)
      .then((response) => {
        const status = response.status;
        const authHeader = response.headers.get("X-Offer-Authorization");
        const authenticate = response.headers.get("WWW-Authenticate");
        if (status === 204 && authHeader) {
          localStorage.pfiAuthHeader = authHeader;
          dispatch(receiveToken(authHeader));
          clearAllErrors()(dispatch);
          clearAllWarnings()(dispatch);
        } else if (status === 401 && authenticate === "Pfi2fa") {
          response.text().then((text) => {
            dispatch(require2fa(text));
          });
        } else if (status === 401 && authenticate === "Panda") {
          response.text().then((text) => {
            dispatch(requirePanda(text));
          });
        } else if (status === 403) {
          response.text().then((text) => {
            dispatch(forbidden(text));
          });
        } else {
          dispatch(errorReceivingToken(username, "login failure"));
        }
      })
      .catch((error) => dispatch(errorReceivingToken(error)));
  };
}

function requestToken(username) {
  return {
    type: "AUTH_TOKEN_GET_REQUEST",
    username: username,
    receivedAt: Date.now(),
  };
}

export function receiveToken(authHeader) {
  const elements = authHeader.split(" ");
  const jwtToken = elements[1];
  const decoded = jwt_decode(jwtToken);
  return {
    type: "AUTH_TOKEN_GET_RECEIVE",
    header: authHeader,
    jwtToken: jwtToken,
    token: decoded,
    receivedAt: Date.now(),
  };
}

function require2fa(message) {
  return {
    type: "AUTH_REQUIRE_2FA",
    message: message,
    receivedAt: Date.now(),
  };
}

function requirePanda(url) {
  return {
    type: "AUTH_REQUIRE_PANDA",
    url: url,
    receivedAt: Date.now(),
  };
}

function forbidden(message) {
  return {
    type: "AUTH_FORBIDDEN",
    message: message,
    receivedAt: Date.now(),
  };
}

function errorReceivingToken(username, error) {
  return {
    type: "AUTH_TOKEN_SHOW_ERROR",
    message: "Login failed, please check your credentials",
    username: username,
    error: error,
    receivedAt: Date.now(),
  };
}
