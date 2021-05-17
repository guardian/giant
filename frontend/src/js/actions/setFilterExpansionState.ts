import { ExpandedFiltersActionType, ExpandedFiltersAction } from '../types/redux/GiantActions';

export function setFilterExpansionState(key: string, isExpanded: boolean): ExpandedFiltersAction {
    return {
        type: ExpandedFiltersActionType.SET_FILTER_EXPANSION_STATE,
        key,
        isExpanded
    }
}

