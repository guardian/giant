import { CollectionAction, CollectionActionType } from '../types/redux/GiantActions';
import { CollectionsState } from '../types/redux/GiantState';

export default function collectionsState(
    state: CollectionsState = {
        collectionSelectedEntries: [],
        collectionFocusedEntry: null
    },
    action: CollectionAction
): CollectionsState {
    switch (action.type) {

        case CollectionActionType.COLLECTION_SET_SELECTED_ENTRIES:
            return { ...state, collectionSelectedEntries: action.entries };

        case CollectionActionType.COLLECTION_SET_FOCUSED_ENTRY:
            return { ...state, collectionFocusedEntry: action.entry };

        default:
            return state;
    }
}

