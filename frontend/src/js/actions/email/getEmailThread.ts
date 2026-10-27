import { getEmailThread as getEmailThreadApi } from "../../services/EmailApi";

import { EmailThread } from "../../types/Email";
import { GiantDispatch } from "../../types/redux/GiantDispatch";
import {
  AppActionType,
  EmailAction,
  ErrorAction,
} from "../../types/redux/GiantActions";

export function getEmailThread(uri: string) {
  return (dispatch: GiantDispatch) => {
    return getEmailThreadApi(uri)
      .then((res) => {
        dispatch(receiveEmailThread(uri, res));
      })
      .catch((error) => dispatch(errorReceivingEmailThread(error)));
  };
}

function receiveEmailThread(uri: string, doc: EmailThread): EmailAction {
  return {
    type: "EMAIL_THREAD_RECEIVE",
    uri: uri,
    timeline: doc,
    receivedAt: Date.now(),
  };
}

function errorReceivingEmailThread(error: unknown): ErrorAction {
  return {
    type: AppActionType.APP_SHOW_ERROR,
    message: "Failed to get email thread",
    error: error,
    receivedAt: Date.now(),
  };
}
