import { UrlParamsActionType } from "../../types/redux/GiantActions";

export function updateCurrentWorkspace(currentWorkspace: string) {
  return {
    type: UrlParamsActionType.SET_INGESTION_EVENTS_WORKSPACE_IN_URL,
    currentWorkspace,
  };
}
