import * as R from 'ramda';

export default function collections(state = [], action) {
    switch (action.type) {
        case 'COLLECTIONS_GET_RECEIVE':
            return action.collections;

        case 'COLLECTION_GET_RECEIVE': {
            const currentIndex = state.findIndex(c => c.uri === action.collection.uri);

            if (currentIndex !== -1) {
                return R.update(currentIndex, action.collection, state);
            }

            return state.concat(action.collection);
        }

        default:
            return state;
    }
}
