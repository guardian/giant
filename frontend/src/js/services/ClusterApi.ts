import authFetch from "../util/auth/authFetch";

export function fetchNodes() {
  return authFetch("/api/cluster/members").then((res) => res.json());
}

export function listDirectory(hostname: string, path: string) {
  return authFetch(`/api/cluster/members/${hostname}/fs${path}`).then((res) =>
    res.json(),
  );
}
