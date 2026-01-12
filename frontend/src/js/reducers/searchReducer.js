import _isEqual from "lodash/isEqual";

function handleSearchResults(action, state) {
  if (_isEqual(action.query, state.currentQuery)) {
    const { hits, pageSize } = action.searchResults;
    const pages = pageSize === 0 ? 0 : Math.ceil(hits / pageSize);

    return Object.assign({}, action.searchResults, { pages });
  } else {
    return state.currentResults;
  }
}

export default function search(
  state = {
    currentQuery: undefined,
    currentResults: undefined,
    isSearchInProgress: false,
    suggestedFields: [],
    searchFailed: undefined,
  },
  action,
) {
  switch (action.type) {
    case "SEARCH_GET_REQUEST":
      return Object.assign({}, state, {
        isSearchInProgress: true,
        currentQuery: action.query,
        searchFailed: false,
      });

    case "SEARCH_GET_RECEIVE":
      return Object.assign({}, state, {
        currentResults: handleSearchResults(action, state),
        isSearchInProgress: false,
      });

    case "SEARCH_CLEAR":
      return Object.assign({}, state, {
        currentQuery: undefined,
        currentResults: undefined,
        isSearchInProgress: false,
      });

    case "SEARCH_FAILURE":
      return Object.assign({}, state, {
        currentResults: undefined,
        isSearchInProgress: false,
        searchFailed: true,
      });

    case "SUGGESTED_FIELDS_GET_RECEIVE": {
      return Object.assign({}, state, {
        suggestedFields: action.fields,
      });
    }

    default:
      return state;
  }
}
