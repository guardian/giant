import {performSearch as performSearchService} from '../../services/SearchApi';

export function performSearch(searchQuery) {
    return async dispatch => {
        dispatch(requestSearch(searchQuery));
        try {
            const res = await performSearchService(searchQuery);
            dispatch(receiveSearch(res, searchQuery));
        } catch (err) {
            dispatch(errorReceivingSearch());
        }
    };
}

function requestSearch(searchQuery) {
    return {
        type:       'SEARCH_GET_REQUEST',
        query:      searchQuery,
        receivedAt: Date.now()
    };
}

function receiveSearch(searchResults, searchQuery) {
    return {
        type:           'SEARCH_GET_RECEIVE',
        searchResults:  searchResults,
        query:          searchQuery,
        receivedAt:     Date.now()
    };
}

function errorReceivingSearch() {
    return {
        type:        'SEARCH_FAILURE',
        receivedAt:  Date.now()
    };
}
