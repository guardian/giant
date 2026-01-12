import authFetch from "../util/auth/authFetch";

export function getToken(username, password, tfaCode) {
  const params = new URLSearchParams();
  params.append("username", username);
  params.append("password", password);

  if (tfaCode) {
    params.append("tfa", tfaCode);
  }

  return fetch("/api/auth/token", {
    method: "POST",
    body: params,
  });
}

export function invalidateExistingTokens() {
  return authFetch("/api/auth/token", {
    method: "DELETE",
  });
}

export function authorizedDownload(href) {
  return authFetch(href, { credentials: "same-origin" }).then((res) =>
    res.text(),
  );
}

export function sessionKeepalive() {
  return authFetch("/api/keepalive");
}
