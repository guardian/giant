import { UrlParamsAction, UrlParamsActionType } from '../../types/redux/GiantActions';

export function setCurrentHighlightInUrl(highlight: string): UrlParamsAction {
    return {
        type: UrlParamsActionType.SET_CURRENT_HIGHLIGHT_IN_URL,
        highlight,
    };
}

