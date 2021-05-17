import { MetricsState } from '../types/redux/GiantState';
import { MetricsAction, MetricsActionType } from '../types/redux/GiantActions';

export default function metrics(state = {
    coverage: null,
    extractionFailures: null
}, action: MetricsAction): MetricsState {
    switch (action.type) {
        case MetricsActionType.MIMETYPE_COVERAGE_GET_RECEIVE:
            return {
                ...state,
                coverage: action.mimetypeCoverage
            };

        case MetricsActionType.EXTRACTION_FAILURES_GET_RECEIVE:
            return {
                ...state,
                extractionFailures: action.extractionFailures
            };
        default:
            return state;
    }
}
