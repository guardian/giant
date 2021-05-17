import { UrlParamsAction, UrlParamsActionType } from '../../types/redux/GiantActions';

export function updateSearchQueryFilters(filters: object): UrlParamsAction {
    return {
        type:        UrlParamsActionType.SEARCHQUERY_FILTERS_UPDATE,
        filters:     filters,
    };
}

export function updateSearchText(text: string): UrlParamsAction {
    return {
        type:       UrlParamsActionType.SEARCHQUERY_TEXT_UPDATE,
        text:       text,
    };
}

export function updatePage(page: number): UrlParamsAction {
    return {
        type:       UrlParamsActionType.SEARCHQUERY_PAGE_UPDATE,
        page:       page,
    };
}

export function updatePageSize(pageSize: number): UrlParamsAction {
    return {
        type:       UrlParamsActionType.SEARCHQUERY_PAGE_SIZE_UPDATE,
        pageSize:   pageSize,
    };
}

export function updateSortBy(sortBy: string): UrlParamsAction {
    return {
        type:       UrlParamsActionType.SEARCHQUERY_SORT_BY_UPDATE,
        sortBy:     sortBy,
    };
}

export function updateUrlParams(query: any): UrlParamsAction {
    return {
        type:       UrlParamsActionType.URLPARAMS_UPDATE,
        query
    }
}
