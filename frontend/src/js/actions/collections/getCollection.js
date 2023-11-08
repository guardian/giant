import { reprocessBlob } from '../../services/BlobApi';
import {fetchCollection} from '../../services/CollectionsApi';
import { fetchResource } from '../../services/ResourceApi';
import { getBasicResource } from '../resources/getResource';

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

export function reprocessCollectionResource(uri, collectionUri) {
    return dispatch => {
        return fetchResource(uri, true)
        .then(res => {
            const uri = res.children[0].uri;
            console.log("res: ");
            console.log(res);
            reprocessBlob(uri)            
                .then(() => dispatch(getBasicResource(collectionUri)))
                .catch(error => dispatch(errorReprocessingBlob(error)));
        })
    }
}


function errorReprocessingBlob(error) {
    return {
        type:        'APP_SHOW_ERROR',
        message:     'Failed to start reprocessing',
        error:       error,
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
