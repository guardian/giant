import authFetch from "../util/auth/authFetch";

export function listUsersApi() {
  return authFetch("/api/users").then((res) => res.json());
}

export function addUserCollections(username: string, collections: string[]) {
  return authFetch(`/api/users/${username}/collections`, {
    headers: new Headers({ "Content-Type": "application/json" }),
    method: "POST",
    body: JSON.stringify(collections),
  });
}

export function getMyPermissions() {
  return authFetch("/api/currentUser/permissions").then((res) => res.json());
}

export function createUserApi(username: string, password: string) {
  return authFetch(`/api/users/${username}`, {
    headers: new Headers({ "Content-Type": "application/json" }),
    method: "PUT",
    body: JSON.stringify({ username: username, password: password }),
  }).then((res) => res.json());
}

export function updatePasswordApi(username: string, password: string) {
  return authFetch(`/api/users/${username}/password`, {
    headers: new Headers({ "Content-Type": "application/json" }),
    method: "POST",
    body: JSON.stringify({ password: password }),
  }).then((res) => res.json());
}

export function updateFullnameApi(username: string, displayName: string) {
  return authFetch(`/api/users/${username}/displayName`, {
    headers: new Headers({ "Content-Type": "application/json" }),
    method: "POST",
    body: JSON.stringify({ displayName: displayName }),
  }).then((res) => res.json());
}

export function setUserPermissionsApi(username: string, granted: string[]) {
  return authFetch(`/api/users/${username}/permissions`, {
    headers: new Headers({ "Content-Type": "application/json" }),
    method: "POST",
    body: JSON.stringify({ permissions: { granted: granted } }),
  });
}

export function deleteUserApi(username: string) {
  return authFetch(`/api/users/${username}`, {
    method: "DELETE",
  });
}

// these functions don't need authentication as they are for creating the very first user
export function genesisSetupCheckApi() {
  return fetch("/setup").then((res) => res.json());
}

export function genesisSetupInitialDatabaseUserApi(
  username: string,
  displayName: string,
  password: string,
  totpActivation: any,
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

export function genesisSetupInitialPandaUserApi(email: string) {
  return fetch("/setup", {
    headers: new Headers({ "Content-Type": "application/json" }),
    method: "PUT",
    body: JSON.stringify({ username: email }),
  }).then((res) => res.json());
}

export function generate2faToken(username: string) {
  return fetch(`/api/auth/generate2faToken/${username}`).then((res) =>
    res.json(),
  );
}
