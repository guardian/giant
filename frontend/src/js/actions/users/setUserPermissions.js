import {setUserPermissionsApi} from '../../services/UserApi';
import {listUsers} from './listUsers';

export function setUserPermissions(username, granted) {
    return dispatch => {
        return setUserPermissionsApi(username, granted)
            .then(() => {
                listUsers()(dispatch);
            })
            .catch(error => dispatch(errorSetUserPermissions(username, error)));
    };
}

function errorSetUserPermissions(error, username) {
    return {
        type:        'APP_SHOW_ERROR',
        message:     `Failed to set permissions for user ${username}`,
        error:       error,
        receivedAt:  Date.now()
    };
}
