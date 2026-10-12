import authFetch from "../util/auth/authFetch";
import { objectToParamString } from "../util/UrlParameters";
import { suggestedFieldsSchema } from "../types/SuggestedFields";
import { searchResponseSchema } from "../types/SearchResults";
import {
  SearchQuery,
  SearchQueryFragment,
  searchQueryFragmentsSchema,
} from "../types/SearchQuery";
import { parseDate } from "../util/parseDate";

export async function getSuggestedFields() {
  const res = await authFetch("/api/search/fields");
  const data: unknown = await res.json();
  const result = suggestedFieldsSchema.safeParse(data);
  if (!result.success) {
    // Reject through getSuggestedFields' existing APP_SHOW_ERROR path.
    throw result.error;
  }
  return result.data;
}

function transformQuery(q: SearchQueryFragment[]) {
  return q.map((fragment) => {
    if (typeof fragment !== "string") {
      if (fragment.t === "date") {
        const parsed = parseDate(fragment.v, "from_start");
        if (parsed) {
          return Object.assign({}, fragment, { v: parsed.toString() });
        } else {
          // If the date chip is invalid just ignore it
          return "";
        }
      } else if (fragment.t === "date_ex") {
        const parsed = parseDate(fragment.v, "from_end");
        if (parsed) {
          return Object.assign({}, fragment, { v: parsed.toString() });
        } else {
          // If the date chip is invalid just ignore it
          return "";
        }
      }
    }

    return fragment;
  });
}

export async function performSearch(searchQuery: SearchQuery) {
  // Syntax, schema, fetch and response JSON failures reject through the action's
  // existing SEARCH_FAILURE path.
  const query: unknown = JSON.parse(searchQuery.q);
  const parsed = searchQueryFragmentsSchema.safeParse(query);
  if (!parsed.success) {
    throw parsed.error;
  }
  const queryString = JSON.stringify(transformQuery(parsed.data));

  const queryObject = Object.assign({}, searchQuery.filters, {
    q: queryString,
    page: searchQuery.page ? searchQuery.page : 1,
    // TODO replace with user preferences for page size
    pageSize: searchQuery.pageSize ? searchQuery.pageSize : 100,
    // TODO replace with user preferences for sort by
    sortBy: searchQuery.sortBy ? searchQuery.sortBy : "relevance",
  });

  const res = await authFetch(
    `/api/search?${objectToParamString(queryObject)}`,
  );
  const data: unknown = await res.json();
  const result = searchResponseSchema.safeParse(data);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}
