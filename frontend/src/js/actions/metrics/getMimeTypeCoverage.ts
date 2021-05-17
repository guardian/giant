import { fetchMimeTypeCoverage } from '../../services/MetricsApi';
import { ThunkAction } from 'redux-thunk';
import { GiantState } from '../../types/redux/GiantState';
import { AppAction, AppActionType, MetricsAction, MetricsActionType } from '../../types/redux/GiantActions';
import { MimeTypeCoverage } from '../../types/MimeType';

export function getMimeTypeCoverage(): ThunkAction<void, GiantState, null, MetricsAction | AppAction> {
    return dispatch => {
        return fetchMimeTypeCoverage()
            .then(res => {
                dispatch(receiveMimeTypeCoverage(res));
            })
            .catch(error => dispatch(errorReceivingMimeTypeCoverage(error)));
    };
}

function receiveMimeTypeCoverage(coverage: MimeTypeCoverage[]): MetricsAction {
    return {
        type:               MetricsActionType.MIMETYPE_COVERAGE_GET_RECEIVE,
        mimetypeCoverage:   coverage,
    };
}

function errorReceivingMimeTypeCoverage(error: Error): AppAction {
    return {
        type:        AppActionType.APP_SHOW_ERROR,
        message:     'Failed to get mimetypeCoverage',
        error:       error,
    };
}
