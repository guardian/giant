import authFetch from "../util/auth/authFetch";
import { objectToParamString } from "../util/UrlParameters";
import { Resource } from "../types/Resource";

export function fetchResource(
  uri: string,
  basic: boolean,
  highlightQuery?: string,
): Promise<Resource> {
  const params = highlightQuery ? { basic, q: highlightQuery } : { basic };

  return authFetch(`/api/resources/${uri}?${objectToParamString(params)}`).then(
    (res) => res.json(),
  );
}

export async function confirmDeleteWithChildren(
  uri: string,
  name: string,
  showAffectedCollections = true,
): Promise<boolean> {
  const query = new URLSearchParams({ uri });
  const endpoint = `/api/blobs/delete-with-children?${query}`;
  const collections: string[] = showAffectedCollections
    ? await authFetch(endpoint).then((res) => res.json())
    : [];
  const warning = collections.length
    ? `Files in "${name}" exist in the following collections:\n\n${collections.join("\n")}\n\n`
    : "";
  if (
    !window.confirm(
      `${warning}Permanently delete "${name}"${showAffectedCollections ? " and its contents" : ""} from Giant? This deletes all copies. Do you want to continue?`,
    )
  ) {
    return false;
  }
  await authFetch(endpoint, { method: "DELETE" });
  return true;
}
