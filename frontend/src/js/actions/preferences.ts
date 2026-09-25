import {
  loadPreferences,
  preferencesSchema,
  Preferences,
} from "../types/Preferences";
import { AppAction, AppActionType } from "../types/redux/GiantActions";
import { GiantDispatch } from "../types/redux/GiantDispatch";

export function getPreference(key: string) {
  const prefs = loadPreferences();
  return prefs[key];
}

export function setPreference(key: string, value: unknown) {
  const prefs = loadPreferences();
  const result = preferencesSchema.safeParse({ ...prefs, [key]: value });
  if (!result.success) {
    throw result.error;
  }

  localStorage.setItem("preferences", JSON.stringify(result.data));
  return result.data;
}

export function updatePreference(key: string, value: unknown) {
  const prefs = setPreference(key, value);

  return (dispatch: GiantDispatch) => {
    dispatch(setPreferences(prefs));
  };
}

function setPreferences(prefs: Preferences): AppAction {
  return {
    type: AppActionType.APP_SET_PREFERENCES,
    receivedAt: Date.now(),
    preferences: prefs,
  };
}
