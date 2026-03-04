import React from "react";
import PropTypes from "prop-types";
import SearchFilter from "./SearchFilter";
import { searchResultsPropType } from "../../types/SearchResults";

import { connect } from "react-redux";
import { bindActionCreators } from "redux";

import * as getFilters from "../../actions/getFilters";
import * as updateSearchFilters from "../../actions/urlParams/updateSearchQuery";
import * as setFilterExpansionState from "../../actions/setFilterExpansionState";

import {
  getFileTypeCategoriesFromQ,
  setFileTypeCategoriesInQ,
} from "../Search/chipParsing";
import {
  expandFileTypeValues,
  collapseMimesToCategories,
} from "../Search/fileTypeCategories";

/** Sidebar filter key for MIME types (from backend /api/filters) */
const MIME_TYPE_FILTER_KEY = "mimeType";

export class SearchSidebarUnconnected extends React.Component {
  static propTypes = {
    filters: PropTypes.array,
    activeFilters: PropTypes.object,
    /** The raw q string from urlParams (used to derive mimeType state) */
    q: PropTypes.string,
    currentResults: searchResultsPropType,
    filterActions: PropTypes.shape({
      getFilters: PropTypes.func.isRequired,
      updateSearchQueryFilters: PropTypes.func.isRequired,
      updateSearchText: PropTypes.func.isRequired,
    }).isRequired,
  };

  componentDidMount() {
    this.props.filterActions.getFilters();
  }

  /**
   * Called by SearchFilter when the user ticks / unticks a sidebar checkbox.
   *
   * For the mimeType filter, we route changes through the File Type chip
   * so that chip bar and sidebar always agree.
   * All other filters continue to use the legacy `filters` URL param.
   */
  updateSelectedFilters = (newFilters) => {
    const { [MIME_TYPE_FILTER_KEY]: newMimeSelections, ...otherFilters } =
      newFilters;

    // --- mimeType: route through the File Type chip ----
    const oldMimes = this.deriveMimeSelections();
    const mimeChanged =
      (newMimeSelections || []).length !== oldMimes.length ||
      (newMimeSelections || []).some((m) => !oldMimes.includes(m));

    if (mimeChanged) {
      const categories = collapseMimesToCategories(newMimeSelections || []);
      const newQ = setFileTypeCategoriesInQ(this.props.q || "", categories);
      this.props.filterActions.updateSearchText(newQ);
    }

    // --- everything else: legacy path (workspace, ingestion, …) ----
    this.props.filterActions.updateSearchQueryFilters(otherFilters);
  };

  /** Expand the current File Type chip categories into individual MIME types */
  deriveMimeSelections = () => {
    const categories = getFileTypeCategoriesFromQ(this.props.q);
    return expandFileTypeValues(categories);
  };

  sortByDisplay = (a, b) => {
    return a.display.localeCompare(b.display);
  };

  // Recursively sort filter options
  sortOptions = (option) => {
    if (option.suboptions) {
      return Object.assign({}, option, {
        suboptions: option.suboptions
          .map(this.sortOptions)
          .sort(this.sortByDisplay),
      });
    }
    return option;
  };

  sortFilters = (filters) => {
    // Hard-coded to pull up workspace and dataset (collection  and ingestion) filters
    // as we expect these to be immediately useful as the number of workspaces grow
    const hardcodedTopLevelFilters = ["workspace", "ingestion"];

    // Map the hardcoded filters to be the actual filter structure to preserve ordering
    const topLevelFilters = hardcodedTopLevelFilters
      .map((key) => filters.find((f) => f.key === key))
      .filter((f) => f !== undefined);
    const theRest = filters
      .filter(({ key }) => !hardcodedTopLevelFilters.includes(key))
      .sort(this.sortByDisplay);

    return [...topLevelFilters, ...theRest];
  };

  // eg year/month facet
  generateDynamicFilters = (aggs) => {
    const dynamic = aggs.filter(
      ({ key }) => !this.props.filters.find((f) => f.key === key),
    );

    function _generate({ key, buckets }) {
      return buckets
        ? { value: key, display: key, suboptions: buckets.map(_generate) }
        : { value: key, display: key };
    }

    return dynamic.map(({ key, buckets }) => {
      return {
        key,
        display: key,
        hideable: true,
        options: buckets.map(_generate),
      };
    });
  };

  render() {
    if (!this.props.filters) {
      return false;
    }

    var aggs = [];

    if (this.props.currentResults) {
      aggs = this.props.currentResults.aggs;
    }

    const filters = this.props.filters.concat(
      this.generateDynamicFilters(aggs),
    );
    const topLevelSortedFilters = this.sortFilters(filters);

    const sortedFilters = topLevelSortedFilters.map((filter) =>
      filter.options
        ? Object.assign({}, filter, {
            options: filter.options
              .map((option) => this.sortOptions(option))
              .sort(this.sortByDisplay),
          })
        : filter,
    );

    const isFilterExpanded = (filter) =>
      this.props.expandedFilters[filter.key] !== undefined
        ? this.props.expandedFilters[filter.key]
        : true;

    return (
      <div className="sidebar">
        <div className="sidebar__title">Search Filters</div>
        {sortedFilters.map((filter) => (
          <SearchFilter
            filter={filter}
            isExpanded={isFilterExpanded(filter)}
            activeFilters={this.props.activeFilters || {}}
            updateActiveFilters={this.updateSelectedFilters}
            key={filter.key}
            agg={aggs.find((e) => e.key === filter.key)}
            // TODO MRB: remove this once workspace counts are fixed
            missingAggValue={filter.key === "workspace" ? "" : "0"}
            setFilterExpansionState={
              this.props.filterActions.setFilterExpansionState
            }
          />
        ))}
      </div>
    );
  }
}

function mapStateToProps(state) {
  const q = (state.urlParams && state.urlParams.q) || "";
  const baseFilters = (state.urlParams && state.urlParams.filters) || {};

  // Derive mimeType selections from the File Type chip in q,
  // so the sidebar checkboxes reflect chip state.
  const categories = getFileTypeCategoriesFromQ(q);
  const mimeFromChips = expandFileTypeValues(categories);

  return {
    filters: state.filters,
    activeFilters: { ...baseFilters, [MIME_TYPE_FILTER_KEY]: mimeFromChips },
    q,
    currentResults: state.search.currentResults,
    expandedFilters: state.expandedFilters,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    filterActions: bindActionCreators(
      Object.assign(
        {},
        getFilters,
        updateSearchFilters,
        setFilterExpansionState,
      ),
      dispatch,
    ),
  };
}

export const SearchSidebar = connect(
  mapStateToProps,
  mapDispatchToProps,
)(SearchSidebarUnconnected);
