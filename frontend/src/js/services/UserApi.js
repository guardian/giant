import authFetch from "../util/auth/authFetch";

export function listUsersApi() {
  return authFetch("/api/users").then((res) => res.json());
}

export function addUserCollections(username, collections) {
  return authFetch(`/api/users/${username}/collections`, {
    headers: new Headers({ "Content-Type": "application/json" }),
    method: "POST",
    body: JSON.stringify(collections),
  });
}

export function getMyPermissions() {
  return authFetch("/api/currentUser/permissions").then((res) => res.json());
}

export function createUserApi(username, password) {
  return authFetch(`/api/users/${username}`, {
    headers: new Headers({ "Content-Type": "application/json" }),
    method: "PUT",
    body: JSON.stringify({ username: username, password: password }),
  }).then((res) => res.json());
}

export function updatePasswordApi(username, password) {
  return authFetch(`/api/users/${username}/password`, {
    headers: new Headers({ "Content-Type": "application/json" }),
    method: "POST",
    body: JSON.stringify({ password: password }),
  }).then((res) => res.json());
}

export function updateFullnameApi(username, displayName) {
  return authFetch(`/api/users/${username}/displayName`, {
    headers: new Headers({ "Content-Type": "application/json" }),
    method: "POST",
    body: JSON.stringify({ displayName: displayName }),
  }).then((res) => res.json());
}

export function setUserPermissionsApi(username, granted) {
  return authFetch(`/api/users/${username}/permissions`, {
    headers: new Headers({ "Content-Type": "application/json" }),
    method: "POST",
    body: JSON.stringify({ permissions: { granted: granted } }),
  });
}

export function deleteUserApi(username) {
  return authFetch(`/api/users/${username}`, {
    method: "DELETE",
  });
}

// these functions don't need authentication as they are for creating the very first user
export function genesisSetupCheckApi() {
  return fetch("/setup").then((res) => res.json());
}

export function genesisSetupInitialDatabaseUserApi(
  username,
  displayName,
  password,
  totpActivation,
) {
  return fetch("/setup", {
    headers: new Headers({ "Content-Type": "application/json" }),
    method: "PUT",
    body: JSON.stringify({
      username: username,
      displayName: displayName,
      password: password,
      totpActivation: totpActivation,
    }),
  }).then((res) => res.json());
}

export function genesisSetupInitialPandaUserApi(email) {
  return fetch("/setup", {
    headers: new Headers({ "Content-Type": "application/json" }),
    method: "PUT",
    body: JSON.stringify({ username: email }),
  }).then((res) => res.json());
}

export function generate2faToken(username) {
  return fetch(`/api/auth/generate2faToken/${username}`).then((res) =>
    res.json(),
  );
}
