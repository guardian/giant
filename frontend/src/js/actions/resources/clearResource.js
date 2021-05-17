export function clearResource() {
    return dispatch => {
        dispatch(() => ({
            type:        'RESOURCE_CLEAR',
            receivedAt:  Date.now()
        }));
    };
}
