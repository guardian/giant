import {
    genesisSetupInitialDatabaseUserApi,
    genesisSetupInitialPandaUserApi
} from '../../services/UserApi';

export function createDatabaseProviderGenesisUser(username, displayName, password, totpActivation) {
    return dispatch => {
        dispatch(requestCreateGenesisUser(username));
        return genesisSetupInitialDatabaseUserApi(username, displayName, password, totpActivation)
            .then(res => {
                dispatch(receiveCreateGenesisUser(res.username));
            })
            .catch(error => dispatch(errorReceivingCreateGenesisUser(error, username)));
    };
}

export function createPandaProviderGenesisUser(email) {
    return dispatch => {
        dispatch(requestCreateGenesisUser(email));
        return genesisSetupInitialPandaUserApi(email)
            .then(res => {
                dispatch(receiveCreateGenesisUser(res.username));
            })
            .catch(error => dispatch(errorReceivingCreateGenesisUser(error, email)));
    };
}

function requestCreateGenesisUser(username) {
    return {
        type:       'GENESIS_CREATE_USER_REQUEST',
        username:   username,
        receivedAt: Date.now()
    };
}

function receiveCreateGenesisUser(username) {
    return {
        type:          'GENESIS_CREATE_USER_RECEIVE',
        username:      username,
        receivedAt:    Date.now()
    };
}

function errorReceivingCreateGenesisUser(error, username) {
    return {
        type:        'GENESIS_CREATE_USER_ERROR',
        message:     `Failed to create genesis user ${username}`,
        error:       error,
        receivedAt:  Date.now()
    };
}
