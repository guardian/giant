import * as R from 'ramda';

export default function app(state = {
    config: {},
    preferences: {},
    errors: [],
    warnings: []
}, action) {
    switch (action.type) {
        case 'APP_CLEAR_ERRORS':
            return Object.assign({}, state, {
                errors: []
            });

        case 'APP_CLEAR_WARNINGS':
            return Object.assign({}, state, {
                warnings: []
            });

        case 'APP_CLEAR_ERROR':
            return Object.assign({}, state, {
                errors: R.remove(action.index, 1, state.errors)
            });

        case 'APP_CLEAR_WARNING':
            return Object.assign({}, state, {
                warnings: R.remove(action.index, 1, state.warnings)
            });

        case 'APP_SHOW_ERROR':
            console.error(action.error);
            return Object.assign({}, state, {
                errors: R.append(action.message, state.errors)
            });

        case 'APP_SHOW_WARNING':
            return Object.assign({}, state, {
                warnings: R.append(action.message, state.warnings)
            });

        case 'APP_SET_CONFIG':
            return Object.assign({}, state, {
                config: action.config
            });

        case 'APP_SET_PREFERENCES':
            return Object.assign({},
                state,
                {preferences: action.preferences}
            );

        default:
            return state;
    }
}
