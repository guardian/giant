import { UrlParamsActionType } from "../../types/redux/GiantActions"

export function updateCurrentCollection(currentCollection: string) {
    return {
        type: UrlParamsActionType.SET_INGESTION_EVENTS_COLLECTION_IN_URL,
        currentCollection,
    }
}
