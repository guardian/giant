export default function auth(
  state = {
    header: undefined,
    token: undefined,
    username: undefined,
    requesting: false,
    require2fa: false,
    requirePanda: false,
    forbidden: false,
    errors: [],
  },
  action,
) {
  switch (action.type) {
    case "AUTH_TOKEN_GET_REQUEST":
    case "AUTH_TOKEN_INVALIDATION_REQUEST":
      return Object.assign({}, state, {
        requesting: true,
        errors: [],
      });

    case "AUTH_TOKEN_GET_RECEIVE":
      return Object.assign({}, state, {
        requesting: false,
        header: action.header,
        jwtToken: action.jwtToken,
        token: action.token,
        require2fa: false,
        errors: [],
      });

    case "AUTH_REQUIRE_2FA":
      return Object.assign({}, state, {
        require2fa: true,
        requesting: false,
        errors: [action.message],
      });

    case "AUTH_REQUIRE_PANDA":
      return Object.assign({}, state, {
        requirePanda: true,
        requesting: false,
        errors: [action.message],
      });

    case "AUTH_TOKEN_SHOW_ERROR":
      return Object.assign({}, state, {
        requesting: false,
        require2fa: false,
        username: action.username,
        errors: [action.message],
      });

    case "AUTH_TOKEN_INVALIDATION_RECEIVE":
    case "AUTH_FETCH_UNAUTHORISED":
      return Object.assign({}, state, {
        require2fa: false,
        requesting: false,
        header: undefined,
        jwtToken: undefined,
        token: undefined,
        username: undefined,
        errors: [],
      });

    case "AUTH_FORBIDDEN":
      return Object.assign({}, state, {
        forbidden: true,
        errors: [action.message],
      });

    case "AUTH_TOKEN_INVALIDATION_ERROR":
      return Object.assign({}, state, {
        requesting: false,
        require2fa: false,
        errors: [action.message],
      });

    case "AUTH_SESSION_KEEPALIVE_REQUEST":
      return Object.assign({}, state, {
        lastSessionKeepaliveRequest: action.receivedAt,
        errors: [],
      });

    case "AUTH_SESSION_KEEPALIVE_RECEIVE":
      return Object.assign({}, state, {
        lastSessionKeepaliveResponse: action.receivedAt,
        errors: [],
      });

    case "AUTH_SESSION_KEEPALIVE_ERROR":
      return Object.assign({}, state, {
        errors: [action.message],
      });

    default:
      return state;
  }
}
