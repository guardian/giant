import React from "react";
import { render } from "react-dom";
import { Provider } from "react-redux";

import App from "./js/App";
import store from "./js/util/store";
import history from "./js/util/history";

import { receiveToken } from "./js/actions/auth/getAuthToken";
import { StylesheetLoader } from "./js/util/stylesheets/StylesheetLoader";

if (localStorage.pfiAuthHeader) {
  store.dispatch(receiveToken(localStorage.pfiAuthHeader));
}

const defaultPreferences = {
  showSearchHighlights: true,
  showCommentHighlights: true,
};

function loadPreferences() {
  const existingItem = localStorage.getItem("preferences");
  const existingPreferences = existingItem ? JSON.parse(existingItem) : null;

  if (!existingPreferences) {
    localStorage.setItem("preferences", JSON.stringify(defaultPreferences));
    return defaultPreferences;
  }

  if (existingPreferences.showCommentHighlights === undefined) {
    existingPreferences.showCommentHighlights = true;
    localStorage.setItem("preferences", JSON.stringify(existingPreferences));
  }

  return existingPreferences;
}

fetch("/api/config")
  .then((r) => r.json())
  .then((config) => {
    store.dispatch({
      type: "APP_SET_CONFIG",
      config,
      receivedAt: Date.now(),
    });

    const preferences = loadPreferences();

    store.dispatch({
      type: "APP_SET_PREFERENCES",
      receivedAt: Date.now(),
      preferences,
    });

    const renderComponent = (Component) => {
      render(
        <Provider store={store}>
          <StylesheetLoader eui={preferences.featureEUI}>
            <Component history={history} />
          </StylesheetLoader>
        </Provider>,
        document.getElementById("root"),
      );
    };

    renderComponent(App);
  });
