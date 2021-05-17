import {fetchCollections} from '../../services/CollectionsApi';

export function getCollections() {
    return dispatch => {
        dispatch(requestCollections());
        return fetchCollections()
            .then(res => {
                dispatch(receiveCollections(res));
            })
            .catch(error => dispatch(errorReceivingCollections(error)));
    };
}

export function requestCollections() {
    return {
        type:       'COLLECTIONS_GET_REQUEST',
        receivedAt: Date.now()
    };
}

export function receiveCollections(collections) {
    return {
        type:        'COLLECTIONS_GET_RECEIVE',
        collections: collections,
        receivedAt:  Date.now()
    };
}

export function errorReceivingCollections(error) {
    return {
        type:        'APP_SHOW_ERROR',
        message:     'Failed to get collections',
        error:       error,
        receivedAt:  Date.now()
    };
}
