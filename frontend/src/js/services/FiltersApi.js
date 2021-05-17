import authFetch from '../util/auth/authFetch';

export function fetchFilters() {
    return authFetch('/api/filters').then(res => res.json());
}
