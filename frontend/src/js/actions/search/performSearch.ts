import { GiantDispatch } from "../../types/redux/GiantDispatch";
import { SearchAction } from "../../types/redux/GiantActions";
import {
  SearchQuery,
  parseSearchQueryFragments,
} from "../../types/SearchQuery";
import { SearchResponse } from "../../types/SearchResults";
import { performSearch as performSearchService } from "../../services/SearchApi";

export function performSearch(searchQuery: SearchQuery) {
  return async (dispatch: GiantDispatch) => {
    let query: SearchQuery;
    try {
      query = {
        ...searchQuery,
        fragments: parseSearchQueryFragments(searchQuery.q),
      };
    } catch {
      // Preserve request/failure dispatches even when parsing fails before fetch.
      dispatch(requestSearch(searchQuery));
      dispatch(errorReceivingSearch());
      return;
    }
    dispatch(requestSearch(query));
    try {
      const res = await performSearchService(query);
      dispatch(receiveSearch(res, query));
    } catch {
      dispatch(errorReceivingSearch());
    }
  };
}

function requestSearch(searchQuery: SearchQuery): SearchAction {
  return {
    type: "SEARCH_GET_REQUEST",
    query: searchQuery,
    receivedAt: Date.now(),
  };
}

function receiveSearch(
  searchResults: SearchResponse,
  searchQuery: SearchQuery,
): SearchAction {
  return {
    type: "SEARCH_GET_RECEIVE",
    searchResults: searchResults,
    query: searchQuery,
    receivedAt: Date.now(),
  };
}

function errorReceivingSearch(): SearchAction {
  return {
    type: "SEARCH_FAILURE",
    receivedAt: Date.now(),
  };
}
