import store from '../store';
import { receiveToken } from '../../actions/auth/getAuthToken';

export function logOutTheUserLocally() {
    store.dispatch({
        type:        'AUTH_FETCH_UNAUTHORISED',
        receivedAt:  Date.now()
    });
    localStorage.removeItem('pfiAuthHeader');
}

export function handleResponseFromAuthRequest(
    responseStatus: number,
    offerAuthorizationHeader: null | string
): void {
    if (offerAuthorizationHeader) {
        localStorage.pfiAuthHeader = offerAuthorizationHeader;
        store.dispatch(receiveToken(offerAuthorizationHeader));
    }
    // logout the user if they receive an unauthorised status code from any endpoint
    if (responseStatus === 401) {
        logOutTheUserLocally();
    }
}
