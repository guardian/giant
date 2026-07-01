import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { connect } from "react-redux";
import { AnyAction } from "redux";
import { ThunkDispatch } from "redux-thunk";

import _debounce from "lodash/debounce";
import _get from "lodash/get";

import Select from "react-select";

import SearchBox, { SearchBoxHandle } from "./SearchBox";
import SearchResults from "../SearchResults/SearchResults";
import SearchStatus from "./SearchStatus";
import PageNavigator from "../UtilComponents/PageNavigator";
import { Checkbox } from "../UtilComponents/Checkbox";
import { KeyboardShortcut } from "../UtilComponents/KeyboardShortcut";
import { keyboardShortcuts } from "../../util/keyboardShortcuts";
import SearchVisualizations from "./SearchVisualizations";
import { calculateSearchTitle } from "../UtilComponents/documentTitle";

import { GiantState } from "../../types/redux/GiantState";
import {
  updateSearchText,
  updateSearchQueryFilters,
  updatePage,
  updatePageSize,
  updateSortBy,
} from "../../actions/urlParams/updateSearchQuery";
import { performSearch } from "../../actions/search/performSearch";
import { clearSearch } from "../../actions/search/clearSearch";
import { getSuggestedFields } from "../../actions/search/getSuggestedFields";
import { resetResource } from "../../actions/resources/getResource";
import { updatePreference } from "../../actions/preferences";

interface StateProps {
  urlParams: GiantState["urlParams"];
  search: GiantState["search"];
  lastUri: string | undefined;
  preferences: GiantState["app"]["preferences"];
}

interface DispatchProps {
  getSuggestedFields: () => void;
  updateSearchText: (text: string) => void;
  updatePage: (page: string) => void;
  updatePageSize: (pageSize: string) => void;
  updateSortBy: (sortBy: string) => void;
  performSearch: (query: GiantState["urlParams"]) => void;
  clearSearch: () => void;
  updateSearchQueryFilters: (filters: object) => void;
  resetResource: () => void;
  updatePreference: (key: string, value: unknown) => void;
}

type SearchProps = StateProps & DispatchProps;

interface SelectOption {
  value: string;
  label: string;
}

const SORT_BY_OPTIONS: SelectOption[] = [
  { value: "relevance", label: "Sort by relevance" },
  { value: "size-asc", label: "Sort by size (smallest first)" },
  { value: "size-desc", label: "Sort by size (largest first)" },
  { value: "date-created-asc", label: "Sort by date created (oldest first)" },
  { value: "date-created-desc", label: "Sort by date created (newest first)" },
];

const PAGE_SIZE_OPTIONS: SelectOption[] = [
  { value: "25", label: "25 results per page" },
  { value: "50", label: "50 results per page" },
  { value: "100", label: "100 results per page" },
];

function Search(props: SearchProps) {
  const [visibleText, setVisibleText] = useState("");
  const searchBoxRef = useRef<SearchBoxHandle>(null);

  // Keep a ref to current props so stable callbacks and the debounced
  // updater read fresh values without changing identity each render.
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });

  const triggerSearch = useCallback((query: GiantState["urlParams"]) => {
    if (query.q) {
      propsRef.current.resetResource();
      propsRef.current.performSearch(query);
    }
  }, []);

  const debouncedUpdate = useMemo(
    () =>
      _debounce((text: string) => {
        const p = propsRef.current;
        if (text !== p.urlParams.q) {
          p.updatePage("1");
        }
        p.updateSearchText(text);
        triggerSearch(p.urlParams);
      }, 500),
    [triggerSearch],
  );

  useEffect(() => () => debouncedUpdate.cancel(), [debouncedUpdate]);

  const updateVisibleText = useCallback((text: string) => {
    setVisibleText(text);
  }, []);

  const updateSearchTextHandler = useCallback(() => {
    debouncedUpdate(visibleText);
  }, [debouncedUpdate, visibleText]);

  const clearSearchHandler = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const p = propsRef.current;
      setVisibleText("");
      p.clearSearch();
      p.updateSearchText("");
      p.updateSearchQueryFilters({});
      p.updatePage("1");
      searchBoxRef.current?.select();
    },
    [],
  );

  const selectSearchBox = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    searchBoxRef.current?.focus();
  }, []);

  const pageSelectCallback = useCallback((page: number) => {
    propsRef.current.updatePage(page.toString());
  }, []);

  const toggleCompactSearchResults = useCallback(() => {
    const p = propsRef.current;
    p.updatePreference(
      "compactSearchResults",
      !p.preferences.compactSearchResults,
    );
  }, []);

  const toggleHistogram = useCallback(() => {
    const p = propsRef.current;
    p.updatePreference(
      "searchResultHistogram",
      !p.preferences.searchResultHistogram,
    );
  }, []);

  useEffect(() => {
    const p = propsRef.current;
    p.getSuggestedFields();

    const initialSearch = p.urlParams.q || "";
    setVisibleText(initialSearch);

    const currentQuery = _get(p.search, "currentQuery.q");
    if (
      initialSearch !== currentQuery ||
      !_get(p.search, "currentResults.results.length")
    ) {
      triggerSearch(p.urlParams);
    }

    document.title = calculateSearchTitle(p.search.currentQuery);

    return () => {
      document.title = "Giant";
    };
    // Mount-only; current props are reached through propsRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fire search when filters / page / pageSize / sortBy change. Relies on
  // Redux's immutable-update convention so Object.is dep comparison detects
  // changes correctly. The ref skips the first render so we don't double-fire
  // alongside the mount effect.
  const isFirstChangeEffect = useRef(true);
  const { filters, page, pageSize, sortBy } = props.urlParams;
  useEffect(() => {
    if (isFirstChangeEffect.current) {
      isFirstChangeEffect.current = false;
      return;
    }
    triggerSearch(propsRef.current.urlParams);
  }, [filters, page, pageSize, sortBy, triggerSearch]);

  useEffect(() => {
    document.title = calculateSearchTitle(props.search.currentQuery);
  }, [props.search.currentQuery]);

  const renderControls = () => {
    // TODO replace with user preferences for sort order
    const sortByValue = props.urlParams.sortBy || "relevance";
    const currentSortByOption = SORT_BY_OPTIONS.find(
      (o) => o.value === sortByValue,
    );

    // TODO replace with user preferences for page size
    const pageSizeValue = props.urlParams.pageSize ?? "100";
    const currentPageSizeOption = PAGE_SIZE_OPTIONS.find(
      (o) => o.value === pageSizeValue,
    );

    return (
      <div className="search__controls">
        <Checkbox
          selected={props.preferences.searchResultHistogram}
          onClick={toggleHistogram}
        >
          Show Date Created Graph
        </Checkbox>
        <Checkbox
          selected={props.preferences.compactSearchResults}
          onClick={toggleCompactSearchResults}
        >
          Compact
        </Checkbox>
        <Select
          className="search__control"
          value={currentSortByOption}
          options={SORT_BY_OPTIONS}
          onChange={(v) => {
            const option = v as SelectOption | null;
            if (!option) return;
            propsRef.current.updatePage("1");
            propsRef.current.updateSortBy(option.value);
          }}
          clearable={false}
        />
        <Select
          className="search__control"
          value={currentPageSizeOption}
          options={PAGE_SIZE_OPTIONS}
          onChange={(v) => {
            const option = v as SelectOption | null;
            if (!option) return;
            propsRef.current.updatePage("1");
            propsRef.current.updatePageSize(option.value);
          }}
          clearable={false}
        />
      </div>
    );
  };

  const renderPageNav = () => {
    const results = props.search.currentResults;
    if (results && results.hits > results.pageSize) {
      return (
        <PageNavigator
          pageSelectCallback={pageSelectCallback}
          currentPage={results.page}
          pageSpan={5}
          lastPage={Math.ceil(results.hits / results.pageSize)}
        />
      );
    }
    return false;
  };

  return (
    <div className="app__main-content search">
      <KeyboardShortcut
        shortcut={keyboardShortcuts.focusSearchBox}
        func={selectSearchBox}
      />
      <SearchBox
        ref={searchBoxRef}
        updateVisibleText={updateVisibleText}
        resetQuery={clearSearchHandler}
        q={visibleText}
        isSearchInProgress={props.search.isSearchInProgress}
        suggestedFields={props.search.suggestedFields}
        updateSearchText={updateSearchTextHandler}
      />
      <div className="search__underbar">
        <SearchStatus
          results={props.search.currentResults}
          currentQuery={props.search.currentQuery}
          searchFailed={props.search.searchFailed}
        />

        <div>{renderControls()}</div>
      </div>

      {props.preferences.searchResultHistogram ? (
        <SearchVisualizations
          q={props.urlParams.q}
          results={props.search.currentResults}
          updateSearchText={updateSearchTextHandler}
        />
      ) : (
        false
      )}

      <SearchResults
        compact={!!props.preferences.compactSearchResults}
        lastUri={props.lastUri}
        isSearchInProgress={props.search.isSearchInProgress}
        searchResults={props.search.currentResults}
      />
      {renderPageNav()}
    </div>
  );
}

function mapStateToProps(state: GiantState): StateProps {
  return {
    urlParams: state.urlParams,
    search: state.search,
    lastUri: state.resource ? state.resource.uri : undefined,
    preferences: state.app.preferences,
  };
}

function mapDispatchToProps(
  dispatch: ThunkDispatch<GiantState, undefined, AnyAction>,
): DispatchProps {
  return {
    getSuggestedFields: () => dispatch(getSuggestedFields()),
    updateSearchText: (text) => dispatch(updateSearchText(text)),
    updatePage: (page) => dispatch(updatePage(page)),
    updatePageSize: (size) => dispatch(updatePageSize(size)),
    updateSortBy: (sortBy) => dispatch(updateSortBy(sortBy)),
    performSearch: (query) => dispatch(performSearch(query)),
    clearSearch: () => dispatch(clearSearch()),
    updateSearchQueryFilters: (filters) =>
      dispatch(updateSearchQueryFilters(filters)),
    resetResource: () => dispatch(resetResource()),
    updatePreference: (key, value) => dispatch(updatePreference(key, value)),
  };
}

export default connect<
  StateProps,
  DispatchProps,
  Record<string, never>,
  GiantState
>(
  mapStateToProps,
  mapDispatchToProps,
)(Search);
