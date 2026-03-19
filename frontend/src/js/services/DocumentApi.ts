import authFetch from "../util/auth/authFetch";

export function fetchIngestions(collectionName: string) {
  return authFetch(`/api/collections/${collectionName}`).then((res) =>
    res.json(),
  );
}

export function authDownloadLink(uri: string, filename?: string) {
  if (filename) {
    return `/api/download/auth/${uri}?filename=${filename}`;
  } else {
    return `/api/download/auth/${uri}`;
  }
}
