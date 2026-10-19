import { EmailThread } from "../Email";
import { SearchQuery } from "../SearchQuery";
import { SearchFilter } from "../SearchFilter";
import { Preferences } from "../Preferences";
import { WorkspaceMetadata, WorkspaceEntry, Workspace } from "../Workspaces";
import { TreeEntry, TreeNode } from "../Tree";
import { MimeTypeCoverage } from "../MimeType";
import { ExtractionFailures } from "../ExtractionFailures";
import { Collection } from "../Collection";
import { Auth } from "../Auth";
import { Config } from "../Config";
import { Resource, BasicResource } from "../Resource";
import { SearchResults } from "../SearchResults";
import { SuggestedField } from "../SuggestedFields";
import { PagedDocument } from "../../reducers/pagesReducer";

export interface WorkspacesState {
  workspacesMetadata: WorkspaceMetadata[];
  isGettingWorkspace: boolean;
  currentWorkspace: Workspace | null;
  currentWorkspaceLastRefreshedAt: Date;
  selectedEntries: TreeEntry<WorkspaceEntry>[];
  focusedEntry: TreeEntry<WorkspaceEntry> | null;
  expandedNodes: TreeNode<WorkspaceEntry>[];
  entryBeingRenamed: TreeEntry<WorkspaceEntry> | null;
}

export interface MetricsState {
  coverage: MimeTypeCoverage[] | null;
  extractionFailures: ExtractionFailures | null;
}

export interface HighlightsViewState {
  [view: string]: {
    currentHighlight: number;
  };
}

export interface HighlightsState {
  [resourceIdAndSearchQuery: string]: HighlightsViewState;
}

export interface UrlParamsState {
  filters?: SearchQuery["filters"];
  q: string;
  view?: string;
  details?: object;
  page?: string;
  pageSize?: string;
  sortBy?: string;
  highlight?: string;
  currentWorkspace?: string;
  currentCollection?: string;
  currentIngestion?: string;
}

export type FiltersState = SearchFilter[] | false;

export type ExpandedFiltersState = { [key: string]: boolean };

export type DescendantResources = { [key: string]: BasicResource };

export type SearchState = {
  currentResults?: SearchResults;
  currentQuery?: SearchQuery;
  isSearchInProgress: boolean;
  suggestedFields: SuggestedField[];
  searchFailed?: boolean;
};

export type LoadingState = boolean;

export type PagesState = {
  doc?: PagedDocument;
  currentHighlightId?: string;
  // TODO: | undefined?
  mountedHighlightElements: { [id: string]: HTMLElement };
};

export interface AppState {
  config: Partial<Config>;
  preferences: Preferences;
  errors: string[];
  warnings: string[];
}

export type EmailsState = {
  uri: string;
  timeline: EmailThread;
} | null;

// Once all reducers are typed, we should be able to infer this type, à la:
// https://github.com/guardian/facia-tool/blob/master/client-v2/src/types/State.ts
export interface GiantState {
  emails: EmailsState;
  filters: FiltersState;
  workspaces: WorkspacesState;
  metrics: MetricsState;
  auth: Auth;
  users: any;
  highlights: HighlightsState;
  collections: Collection[];
  app: AppState;
  expandedFiltersState: { [key: string]: boolean };
  resource: Resource | null;
  descendantResources: DescendantResources;
  urlParams: UrlParamsState;
  search: SearchState;
  isLoadingResource: LoadingState;
  pages: PagesState;
  pendingScrollToCommentId: string | null;
}
