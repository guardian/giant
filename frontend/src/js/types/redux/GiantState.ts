import { WorkspaceMetadata, WorkspaceEntry, Workspace } from '../Workspaces';
import { TreeEntry, TreeNode } from '../Tree';
import { MimeTypeCoverage } from '../MimeType';
import { ExtractionFailures } from '../ExtractionFailures';
import { Collection } from '../Collection';
import { Auth } from '../Auth';
import { Config } from '../Config';
import { Resource, BasicResource } from '../Resource';
import { SearchResults } from '../SearchResults';
import { PagedDocument } from '../../reducers/pagesReducer';

export interface WorkspacesState {
    workspacesMetadata: WorkspaceMetadata[],
    currentWorkspace: Workspace | null,
    selectedEntries: TreeEntry<WorkspaceEntry>[],
    focusedEntry: TreeEntry<WorkspaceEntry> | null,
    expandedNodes: TreeNode<WorkspaceEntry>[],
    entryBeingRenamed: TreeEntry<WorkspaceEntry> | null;
}

export interface MetricsState {
    coverage: MimeTypeCoverage[] | null,
    extractionFailures: ExtractionFailures | null,
}

export interface HighlightsViewState {
    [view: string]: {
        currentHighlight: number
    },
}

export interface HighlightsState {
    [resourceIdAndSearchQuery: string]: HighlightsViewState
}

export interface UrlParamsState {
    filters?: object,
    q: string,
    view?: string,
    details?: object,
    page?: string,
    pageSize?: number,
    sortBy?: string,
    highlight?: string,
}

export type ExpandedFiltersState = { [key: string]: boolean }

export type DescendantResources = { [key: string]: BasicResource }

export type SearchState = {
    // TODO: type the rest of search state
    currentResults?: SearchResults,
    currentQuery?: { q: string },
    isSearchInProgress: boolean
}

export type LoadingState = boolean

export type PagesState = {
    doc?: PagedDocument,
    currentHighlightId?: string,
    // TODO: | undefined?
    mountedHighlightElements: { [id: string]: HTMLElement }
}

// Once all reducers are typed, we should be able to infer this type, à la:
// https://github.com/guardian/facia-tool/blob/master/client-v2/src/types/State.ts
export interface GiantState {
    workspaces: WorkspacesState,
    metrics: MetricsState,
    auth: Auth,
    users: any,
    highlights: HighlightsState,
    collections: Collection[],
    app: {
      config: Config,
      preferences: any
    },
    expandedFiltersState: { [key: string]: boolean },
    resource: Resource | null,
    descendantResources: DescendantResources,
    urlParams: UrlParamsState,
    search: SearchState,
    isLoadingResource: LoadingState,
    pages: PagesState
}
