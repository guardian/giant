import {genesisSetupCheckApi} from '../../services/UserApi';

export function setupCheck() {
    return dispatch => {
        dispatch(requestSetupCheck());
        return genesisSetupCheckApi()
            .then(res => {
                dispatch(receiveSetupCheck(res));
            })
            .catch(error => dispatch(errorReceivingSetupCheck(error)));
    };
}

function requestSetupCheck() {
    return {
        type:       'GENESIS_SETUP_CHECK_REQUEST',
        receivedAt: Date.now()
    };
}

function receiveSetupCheck(res) {
    return {
        type:          'GENESIS_SETUP_CHECK_RECEIVE',
        setupComplete: res.setupComplete,
        receivedAt:    Date.now()
    };
}

function errorReceivingSetupCheck(error) {
    return {
        type:        'GENESIS_SETUP_CHECK_ERROR',
        message:     'Failed to check genesis state',
        error:       error,
        receivedAt:  Date.now()
    };
}
