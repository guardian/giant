import { objectToParamString, UrlParameters } from "./UrlParameters";
import { UrlParamsState } from "../types/redux/GiantState";

// Build a URL but keep search text, page, sort-by and filters unless they are set in overrides
export default function buildLink(
  to: string,
  urlParams: Omit<Partial<UrlParamsState>, "page"> & { page?: string | number },
  overrides?: UrlParameters,
): string {
  const params: UrlParameters = Object.assign({}, overrides);
  const encodedUri = encodeURI(to);

  Object.keys(params).forEach((k) => {
    if (params[k] === null) delete params[k];
  });

  if (!params.q && urlParams.q) {
    params.q = urlParams.q;
  }

  if (!params.sortBy && urlParams.sortBy) {
    params.sortBy = urlParams.sortBy;
  }

  if (!params.page && urlParams.page) {
    params.page = urlParams.page;
  }

  if (!params.filters && urlParams.filters) {
    params.filters = urlParams.filters;
  }

  if (!params.details && urlParams.details) {
    params.details = urlParams.details;
  }

  return params ? `${encodedUri}?${objectToParamString(params)}` : encodedUri;
}
