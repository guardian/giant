import {combineReducers} from 'redux';
import { connectRouter } from 'connected-react-router';
import collections from './collectionsReducer';
import filters from './filtersReducer';
import urlParams from './urlParamsReducer';
import search from './searchReducer';
import resource from './resourceReducer';
import metrics from './metricsReducer';
import cluster from './clusterReducer';
import app from './appReducer';
import auth from './authReducer';
import users from './usersReducer';
import emails from './emailsReducer';
import workspaces from './workspacesReducer';
import descendantResources from './descendantResourcesReducer';
import highlights from './highlightsReducer';
import expandedFilters from './expandedFiltersReducer';
import isLoadingResource from './isLoadingResourceReducer';
import pages from './pagesReducer';

export default (history) => combineReducers({
    collections,
    filters,
    urlParams,
    search,
    router: connectRouter(history),
    resource,
    descendantResources,
    metrics,
    cluster,
    app,
    auth,
    users,
    emails,
    workspaces,
    highlights,
    expandedFilters,
    isLoadingResource,
    pages
});
