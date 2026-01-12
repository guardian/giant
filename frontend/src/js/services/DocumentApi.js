import authFetch from "../util/auth/authFetch";

export function fetchIngestions(collectionName) {
  return authFetch(`/api/collections/${collectionName}`).then((res) =>
    res.json(),
  );
}

export function authDownloadLink(uri, filename) {
  if (filename) {
    return `/api/download/auth/${uri}?filename=${filename}`;
  } else {
    return `/api/download/auth/${uri}`;
  }
}
