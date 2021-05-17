import {getMyPermissions as fetchMyPermissions} from '../../services/UserApi';

export function getMyPermissions() {
    return dispatch => {
        return fetchMyPermissions()
            .then(res => {
                dispatch(receiveMyPermissions(res.granted));
            })
            .catch(error => dispatch(errorReceivingMyPermissions(error)));
    };
}

function receiveMyPermissions(permissions) {
    return {
        type: 'GET_MY_PERMISSIONS_RECEIVE',
        permissions: permissions,
        receivedAt: Date.now()
    };
}

function errorReceivingMyPermissions(error) {
    return {
        type:        'LIST_USERS_ERROR',
        message:     'Failed to get permissions',
        error:       error,
        receivedAt:  Date.now()
    };
}
