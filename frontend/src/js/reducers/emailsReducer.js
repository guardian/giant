export default function emails(state = null, action) {
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
