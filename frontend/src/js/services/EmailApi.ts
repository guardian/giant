import authFetch from "../util/auth/authFetch";

export function getEmailThread(uri: string) {
  return authFetch(`/api/emails/thread/${uri}`).then((res) => res.json());
}
