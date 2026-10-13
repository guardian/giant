import { expect, it } from "vitest";
import search from "./searchReducer";
import { SearchResponse } from "../types/SearchResults";

const query = { q: '["hello"]', filters: { collection: ["one"] } };
const response: SearchResponse = {
  hits: 201,
  took: 2,
  page: 1,
  pageSize: 100,
  results: [],
  aggs: [],
};
const initial = search(undefined, { type: "SEARCH_CLEAR", receivedAt: 0 });

it.each([100, 0])("computes pages for page size %s", (pageSize) => {
  const requested = search(initial, {
    type: "SEARCH_GET_REQUEST",
    query,
    receivedAt: 1,
  });
  expect(requested.isSearchInProgress).toBe(true);
  expect(requested.searchFailed).toBe(false);
  const received = search(requested, {
    type: "SEARCH_GET_RECEIVE",
    query: { ...query, filters: { collection: ["one"] } },
    searchResults: { ...response, pageSize },
    receivedAt: 2,
  });
  expect(received.currentResults?.pages).toBe(pageSize === 0 ? 0 : 3);
  expect(received.isSearchInProgress).toBe(false);
});

it("retains current results when an older query completes", () => {
  const currentResults = { ...response, pages: 3 };
  const received = search(
    {
      ...initial,
      currentQuery: query,
      currentResults,
      isSearchInProgress: true,
    },
    {
      type: "SEARCH_GET_RECEIVE",
      query: { ...query, filters: { collection: ["two"] } },
      searchResults: { ...response, hits: 0 },
      receivedAt: 2,
    },
  );
  expect(received.currentResults).toBe(currentResults);
  // Preserve the existing completion behavior even for a stale response.
  expect(received.isSearchInProgress).toBe(false);
});

it("preserves failure, clear and suggested-field state transitions", () => {
  const fields = search(initial, {
    type: "SUGGESTED_FIELDS_GET_RECEIVE",
    fields: [{ name: "Text", type: "text" }],
    receivedAt: 1,
  });
  const failed = search(
    {
      ...fields,
      currentQuery: query,
      currentResults: { ...response, pages: 3 },
    },
    { type: "SEARCH_FAILURE", receivedAt: 2 },
  );
  expect(failed.searchFailed).toBe(true);
  expect(failed.currentResults).toBeUndefined();
  expect(failed.currentQuery).toEqual(query);
  const cleared = search(failed, { type: "SEARCH_CLEAR", receivedAt: 3 });
  expect(cleared.currentQuery).toBeUndefined();
  expect(cleared.suggestedFields).toEqual(fields.suggestedFields);
  expect(cleared.searchFailed).toBe(true);
});
