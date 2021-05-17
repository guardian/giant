import { UrlParamsAction, UrlParamsActionType } from '../../types/redux/GiantActions';

export function setResourceView(view: any): UrlParamsAction {
    return {
        type: UrlParamsActionType.SET_RESOURCE_VIEW,
        view,
    };
}

export function setDetailsView(view: any): UrlParamsAction {
    return {
        type: UrlParamsActionType.SET_DETAILS_VIEW,
        view,
    };
}
