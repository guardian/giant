export default function emails(state: any = null, action: any) {
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
