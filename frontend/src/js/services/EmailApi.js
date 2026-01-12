import authFetch from "../util/auth/authFetch";

export function getEmailThread(uri) {
  return authFetch(`/api/emails/thread/${uri}`).then((res) => res.json());
}
