import { TreeEntry, TreeNode } from '../Tree';
import { WorkspaceMetadata, WorkspaceEntry, Workspace } from '../Workspaces';
import { MimeTypeCoverage } from '../MimeType';
import { ExtractionFailures } from '../ExtractionFailures';
import { UrlParamsState } from './GiantState';
import { ResourceRange, CommentData, Resource } from '../Resource';
import { PagedDocument } from '../../reducers/pagesReducer';

export enum WorkspacesActionType {
    WORKSPACES_METADATA_GET_RECEIVE = 'WORKSPACES_METADATA_GET_RECEIVE',
    WORKSPACE_GET_RECEIVE = 'WORKSPACE_GET_RECEIVE',
    SET_SELECTED_ENTRIES = 'SET_SELECTED_ENTRIES',
    SET_FOCUSED_ENTRY = 'SET_FOCUSED_ENTRY',
    SET_ENTRY_BEING_RENAMED = 'SET_ENTRY_BEING_RENAMED',
    SET_NODE_AS_EXPANDED = 'SET_NODE_AS_EXPANDED',
    SET_NODE_AS_COLLAPSED = 'SET_NODE_AS_COLLAPSED',
}

interface TreeNodeAction {
    type: WorkspacesActionType.SET_NODE_AS_EXPANDED | WorkspacesActionType.SET_NODE_AS_COLLAPSED,
    node: TreeNode<WorkspaceEntry>,
}

interface SelectedEntriesAction {
    type: WorkspacesActionType.SET_SELECTED_ENTRIES,
    entries: TreeEntry<WorkspaceEntry>[]
}

interface FocusedEntryAction {
    type: WorkspacesActionType.SET_FOCUSED_ENTRY,
    entry: TreeEntry<WorkspaceEntry> | null
}

interface EntryBeingRenamedAction {
    type: WorkspacesActionType.SET_ENTRY_BEING_RENAMED,
    entry: TreeEntry<WorkspaceEntry> | null
}

interface ReceiveWorkspacesMetadataAction {
    type: WorkspacesActionType.WORKSPACES_METADATA_GET_RECEIVE,
    workspacesMetadata: WorkspaceMetadata[]
}

interface ReceiveWorkspaceAction {
    type: WorkspacesActionType.WORKSPACE_GET_RECEIVE,
    workspace: Workspace
}

export type WorkspacesAction =
    | TreeNodeAction
    | SelectedEntriesAction
    | FocusedEntryAction
    | EntryBeingRenamedAction
    | ReceiveWorkspacesMetadataAction
    | ReceiveWorkspaceAction

export enum AppActionType {
    APP_SHOW_ERROR = 'APP_SHOW_ERROR',
}

interface ErrorAction {
    type: AppActionType.APP_SHOW_ERROR,
    message: string,
    error: Error
}

// More types to come here, but this is the only one needed
// for the workspaces reducer which is all we've typed so far.
export type AppAction = ErrorAction

export enum MetricsActionType {
    MIMETYPE_COVERAGE_GET_RECEIVE = 'MIMETYPE_COVERAGE_GET_RECEIVE',
    EXTRACTION_FAILURES_GET_RECEIVE = 'EXTRACTION_FAILURES_GET_RECEIVE',
}

interface ReceiveMimeTypeCoverageAction {
    type: MetricsActionType.MIMETYPE_COVERAGE_GET_RECEIVE,
    mimetypeCoverage: MimeTypeCoverage[]
}

interface ReceiveExtractionFailuresAction {
    type: MetricsActionType.EXTRACTION_FAILURES_GET_RECEIVE,
    extractionFailures: ExtractionFailures
}

export type MetricsAction =
    | ReceiveMimeTypeCoverageAction
    | ReceiveExtractionFailuresAction

export enum UrlParamsActionType {
    SEARCHQUERY_FILTERS_UPDATE = 'SEARCHQUERY_FILTERS_UPDATE',
    SEARCHQUERY_TEXT_UPDATE = 'SEARCHQUERY_TEXT_UPDATE',
    SEARCHQUERY_PAGE_UPDATE = 'SEARCHQUERY_PAGE_UPDATE',
    SEARCHQUERY_PAGE_SIZE_UPDATE = 'SEARCHQUERY_PAGE_SIZE_UPDATE',
    SEARCHQUERY_SORT_BY_UPDATE = 'SEARCHQUERY_SORT_BY_UPDATE',
    SET_RESOURCE_VIEW = 'SET_RESOURCE_VIEW',
    SET_DETAILS_VIEW = 'SET_DETAILS_VIEW',
    SET_CURRENT_HIGHLIGHT_IN_URL = 'SET_CURRENT_HIGHLIGHT_IN_URL',
    URLPARAMS_UPDATE = 'URLPARAMS_UPDATE'
}

interface SearchQueryFiltersUpdateType {
    type: UrlParamsActionType.SEARCHQUERY_FILTERS_UPDATE,
    filters: any
}
interface SearchQueryTextUpdateType {
    type: UrlParamsActionType.SEARCHQUERY_TEXT_UPDATE,
    text: any
}
interface SearchQueryPageUpdateType {
    type: UrlParamsActionType.SEARCHQUERY_PAGE_UPDATE,
    page: any
}
interface SearchQueryPageSizeUpdateType {
    type: UrlParamsActionType.SEARCHQUERY_PAGE_SIZE_UPDATE,
    pageSize: any
}
interface SearchQuerySortByUpdateType {
    type: UrlParamsActionType.SEARCHQUERY_SORT_BY_UPDATE,
    sortBy: any
}
interface SetResourceViewType {
    type: UrlParamsActionType.SET_RESOURCE_VIEW,
    view: any
}
interface SetDetailsViewType {
    type: UrlParamsActionType.SET_DETAILS_VIEW,
    view: any
}
interface SetCurrentHighlightInUrl {
    type: UrlParamsActionType.SET_CURRENT_HIGHLIGHT_IN_URL,
    highlight: string
}
interface UrlParamsUpdateType {
    type: UrlParamsActionType.URLPARAMS_UPDATE,
    query: UrlParamsState
}

export enum HighlightsActionType {
    UPDATE_HIGHLIGHTS = 'UPDATE_HIGHLIGHTS',
}

export interface UpdateHighlightsAction {
    type: HighlightsActionType.UPDATE_HIGHLIGHTS,
    resourceUri: string,
    searchQuery: string,
    view: string,
    currentHighlight: number
}

export type HighlightsAction = UpdateHighlightsAction

export type UrlParamsAction =
    | SearchQueryFiltersUpdateType
    | SearchQueryTextUpdateType
    | SearchQueryPageUpdateType
    | SearchQueryPageSizeUpdateType
    | SearchQuerySortByUpdateType
    | SetResourceViewType
    | SetDetailsViewType
    | SetCurrentHighlightInUrl
    | UrlParamsUpdateType



export enum UserActionType {
    CREATE_USER_REQUEST = 'CREATE_USER_REQUEST',
    CREATE_USER_RECEIVE = 'CREATE_USER_RECEIVE',
    CREATE_USER_ERROR = 'CREATE_USER_ERROR',
    LIST_USERS_REQUEST = 'LIST_USERS_REQUEST',
    LIST_USERS_RECEIVE = 'LIST_USERS_RECEIVE',
    LIST_USERS_ERROR = 'LIST_USERS_ERROR',
}

interface RequestCreateUser {
    type: UserActionType.CREATE_USER_REQUEST,
    username: string,
    receivedAt: number
}

interface ReceiveCreateUser {
    type: UserActionType.CREATE_USER_RECEIVE,
    username: string,
    receivedAt: number
}

interface ErrorReceivingCreateUser {
    type: UserActionType.CREATE_USER_ERROR,
    message: string,
    error: string,
    receivedAt: number
}

interface RequestListUsers {
    type: UserActionType.LIST_USERS_REQUEST,
    receivedAt: number
}

interface ReceiveListUsers {
    type: UserActionType.LIST_USERS_RECEIVE,
    users: string[],
    receivedAt: number
}

interface ErrorReceivingListUsers {
    type: UserActionType.LIST_USERS_ERROR,
    message: string,
    error: string,
    receivedAt: number
}

export type UserAction =
    | RequestCreateUser
    | ReceiveCreateUser
    | ErrorReceivingCreateUser
    | RequestListUsers
    | ReceiveListUsers
    | ErrorReceivingListUsers

export enum ExpandedFiltersActionType {
    SET_FILTER_EXPANSION_STATE = 'SET_FILTER_EXPANSION_STATE'
}

interface SetFilterExpansionState {
    type: ExpandedFiltersActionType.SET_FILTER_EXPANSION_STATE,
    key: string,
    isExpanded: boolean
}

export type ExpandedFiltersAction = SetFilterExpansionState

export enum ResourceActionType {
    GET_RECEIVE = 'RESOURCE_GET_RECEIVE',
    RESET_RESOURCE = 'RESET_RESOURCE',
    SET_COMMENTS = 'RESOURCE_SET_COMMENTS',
    SET_SELECTION = 'RESOURCE_SET_SELECTION'
}

export type ResourceAction =
    | { type: ResourceActionType.GET_RECEIVE, resource: Resource }
    | { type: ResourceActionType.RESET_RESOURCE }
    | { type: ResourceActionType.SET_COMMENTS, comments: CommentData[] }
    | { type: ResourceActionType.SET_SELECTION, selection?: ResourceRange }

export enum LoadingStateActionType {
    SET_RESOURCE_LOADING_STATE = 'SET_RESOURCE_LOADING_STATE'
}

export type LoadingStateAction = {
        type: LoadingStateActionType.SET_RESOURCE_LOADING_STATE,
        isLoadingResource: boolean
}

export enum PagesActionType {
    SET_CURRENT_HIGHLIGHT_ID = 'SET_CURRENT_HIGHLIGHT_ID',
    SET_PAGES = 'SET_PAGES',
    SEARCH_HIGHLIGHT_MOUNTED = 'SEARCH_HIGHLIGHT_MOUNTED'
}

export type PagesAction =
    { type: PagesActionType.SET_CURRENT_HIGHLIGHT_ID, newHighlightId: string } |
    { type: PagesActionType.SET_PAGES, doc: PagedDocument } |
    { type: PagesActionType.SEARCH_HIGHLIGHT_MOUNTED, id: string, element: HTMLElement };

export type GiantAction =
    | WorkspacesAction
    | AppAction
    | MetricsAction
    | UrlParamsAction
    | HighlightsAction
    | UserAction
    | ExpandedFiltersAction
    | ResourceAction
    | LoadingStateAction
    | PagesAction
