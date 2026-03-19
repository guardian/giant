import { getEmailThread as getEmailThreadApi } from "../../services/EmailApi";

export function getEmailThread(uri: string) {
  return (dispatch: any) => {
    return getEmailThreadApi(uri)
      .then((res) => {
        dispatch(receiveEmailThread(uri, res));
      })
      .catch((error) => dispatch(errorReceivingEmailThread(error)));
  };
}

function receiveEmailThread(uri: string, doc: any) {
  return {
    type: "EMAIL_THREAD_RECEIVE",
    uri: uri,
    timeline: doc,
    receivedAt: Date.now(),
  };
}

function errorReceivingEmailThread(error: any) {
  return {
    type: "APP_SHOW_ERROR",
    message: "Failed to get email thread",
    error: error,
    receivedAt: Date.now(),
  };
}
