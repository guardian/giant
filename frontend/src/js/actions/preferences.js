export function getPreference(key) {
  const prefs = JSON.parse(localStorage.getItem("preferences"));
  return prefs[key];
}

export function setPreference(key, value) {
  const prefs = JSON.parse(localStorage.getItem("preferences"));
  prefs[key] = value;

  localStorage.setItem("preferences", JSON.stringify(prefs));
  return prefs;
}

export function updatePreference(key, value) {
  const prefs = setPreference(key, value);

  return (dispatch) => {
    dispatch(setPreferences(prefs));
  };
}

function setPreferences(prefs) {
  return {
    type: "APP_SET_PREFERENCES",
    receivedAt: Date.now(),
    preferences: prefs,
  };
}
