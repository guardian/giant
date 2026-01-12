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
