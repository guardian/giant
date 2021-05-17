import {fetchCollection} from '../../services/CollectionsApi';

export function getCollection(uri) {
    return dispatch => {
        dispatch(requestCollection(uri));
        return fetchCollection(uri)
            .then(res => {
                if(!res) {
                    dispatch(errorReceivingCollection('Collection does not exist', uri));
                } else {
                    dispatch(receiveCollection(res));
                }
            })
            .catch(error => dispatch(errorReceivingCollection(error, uri)));
    };
}

function requestCollection(uri) {
    return {
        type:       'COLLECTION_GET_REQUEST',
        uri:        uri,
        receivedAt: Date.now()
    };
}

function receiveCollection(collection) {
    return {
        type:        'COLLECTION_GET_RECEIVE',
        collection:  collection,
        receivedAt:  Date.now()
    };
}

function errorReceivingCollection(error, uri) {
    return {
        type:        'APP_SHOW_ERROR',
        message:     `Failed to get collection: ${uri}`,
        error:       error,
        receivedAt:  Date.now()
    };
}
