import { AppActionType } from "../types/redux/GiantActions";
import { GiantDispatch } from "../types/redux/GiantDispatch";

export function clearError(index: number) {
  return (dispatch: GiantDispatch) => {
    dispatch({
      type: AppActionType.APP_CLEAR_ERROR,
      index: index,
      receivedAt: Date.now(),
    });
  };
}

export function clearWarning(index: number) {
  return (dispatch: GiantDispatch) => {
    dispatch({
      type: AppActionType.APP_CLEAR_WARNING,
      index: index,
      receivedAt: Date.now(),
    });
  };
}

export function clearAllErrors() {
  return (dispatch: GiantDispatch) => {
    dispatch({
      type: AppActionType.APP_CLEAR_ERRORS,
      receivedAt: Date.now(),
    });
  };
}

export function clearAllWarnings() {
  return (dispatch: GiantDispatch) => {
    dispatch({
      type: AppActionType.APP_CLEAR_WARNINGS,
      receivedAt: Date.now(),
    });
  };
}

export function createError(error: unknown, message: string) {
  return (dispatch: GiantDispatch) => {
    dispatch({
      type: AppActionType.APP_SHOW_ERROR,
      message: message,
      error: error,
      receivedAt: Date.now(),
    });
  };
}

export function createWarning(message: string) {
  return (dispatch: GiantDispatch) => {
    dispatch({
      type: AppActionType.APP_SHOW_WARNING,
      message: message,
      receivedAt: Date.now(),
    });
  };
}
