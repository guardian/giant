import { EmailAction } from "../types/redux/GiantActions";
import { EmailsState } from "../types/redux/GiantState";

export default function emails(
  state: EmailsState = null,
  action: EmailAction,
): EmailsState {
  switch (action.type) {
    case "EMAIL_THREAD_RECEIVE":
      return Object.assign({}, state, {
        uri: action.uri,
        timeline: action.timeline,
      });

    default:
      return state;
  }
}
