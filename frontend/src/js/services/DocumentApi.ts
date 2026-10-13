import { Collection, collectionWithUsersSchema } from "../types/Collection";
import authFetch from "../util/auth/authFetch";

// Despite the name, this endpoint returns a collection, not an ingestion array.
export async function fetchIngestions(
  collectionName: string,
): Promise<Collection> {
  const res = await authFetch(`/api/collections/${collectionName}`);
  const data: unknown = await res.json();
  const result = collectionWithUsersSchema.safeParse(data);
  if (!result.success) throw result.error;
  return result.data;
}

export function authDownloadLink(uri: string, filename?: string) {
  if (filename) {
    return `/api/download/auth/${uri}?filename=${filename}`;
  } else {
    return `/api/download/auth/${uri}`;
  }
}
