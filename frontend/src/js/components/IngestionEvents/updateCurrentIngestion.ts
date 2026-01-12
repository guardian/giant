import { UrlParamsActionType } from "../../types/redux/GiantActions";

export function updateCurrentIngestion(currentIngestion: string) {
  return {
    type: UrlParamsActionType.SET_INGESTION_EVENTS_INGESTION_IN_URL,
    currentIngestion,
  };
}
