import authFetch from '../util/auth/authFetch';
import {objectToParamString} from '../util/UrlParameters';
import _isObject from 'lodash/isObject';
import {parseDate} from '../util/parseDate';

export function getSuggestedFields() {
    return authFetch('/api/search/fields').then(res => res.json());
}

function transformQuery(q) {
    return q.map(fragment => {
        if (_isObject(fragment)) {
            if (fragment.t === 'date') {
                const parsed = parseDate(fragment.v, 'from_start');
                if (parsed) {
                    return Object.assign({}, fragment, {v: parsed.toString()});
                } else {
                    // If the date chip is invalid just ignore it
                    return '';
                }
            } else if (fragment.t === 'date_ex') {
                const parsed = parseDate(fragment.v, 'from_end');
                if (parsed) {
                    return Object.assign({}, fragment, {v: parsed.toString()});
                } else {
                    // If the date chip is invalid just ignore it
                    return '';
                }
            }
        }

        return fragment;
    });
}

export function performSearch(searchQuery) {
    const queryString = JSON.stringify(transformQuery(JSON.parse(searchQuery.q)));

    const queryObject = Object.assign({}, searchQuery.filters, {
        q: queryString,
        page: searchQuery.page ? searchQuery.page : 1,
        // TODO replace with user preferences for page size
        pageSize: searchQuery.pageSize ? searchQuery.pageSize : 100,
        // TODO replace with user preferences for sort by
        sortBy: searchQuery.sortBy ? searchQuery.sortBy : 'relevance'
    });

    return authFetch(`/api/search?${objectToParamString(queryObject)}`)
        .then(res => res.json());
}