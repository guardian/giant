import { fetchExtractionFailures } from "../../services/MetricsApi";
import { ThunkAction } from "redux-thunk";
import { GiantState } from "../../types/redux/GiantState";
import {
  AppAction,
  AppActionType,
  MetricsAction,
  MetricsActionType,
} from "../../types/redux/GiantActions";
import { ExtractionFailures } from "../../types/ExtractionFailures";

export function getExtractionFailures(): ThunkAction<
  void,
  GiantState,
  null,
  MetricsAction | AppAction
> {
  return (dispatch) => {
    return fetchExtractionFailures()
      .then((res) => {
        dispatch(recieveExtractionFailures(res));
      })
      .catch((error) => dispatch(errorReceivingExtractionFailures(error)));
  };
}

function recieveExtractionFailures(
  extractionFailures: ExtractionFailures,
): MetricsAction {
  return {
    type: MetricsActionType.EXTRACTION_FAILURES_GET_RECEIVE,
    extractionFailures: extractionFailures,
  };
}

function errorReceivingExtractionFailures(error: Error): AppAction {
  return {
    type: AppActionType.APP_SHOW_ERROR,
    message: "Failed to get extraction failures",
    error: error,
  };
}
