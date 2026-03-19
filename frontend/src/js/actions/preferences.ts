export function getPreference(key: string) {
  const prefs = JSON.parse(localStorage.getItem("preferences"));
  return prefs[key];
}

export function setPreference(key: string, value: any) {
  const prefs = JSON.parse(localStorage.getItem("preferences"));
  prefs[key] = value;

  localStorage.setItem("preferences", JSON.stringify(prefs));
  return prefs;
}

export function updatePreference(key: string, value: any) {
  const prefs = setPreference(key, value);

  return (dispatch: any) => {
    dispatch(setPreferences(prefs));
  };
}

function setPreferences(prefs: any) {
  return {
    type: "APP_SET_PREFERENCES",
    receivedAt: Date.now(),
    preferences: prefs,
  };
}
