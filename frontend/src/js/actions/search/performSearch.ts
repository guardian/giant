import { GiantDispatch } from "../../types/redux/GiantDispatch";
import { SearchAction } from "../../types/redux/GiantActions";
import { SearchQuery } from "../../types/SearchQuery";
import { SearchResponse } from "../../types/SearchResults";
import { performSearch as performSearchService } from "../../services/SearchApi";

export function performSearch(searchQuery: SearchQuery) {
  return async (dispatch: GiantDispatch) => {
    dispatch(requestSearch(searchQuery));
    try {
      const res = await performSearchService(searchQuery);
      dispatch(receiveSearch(res, searchQuery));
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
