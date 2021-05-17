export function clearSearch() {
    return dispatch => {
        dispatch({
            type:       'SEARCH_CLEAR',
            receivedAt: Date.now()
        });
    };
}
