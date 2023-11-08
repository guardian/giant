import { BasicResource } from "../../types/Resource";
import { TreeEntry } from "../../types/Tree";
import { CollectionAction, CollectionActionType } from "../../types/redux/GiantActions";

export function setCollectionSelectedEntries(entries: TreeEntry<BasicResource>[]): CollectionAction {
    return {
        type: CollectionActionType.COLLECTION_SET_SELECTED_ENTRIES,
        entries
    }
}

export function setCollectionFocusedEntry(entry: TreeEntry<BasicResource> | null): CollectionAction {
    return {
        type: CollectionActionType.COLLECTION_SET_FOCUSED_ENTRY,
        entry
    }
}