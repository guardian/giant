import { ExpandedFiltersAction } from '../types/redux/GiantActions';
import { ExpandedFiltersState } from '../types/redux/GiantState';

export default function expandedFilters(state: ExpandedFiltersState = {}, action: ExpandedFiltersAction): ExpandedFiltersState {
    switch (action.type) {
        case 'SET_FILTER_EXPANSION_STATE':
            return { ...state, ...{ [action.key]: action.isExpanded }};

        default:
            return state;
    }
}
