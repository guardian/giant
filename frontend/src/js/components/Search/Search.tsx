import React, { useState, useEffect, useRef, useCallback } from "react";

import _isEqual from "lodash/fp/isEqual";
import SearchBox, { extractPlainText, wrapPlainText } from "./SearchBox";
import type { SearchBoxHandle } from "./SearchBox";
import {
  toBackendQ,
  extractCollectionAndWorkspaceChips,
  parseChips,
  rebuildQ,
  SuggestedField,
} from "./chipParsing";

import SearchResults from "../SearchResults/SearchResults";
import SearchStatus from "./SearchStatus";
import PageNavigator from "../UtilComponents/PageNavigator";
import { Checkbox } from "../UtilComponents/Checkbox";
import { KeyboardShortcut } from "../UtilComponents/KeyboardShortcut";

import _get from "lodash/get";
import _debounce from "lodash/debounce";

import { keyboardShortcuts } from "../../util/keyboardShortcuts";
import SearchVisualizations from "./SearchVisualizations";
import { calculateSearchTitle } from "../UtilComponents/documentTitle";

import { connect } from "react-redux";
import { bindActionCreators } from "redux";

import { updateSearchText } from "../../actions/urlParams/updateSearchQuery";
import { performSearch } from "../../actions/search/performSearch";
import { clearSearch } from "../../actions/search/clearSearch";
import { updateSearchQueryFilters } from "../../actions/urlParams/updateSearchQuery";
import { updatePage } from "../../actions/urlParams/updateSearchQuery";
import { updatePageSize } from "../../actions/urlParams/updateSearchQuery";
import { updateSortBy } from "../../actions/urlParams/updateSearchQuery";
import { getSuggestedFields } from "../../actions/search/getSuggestedFields";
import { resetResource } from "../../actions/resources/getResource";
import { updatePreference } from "../../actions/preferences";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunc = (...args: any[]) => any;

interface UrlParams {
  q?: string;
  page?: string;
  pageSize?: string;
  sortBy?: string;
  filters?: Record<string, unknown>;
}

interface SearchProps {
  urlParams: UrlParams;
  lastUri?: string;
  updateSearchText: AnyFunc;
  updatePage: AnyFunc;
  updatePageSize: AnyFunc;
  updateSortBy: AnyFunc;
  performSearch: AnyFunc;
  clearSearch: AnyFunc;
  updateSearchQueryFilters: AnyFunc;
  resetResource: AnyFunc;
  getSuggestedFields: AnyFunc;
  updatePreference: AnyFunc;
  preferences: Record<string, boolean>;
  sidebarFilters?: {
    key: string;
    options: { value: string; display: string }[];
  }[];
  search: {
    isSearchInProgress: boolean;
    currentQuery?: { q?: string };
    currentResults?: {
      hits: number;
      page: number;
      pageSize: number;
      results: unknown[];
    };
    suggestedFields?: SuggestedField[];
    searchFailed?: boolean;
  };
}

function Search(props: SearchProps) {
  const {
    urlParams,
    lastUri,
    search,
    preferences,
    sidebarFilters,
    performSearch: doSearch,
    clearSearch: doClear,
    updateSearchText: doUpdateText,
    updateSearchQueryFilters: doUpdateFilters,
    updatePage: doUpdatePage,
    updatePageSize: doUpdatePageSize,
    updateSortBy: doUpdateSortBy,
    getSuggestedFields: doGetSuggested,
    resetResource: doResetResource,
    updatePreference: doUpdatePreference,
  } = props;

  const searchBoxRef = useRef<SearchBoxHandle>(null);
  const [searchText, setSearchText] = useState("");
  const prevUrlParamsRef = useRef<UrlParams>(urlParams);

  // ── Search trigger ──────────────────────────────────────────────

  const triggerSearch = useCallback(
    (query: UrlParams) => {
      if (query.q) {
        doResetResource();
        const backendQ = toBackendQ(query.q);
        const { cleanedQ, chipFilters } =
          extractCollectionAndWorkspaceChips(backendQ);
        const filters: Record<string, unknown> = { ...(query.filters || {}) };
        delete filters.workspace;
        delete filters.ingestion;
        delete filters.workspace_exclude;
        delete filters.ingestion_exclude;
        if (chipFilters.workspace) filters.workspace = chipFilters.workspace;
        if (chipFilters.ingestion) filters.ingestion = chipFilters.ingestion;
        if (chipFilters.workspace_exclude)
          filters.workspace_exclude = chipFilters.workspace_exclude;
        if (chipFilters.ingestion_exclude)
          filters.ingestion_exclude = chipFilters.ingestion_exclude;
        doSearch({ ...query, q: cleanedQ, filters });
      }
    },
    [doSearch, doResetResource],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedUpdate = useCallback(
    _debounce((text: string) => {
      if (text !== urlParams.q) {
        doUpdatePage("1");
      }
      doUpdateText(text);
      triggerSearch(urlParams);
    }, 500),
    [urlParams, doUpdatePage, doUpdateText, triggerSearch],
  );

  // ── Mount: fetch suggested fields + initial search ──────────────

  useEffect(() => {
    doGetSuggested();
    const q = urlParams.q || "";
    setSearchText(extractPlainText(q));

    const currentQuery = _get(search, "currentQuery.q");
    if (q !== currentQuery || !_get(search, "currentResults.results.length")) {
      triggerSearch(urlParams);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Respond to external urlParams changes ───────────────────────

  useEffect(() => {
    const prev = prevUrlParamsRef.current;
    prevUrlParamsRef.current = urlParams;

    const qChangedExternally = urlParams.q !== prev.q;
    if (qChangedExternally) {
      setSearchText(extractPlainText(urlParams.q));
    }

    const paramsChanged =
      qChangedExternally ||
      !_isEqual(
        {
          filters: urlParams.filters,
          page: urlParams.page,
          pageSize: urlParams.pageSize,
          sortBy: urlParams.sortBy,
        },
        {
          filters: prev.filters,
          page: prev.page,
          pageSize: prev.pageSize,
          sortBy: prev.sortBy,
        },
      );

    if (paramsChanged) {
      triggerSearch(urlParams);
    }
  }, [urlParams, triggerSearch]);

  // ── Document title ──────────────────────────────────────────────

  useEffect(() => {
    document.title = calculateSearchTitle(search.currentQuery);
  }, [search.currentQuery]);

  useEffect(() => {
    return () => {
      document.title = "Giant";
    };
  }, []);

  // ── Callbacks ──────────────────────────────────────────

  const selectSearchBox = useCallback((e: Event) => {
    e.preventDefault();
    searchBoxRef.current?.focus();
  }, []);

  const handleClearSearch = useCallback(() => {
    doClear();
    doUpdateText("");
    doUpdateFilters({});
    doUpdatePage("1");
    setSearchText("");
    searchBoxRef.current?.select();
  }, [doClear, doUpdateText, doUpdateFilters, doUpdatePage]);

  const onFilterChange = useCallback(
    (fullQ: string) => {
      debouncedUpdate(fullQ);
    },
    [debouncedUpdate],
  );

  const buildFullQ = useCallback((): string => {
    const { definedChips } = parseChips(
      urlParams.q,
      search.suggestedFields as SuggestedField[],
    );
    const textQ = wrapPlainText(searchText);
    if (definedChips.length > 0) {
      return rebuildQ(definedChips, textQ);
    }
    return textQ;
  }, [urlParams.q, search.suggestedFields, searchText]);

  const submitSearch = useCallback(() => {
    debouncedUpdate(buildFullQ());
  }, [debouncedUpdate, buildFullQ]);

  const pageSelectCallback = useCallback(
    (page: number) => {
      doUpdatePage(page.toString());
    },
    [doUpdatePage],
  );

  const toggleCompactSearchResults = useCallback(() => {
    doUpdatePreference(
      "compactSearchResults",
      !preferences.compactSearchResults,
    );
  }, [doUpdatePreference, preferences.compactSearchResults]);

  const toggleHistogram = useCallback(() => {
    doUpdatePreference(
      "searchResultHistogram",
      !preferences.searchResultHistogram,
    );
  }, [doUpdatePreference, preferences.searchResultHistogram]);

  // ── Render helpers ──────────────────────────────────────────────

  const pageSize = urlParams.pageSize || "100";
  const sortBy = urlParams.sortBy || "relevance";

  const controls = (
    <div className="search__controls">
      <Checkbox
        selected={preferences.searchResultHistogram}
        onClick={toggleHistogram}
      >
        Show Date Created Graph
      </Checkbox>
      <Checkbox
        selected={preferences.compactSearchResults}
        onClick={toggleCompactSearchResults}
      >
        Compact
      </Checkbox>
      <select
        className="search__control search__select"
        value={sortBy}
        onChange={(e) => {
          doUpdatePage("1");
          doUpdateSortBy(e.target.value);
        }}
      >
        <option value="relevance">Sort by relevance</option>
        <option value="size-asc">Sort by size (smallest first)</option>
        <option value="size-desc">Sort by size (largest first)</option>
        <option value="date-created-asc">
          Sort by date created (oldest first)
        </option>
        <option value="date-created-desc">
          Sort by date created (newest first)
        </option>
      </select>
      <select
        className="search__control search__select"
        value={pageSize}
        onChange={(e) => {
          doUpdatePage("1");
          doUpdatePageSize(e.target.value);
        }}
      >
        <option value="25">25 results per page</option>
        <option value="50">50 results per page</option>
        <option value="100">100 results per page</option>
      </select>
    </div>
  );

  const pageNav =
    search.currentResults &&
    search.currentResults.hits > search.currentResults.pageSize ? (
      <PageNavigator
        pageSelectCallback={pageSelectCallback}
        currentPage={search.currentResults.page}
        pageSpan={5}
        lastPage={Math.ceil(
          search.currentResults.hits / search.currentResults.pageSize,
        )}
      />
    ) : null;

  return (
    <div className="app__main-content search-layout">
      <div className="search-layout__header">
        <KeyboardShortcut
          shortcut={keyboardShortcuts.focusSearchBox}
          func={selectSearchBox}
        />
        <SearchBox
          ref={searchBoxRef}
          searchText={searchText}
          onSearchTextChange={setSearchText}
          q={urlParams.q || ""}
          onFilterChange={onFilterChange}
          resetQuery={handleClearSearch}
          isSearchInProgress={search.isSearchInProgress}
          suggestedFields={search.suggestedFields}
          sidebarFilters={sidebarFilters}
          onSubmit={submitSearch}
        />
      </div>
      <div className="search-layout__results-scroll">
        <div className="search__underbar">
          <SearchStatus
            results={search.currentResults}
            currentQuery={search.currentQuery}
            searchFailed={search.searchFailed}
          />
          <div>{controls}</div>
        </div>

        {preferences.searchResultHistogram ? (
          <SearchVisualizations
            q={urlParams.q}
            results={search.currentResults}
            updateSearchText={onFilterChange}
          />
        ) : (
          false
        )}

        <SearchResults
          compact={!!preferences.compactSearchResults}
          lastUri={lastUri}
          isSearchInProgress={search.isSearchInProgress}
          searchResults={search.currentResults}
        />
        {pageNav}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapStateToProps(state: Record<string, any>) {
  return {
    urlParams: state.urlParams,
    search: state.search,
    lastUri: state.resource ? state.resource.uri : undefined,
    preferences: state.app.preferences,
    sidebarFilters: state.filters,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDispatchToProps(dispatch: any) {
  return {
    getSuggestedFields: bindActionCreators(getSuggestedFields, dispatch),
    updateSearchText: bindActionCreators(updateSearchText, dispatch),
    updatePage: bindActionCreators(updatePage, dispatch),
    updatePageSize: bindActionCreators(updatePageSize, dispatch),
    updateSortBy: bindActionCreators(updateSortBy, dispatch),
    performSearch: bindActionCreators(performSearch, dispatch),
    clearSearch: bindActionCreators(clearSearch, dispatch),
    updateSearchQueryFilters: bindActionCreators(
      updateSearchQueryFilters,
      dispatch,
    ),
    resetResource: bindActionCreators(resetResource, dispatch),
    updatePreference: bindActionCreators(updatePreference, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(Search);
