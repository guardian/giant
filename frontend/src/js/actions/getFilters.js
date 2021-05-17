import {fetchFilters} from '../services/FiltersApi';

export function getFilters() {
    return dispatch => {
        dispatch(requestFilters());
        return fetchFilters()
            .then(res => {
                dispatch(recieveFilters(res));
            })
            .catch(error => dispatch(errorReceivingFilters(error)));
    };
}

function requestFilters() {
    return {
        type:       'FILTERS_GET_REQUEST',
        receivedAt: Date.now()
    };
}

function recieveFilters(filters) {
    return {
        type:        'FILTERS_GET_RECEIVE',
        filters:     filters,
        receivedAt:  Date.now()
    };
}

function errorReceivingFilters(error) {
    return {
        type:        'APP_SHOW_ERROR',
        message:     'Failed to get filters',
        error:       error,
        receivedAt:  Date.now()
    };
}
