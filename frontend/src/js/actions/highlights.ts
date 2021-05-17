import { HighlightsAction, HighlightsActionType } from '../types/redux/GiantActions';

export function setCurrentHighlight(
    resourceUri: string,
    searchQuery: string,
    view: string,
    currentHighlight: number,
): HighlightsAction {
    return {
        type: HighlightsActionType.UPDATE_HIGHLIGHTS,
        resourceUri,
        searchQuery,
        view,
        currentHighlight
    };
}
