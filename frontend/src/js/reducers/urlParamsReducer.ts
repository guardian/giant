import { UrlParamsState } from '../types/redux/GiantState';
import { UrlParamsAction, UrlParamsActionType } from '../types/redux/GiantActions';

export default function urlParams(state = {
    filters: undefined,
    q: '',
    view: undefined,
    details: undefined,
    page: undefined,
    pageSize: undefined,
    sortBy: undefined,
    highlight: undefined,
    currentWorkspace: undefined,
    currentCollection: undefined,
    currentIngestion: undefined
}, action: UrlParamsAction): UrlParamsState {
    switch (action.type) {
        case UrlParamsActionType.SEARCHQUERY_FILTERS_UPDATE:
            return {
                ...state,
                filters: action.filters
            };

        case UrlParamsActionType.SEARCHQUERY_TEXT_UPDATE:
            return {
                ...state,
                q: action.text
            };

        case UrlParamsActionType.SEARCHQUERY_PAGE_UPDATE:
            return {
                ...state,
                page: action.page
            };

        case UrlParamsActionType.SEARCHQUERY_PAGE_SIZE_UPDATE:
            return {
                ...state,
                pageSize: action.pageSize
            };

        case UrlParamsActionType.SEARCHQUERY_SORT_BY_UPDATE:
            return {
                ...state,
                sortBy: action.sortBy
            };

        case UrlParamsActionType.SET_RESOURCE_VIEW:
            return {
                ...state,
                view: action.view
            };

        case UrlParamsActionType.SET_DETAILS_VIEW:
            return {
                ...state,
                details: action.view
            };

        case UrlParamsActionType.SET_CURRENT_HIGHLIGHT_IN_URL:
            return {
                ...state,
                highlight: action.highlight
            };
        case UrlParamsActionType.SET_INGESTION_EVENTS_WORKSPACE_IN_URL:
            return {
                ...state,
                currentWorkspace: action.currentWorkspace
            }
        case UrlParamsActionType.SET_INGESTION_EVENTS_COLLECTION_IN_URL:
            return {
                ...state,
                currentCollection: action.currentCollection
            }
        case UrlParamsActionType.SET_INGESTION_EVENTS_INGESTION_IN_URL:
            return {
                ...state,
                currentIngestion: action.currentIngestion
            }

        case UrlParamsActionType.URLPARAMS_UPDATE:
            return {
                ...action.query,
                // A few fields we want to retain at all times so the user can get their search back
                q: action.query.q || state.q,
                filters: action.query.filters || state.filters,
                page: action.query.page || state.page,
                sortBy: action.query.sortBy || state.sortBy,
            };

        default:
            return state;
    }
}
