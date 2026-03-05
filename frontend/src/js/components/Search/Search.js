import React from "react";
import PropTypes from "prop-types";

import _isEqual from "lodash/fp/isEqual";
import SearchBox, { extractPlainText } from "./SearchBox";
import {
  toBackendQ,
  extractCollectionAndWorkspaceChips,
  parseChips,
  rebuildQ,
} from "./chipParsing";
import { wrapPlainText } from "./SearchBox";

import SearchResults from "../SearchResults/SearchResults";
import SearchStatus from "./SearchStatus";
import PageNavigator from "../UtilComponents/PageNavigator";
import { Checkbox } from "../UtilComponents/Checkbox";
import { KeyboardShortcut } from "../UtilComponents/KeyboardShortcut";
import Select from "react-select";

import { searchResultsPropType } from "../../types/SearchResults";
import _get from "lodash/get";
import _debounce from "lodash/debounce";

import { suggestedFieldsPropType } from "../../types/SuggestedFields";
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

class Search extends React.Component {
  static propTypes = {
    urlParams: PropTypes.shape({
      q: PropTypes.string,
      page: PropTypes.any,
      pageSize: PropTypes.any,
      sortBy: PropTypes.string,
      filters: PropTypes.any,
    }),
    lastUri: PropTypes.string,
    updateSearchText: PropTypes.func.isRequired,
    updatePage: PropTypes.func.isRequired,
    updatePageSize: PropTypes.func.isRequired,
    updateSortBy: PropTypes.func.isRequired,
    performSearch: PropTypes.func.isRequired,
    clearSearch: PropTypes.func.isRequired,
    updateSearchQueryFilters: PropTypes.func.isRequired,
    resetResource: PropTypes.func.isRequired,
    getSuggestedFields: PropTypes.func.isRequired,
    updatePreference: PropTypes.func.isRequired,
    preferences: PropTypes.object,
    /** Sidebar filter definitions from /api/filters (workspace + collection options) */
    sidebarFilters: PropTypes.array,
    search: PropTypes.shape({
      isSearchInProgress: PropTypes.bool.isRequired,
      currentQuery: PropTypes.object,
      currentResults: searchResultsPropType,
      suggestedFields: PropTypes.arrayOf(suggestedFieldsPropType),
      searchFailed: PropTypes.bool,
    }).isRequired,
  };

  state = {
    searchText: "",
  };

  selectSearchBox = (e) => {
    e.preventDefault();
    this.searchBox.focus();
  };

  clearSearch = (e) => {
    e.preventDefault();

    this.props.clearSearch();
    this.props.updateSearchText("");
    this.props.updateSearchQueryFilters({});
    this.props.updatePage("1");
    this.setState({ searchText: "" });
    this.searchBox.select();
  };

  debouncedUpdate = _debounce((text) => {
    if (text !== this.props.urlParams.q) {
      this.props.updatePage("1");
    }
    this.props.updateSearchText(text);

    this.triggerSearch(this.props.urlParams);
  }, 500);

  updateSearchInputText = (text) => {
    this.setState({ searchText: text });
  };

  /**
   * Called by chip operations. Receives the new full q (JSON with chips),
   * updates Redux and triggers a search.
   */
  onFilterChange = (fullQ) => {
    this.debouncedUpdate(fullQ);
  };

  triggerSearch(query) {
    if (query.q) {
      this.props.resetResource();
      // Expand File Type → Mime Type at the API boundary
      let backendQ = toBackendQ(query.q);
      // Extract Dataset/Workspace chips → workspace[]/ingestion[] params
      const { cleanedQ, chipFilters } =
        extractCollectionAndWorkspaceChips(backendQ);
      const filters = { ...(query.filters || {}) };
      // Remove any legacy sidebar workspace/ingestion values
      delete filters.workspace;
      delete filters.ingestion;
      delete filters.workspace_exclude;
      delete filters.ingestion_exclude;
      // Merge chip-derived filters (include and exclude)
      if (chipFilters.workspace) filters.workspace = chipFilters.workspace;
      if (chipFilters.ingestion) filters.ingestion = chipFilters.ingestion;
      if (chipFilters.workspace_exclude)
        filters.workspace_exclude = chipFilters.workspace_exclude;
      if (chipFilters.ingestion_exclude)
        filters.ingestion_exclude = chipFilters.ingestion_exclude;
      this.props.performSearch({ ...query, q: cleanedQ, filters });
    }
  }

  /**
   * Build the full q from current searchText + chips and submit.
   */
  buildFullQ = () => {
    const { definedChips } = parseChips(
      this.props.urlParams.q,
      this.props.search.suggestedFields,
    );
    const textQ = wrapPlainText(this.state.searchText);
    if (definedChips.length > 0) {
      return rebuildQ(definedChips, textQ);
    }
    return textQ;
  };

  submitSearch = () => {
    this.debouncedUpdate(this.buildFullQ());
  };

  componentDidMount() {
    this.props.getSuggestedFields();

    const search = this.props.urlParams.q || "";
    this.setState({
      searchText: extractPlainText(search),
    });

    const currentQuery = _get(this.props.search, "currentQuery.q");
    // If we're mounting with a different query or without any results, trigger a search
    if (
      search !== currentQuery ||
      !_get(this.props.search, "currentResults.results.length")
    ) {
      this.triggerSearch(this.props.urlParams);
    }

    document.title = calculateSearchTitle(this.props.search.currentQuery);
  }

  UNSAFE_componentWillReceiveProps(props) {
    // Detect external q changes (e.g. sidebar updating File Type chip).
    // Internal typing sets visibleText first, so the q will match;
    // external changes won't match → we sync visibleText and trigger search.
    const qChangedExternally = props.urlParams.q !== this.props.urlParams.q;

    if (qChangedExternally) {
      this.setState({ searchText: extractPlainText(props.urlParams.q) });
    }

    const before = {
      filters: props.urlParams.filters,
      page: props.urlParams.page,
      pageSize: props.urlParams.pageSize,
      sortBy: props.urlParams.sortBy,
    };

    const after = {
      filters: this.props.urlParams.filters,
      page: this.props.urlParams.page,
      pageSize: this.props.urlParams.pageSize,
      sortBy: this.props.urlParams.sortBy,
    };

    if (qChangedExternally || !_isEqual(before, after)) {
      this.triggerSearch(props.urlParams);
    }
  }

  componentDidUpdate() {
    document.title = calculateSearchTitle(this.props.search.currentQuery);
  }

  componentWillUnmount() {
    document.title = "Giant";
  }

  pageSelectCallback = (page) => {
    this.props.updatePage(page.toString());
  };

  toggleCompactSearchResults = () => {
    this.props.updatePreference(
      "compactSearchResults",
      !this.props.preferences.compactSearchResults,
    );
  };

  toggleHistogram = () => {
    this.props.updatePreference(
      "searchResultHistogram",
      !this.props.preferences.searchResultHistogram,
    );
  };

  renderControls() {
    // TODO replace with user preferences for page size
    const pageSize = this.props.urlParams.pageSize || "100";
    // TODO replace with user preferences for sort order
    const sortBy = this.props.urlParams.sortBy || "relevance";

    return (
      <div className="search__controls">
        <Checkbox
          selected={this.props.preferences.searchResultHistogram}
          onClick={this.toggleHistogram}
        >
          Show Date Created Graph
        </Checkbox>
        <Checkbox
          selected={this.props.preferences.compactSearchResults}
          onClick={this.toggleCompactSearchResults}
        >
          Compact
        </Checkbox>
        <Select
          className="search__control"
          value={sortBy}
          options={[
            { value: "relevance", label: "Sort by relevance" },
            { value: "size-asc", label: "Sort by size (smallest first)" },
            { value: "size-desc", label: "Sort by size (largest first)" },
            {
              value: "date-created-asc",
              label: "Sort by date created (oldest first)",
            },
            {
              value: "date-created-desc",
              label: "Sort by date created (newest first)",
            },
          ]}
          onChange={(v) => {
            this.props.updatePage("1");
            this.props.updateSortBy(v.value);
          }}
          clearable={false}
        />
        <Select
          className="search__control"
          value={pageSize}
          options={[
            { value: "25", label: "25 results per page" },
            { value: "50", label: "50 results per page" },
            { value: "100", label: "100 results per page" },
          ]}
          onChange={(v) => {
            this.props.updatePage("1");
            this.props.updatePageSize(v.value);
          }}
          clearable={false}
        />
      </div>
    );
  }

  renderPageNav() {
    if (this.props.search.currentResults) {
      if (
        this.props.search.currentResults.hits >
        this.props.search.currentResults.pageSize
      ) {
        return (
          <PageNavigator
            pageSelectCallback={this.pageSelectCallback}
            currentPage={this.props.search.currentResults.page}
            pageSpan={5}
            lastPage={Math.ceil(
              this.props.search.currentResults.hits /
                this.props.search.currentResults.pageSize,
            )}
          />
        );
      }
    }
    return false;
  }

  render() {
    return (
      <div className="app__main-content search-layout">
        <div className="search-layout__header">
          <KeyboardShortcut
            shortcut={keyboardShortcuts.focusSearchBox}
            func={this.selectSearchBox}
          />
          <SearchBox
            ref={(input) => (this.searchBox = input)}
            searchText={this.state.searchText}
            onSearchTextChange={this.updateSearchInputText}
            q={this.props.urlParams.q || ""}
            onFilterChange={this.onFilterChange}
            resetQuery={this.clearSearch}
            isSearchInProgress={this.props.search.isSearchInProgress}
            suggestedFields={this.props.search.suggestedFields}
            sidebarFilters={this.props.sidebarFilters}
            onSubmit={this.submitSearch}
          />
        </div>
        <div className="search-layout__results-scroll">
          <div className="search__underbar">
            <SearchStatus
              results={this.props.search.currentResults}
              currentQuery={this.props.search.currentQuery}
              searchFailed={this.props.search.searchFailed}
            />

            <div>{this.renderControls()}</div>
          </div>

          {this.props.preferences.searchResultHistogram ? (
            <SearchVisualizations
              q={this.props.urlParams.q}
              results={this.props.search.currentResults}
              updateSearchText={this.onFilterChange}
            />
          ) : (
            false
          )}

          <SearchResults
            compact={!!this.props.preferences.compactSearchResults}
            lastUri={this.props.lastUri}
            isSearchInProgress={this.props.search.isSearchInProgress}
            searchResults={this.props.search.currentResults}
          />
          {this.renderPageNav()}
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    urlParams: state.urlParams,
    search: state.search,
    lastUri: state.resource ? state.resource.uri : undefined,
    preferences: state.app.preferences,
    sidebarFilters: state.filters,
  };
}

function mapDispatchToProps(dispatch) {
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
