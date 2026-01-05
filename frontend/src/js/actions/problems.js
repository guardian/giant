export function clearError(index) {
  return (dispatch) => {
    dispatch({
      type: "APP_CLEAR_ERROR",
      index: index,
      receivedAt: Date.now(),
    });
  };
}

export function clearWarning(index) {
  return (dispatch) => {
    dispatch({
      type: "APP_CLEAR_WARNING",
      index: index,
      receivedAt: Date.now(),
    });
  };
}

export function clearAllErrors() {
  return (dispatch) => {
    dispatch({
      type: "APP_CLEAR_ERRORS",
      receivedAt: Date.now(),
    });
  };
}

export function clearAllWarnings() {
  return (dispatch) => {
    dispatch({
      type: "APP_CLEAR_WARNINGS",
      receivedAt: Date.now(),
    });
  };
}

export function createError(error, message) {
  return (dispatch) => {
    dispatch({
      type: "APP_SHOW_ERROR",
      message: message,
      error: error,
      receivedAt: Date.now(),
    });
  };
}

export function createWarning(message) {
  return (dispatch) => {
    dispatch({
      type: "APP_SHOW_WARNING",
      message: message,
      receivedAt: Date.now(),
    });
  };
}
