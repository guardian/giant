export default function users(state = {
    genesisSetupComplete: true,
    genesisSetupRequesting: false,
    errors: [],
    userList: [],
    creatingUser: false,
    createUserErrors: [],
    myPermissions: []
}, action) {
    switch (action.type) {
        case 'GENESIS_SETUP_CHECK_RECEIVE':
            return Object.assign({}, state, {
                genesisSetupComplete: action.setupComplete
            });

        case 'GENESIS_CREATE_USER_REQUEST':
            return Object.assign({}, state, {
                genesisSetupRequesting: true
            });

        case 'GENESIS_CREATE_USER_RECEIVE':
            return Object.assign({}, state, {
                genesisSetupComplete: true,
                genesisSetupRequesting: false
            });

        case 'GENESIS_CREATE_USER_ERROR':
            return Object.assign({}, state, {
                genesisSetupRequesting: false,
                errors: [action.message]
            });

        case 'LIST_USERS_RECEIVE':
            return Object.assign({}, state, {
                userList: action.users
            });

        case 'LIST_USERS_ERROR':
            return Object.assign({}, state, {
                errors: [action.message]
            });

        case 'CREATE_USER_REQUEST':
            return Object.assign({}, state, {
                creatingUser: true,
                createUserErrors: []
            });

        case 'CREATE_USER_RECEIVE':
            return Object.assign({}, state, {
                creatingUser: false
            });

        case 'CREATE_USER_ERROR':
            return Object.assign({}, state, {
                creatingUser: false,
                createUserErrors: [action.message]
            });

        case 'GET_MY_PERMISSIONS_RECEIVE':
            return Object.assign({}, state, {
                myPermissions: action.permissions
            });

        case 'AUTH_TOKEN_INVALIDATION_RECEIVE':
        case 'AUTH_FETCH_UNAUTHORISED':
        case 'AUTH_TOKEN_INVALIDATION_ERROR':
            return Object.assign({}, state, {
                // actions are still validated on the server side
                myPermissions: []
            });

        default:
            return state;
    }
}
