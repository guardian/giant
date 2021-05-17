import { HighlightsState } from '../types/redux/GiantState';
import { HighlightsAction, HighlightsActionType } from '../types/redux/GiantActions';
import { cloneDeep, set } from 'lodash';


export default function highlights(state: HighlightsState = {}, action: HighlightsAction): HighlightsState {
    if (action.type === HighlightsActionType.UPDATE_HIGHLIGHTS) {
        // This bypasses type-safety, but it's convenient to do it like this because
        // of the indeterminate structure of the highlights object (the ocr object may
        // contain a variable set of languages).
        // Worth considering if we can can tighten it up, but not much point
        // until we convert Viewer.js etc to TypeScript.
        const key = `${action.resourceUri}-${action.searchQuery}`;
        const newState = cloneDeep(state);
        const resourceQueryState = newState[key] || {};
        set(resourceQueryState, action.view, {currentHighlight: action.currentHighlight});
        newState[key] = resourceQueryState;
        return newState;
    }

    return state;
}
