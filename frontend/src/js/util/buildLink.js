import {objectToParamString} from './UrlParameters';

// Build a URL but keep search text, page, sort-by and filters unless they are set in overrides
export default function buildLink(to, urlParams, overrides) {
    const params = Object.assign({}, overrides);
    const encodedUri = encodeURI(to);

    Object.keys(params).forEach(k => {
        if(params[k] === null)
            delete params[k];
    });

    if(!params.q && urlParams.q) {
        params.q = urlParams.q;
    }

    if(!params.sortBy && urlParams.sortBy) {
        params.sortBy = urlParams.sortBy;
    }

    if(!params.page && urlParams.page) {
        params.page = urlParams.page;
    }

    if(!params.filters && urlParams.filters) {
        params.filters = urlParams.filters;
    }

    if(!params.details && urlParams.details) {
        params.details = urlParams.details;
    }

    if(!params.view && urlParams.view) {
        params.view = urlParams.view;
    }

    return params ? `${encodedUri}?${objectToParamString(params)}` : encodedUri;
}
