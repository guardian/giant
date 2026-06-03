import React from "react";
import SearchFilter from "./SearchFilter";
import FileTypeSidebarFilter from "./FileTypeSidebarFilter";
import TriStateSidebarSection from "./TriStateSidebarSection";
import { PolarityValues } from "../Search/chipParsing";

import { connect } from "react-redux";
import { bindActionCreators } from "redux";

import * as getFilters from "../../actions/getFilters";
import * as updateSearchFilters from "../../actions/urlParams/updateSearchQuery";
import * as setFilterExpansionState from "../../actions/setFilterExpansionState";

import {
  getFileTypeCategoriesFromQ,
  setFileTypeCategoriesInQ,
  getWorkspacesFromQ,
  setWorkspacesInQ,
  getDatasetsFromQ,
  setDatasetsInQ,
} from "../Search/chipParsing";

const MIME_TYPE_FILTER_KEY = "mimeType";
const WORKSPACE_FILTER_KEY = "workspace";
const INGESTION_FILTER_KEY = "ingestion";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunc = (...args: any[]) => any;

interface SidebarFilterOption {
  value: string;
  display?: string;
  suboptions?: SidebarFilterOption[];
}

interface SidebarFilter {
  key: string;
  display?: string;
  hideable?: boolean;
  options?: SidebarFilterOption[];
}

interface AggBucket {
  key: string;
  count?: number;
  buckets?: AggBucket[];
}

interface SearchSidebarProps {
  filters?: SidebarFilter[];
  activeFilters?: Record<string, unknown>;
  q?: string;
  currentResults?: {
    aggs: AggBucket[];
  };
  expandedFilters: Record<string, boolean>;
  filterActions: {
    getFilters: AnyFunc;
    updateSearchQueryFilters: AnyFunc;
    updateSearchText: AnyFunc;
    setFilterExpansionState: AnyFunc;
  };
}

export class SearchSidebarUnconnected extends React.Component<SearchSidebarProps> {
  componentDidMount() {
    this.props.filterActions.getFilters();
  }

  /** Called by non-chip-driven SearchFilter instances */
  updateSelectedFilters = (filters: Record<string, unknown>) => {
    // Strip workspace/ingestion — those are now chip-driven
    const { workspace, ingestion, ...otherFilters } = filters;
    this.props.filterActions.updateSearchQueryFilters(otherFilters);
  };

  onToggleFileTypeCategories = (categories: PolarityValues) => {
    const newQ = setFileTypeCategoriesInQ(this.props.q || "", categories);
    this.props.filterActions.updateSearchText(newQ);
  };

  onToggleWorkspace = (values: PolarityValues) => {
    const newQ = setWorkspacesInQ(this.props.q || "", values);
    this.props.filterActions.updateSearchText(newQ);
  };

  onToggleDataset = (values: PolarityValues) => {
    const newQ = setDatasetsInQ(this.props.q || "", values);
    this.props.filterActions.updateSearchText(newQ);
  };

  sortByDisplay = (
    a: { display?: string; value?: string; key?: string },
    b: { display?: string; value?: string; key?: string },
  ) => {
    return (a.display ?? a.value ?? a.key ?? "").localeCompare(
      b.display ?? b.value ?? b.key ?? "",
    );
  };

  sortOptions = (option: SidebarFilterOption): SidebarFilterOption => {
    if (option.suboptions) {
      return Object.assign({}, option, {
        suboptions: option.suboptions
          .map(this.sortOptions)
          .sort(this.sortByDisplay),
      });
    }
    return option;
  };

  sortFilters = (filters: SidebarFilter[]) => {
    const hardcodedTopLevelFilters = ["workspace", "ingestion"];

    const topLevelFilters = hardcodedTopLevelFilters
      .map((key) => filters.find((f: SidebarFilter) => f.key === key))
      .filter((f): f is SidebarFilter => f !== undefined);
    const theRest = filters
      .filter(
        ({ key }: SidebarFilter) => !hardcodedTopLevelFilters.includes(key),
      )
      .sort(this.sortByDisplay);

    return [...topLevelFilters, ...theRest];
  };

  generateDynamicFilters = (aggs: AggBucket[]): SidebarFilter[] => {
    const dynamic = aggs.filter(
      ({ key }: AggBucket) =>
        !this.props.filters!.find((f: SidebarFilter) => f.key === key),
    );

    function _generate({ key, buckets }: AggBucket): SidebarFilterOption {
      return buckets
        ? {
            value: key,
            display: key,
            suboptions: buckets.map(_generate),
          }
        : { value: key, display: key };
    }

    return dynamic.map(({ key, buckets }: AggBucket) => {
      return {
        key,
        display: key,
        hideable: true,
        options: buckets ? buckets.map(_generate) : [],
      };
    });
  };

  render() {
    if (!this.props.filters) {
      return false;
    }

    let aggs: AggBucket[] = [];

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
              .map((option: SidebarFilterOption) => this.sortOptions(option))
              .sort(this.sortByDisplay),
          })
        : filter,
    );

    const isFilterExpanded = (filter: SidebarFilter) =>
      this.props.expandedFilters[filter.key] !== undefined
        ? this.props.expandedFilters[filter.key]
        : true;

    const fileTypeCategories = getFileTypeCategoriesFromQ(this.props.q);
    const chipWorkspaces = getWorkspacesFromQ(this.props.q);
    const chipDatasets = getDatasetsFromQ(this.props.q);

    return (
      <div className="sidebar">
        <div className="sidebar__title">Search Filters</div>
        {sortedFilters.map((filter) =>
          filter.key === MIME_TYPE_FILTER_KEY ? (
            <FileTypeSidebarFilter
              key={filter.key}
              positiveCategories={fileTypeCategories.positive}
              negativeCategories={fileTypeCategories.negative}
              onToggleCategory={this.onToggleFileTypeCategories}
              agg={aggs.find((e) => e.key === MIME_TYPE_FILTER_KEY)}
              isExpanded={isFilterExpanded(filter)}
              setExpanded={() =>
                this.props.filterActions.setFilterExpansionState(
                  filter.key,
                  !isFilterExpanded(filter),
                )
              }
            />
          ) : filter.key === WORKSPACE_FILTER_KEY ? (
            <TriStateSidebarSection
              key={filter.key}
              title={filter.display || "Workspaces"}
              filterKey={WORKSPACE_FILTER_KEY}
              options={filter.options || []}
              positiveValues={chipWorkspaces.positive}
              negativeValues={chipWorkspaces.negative}
              onToggle={this.onToggleWorkspace}
              agg={aggs.find((e) => e.key === filter.key)}
              isExpanded={isFilterExpanded(filter)}
              setExpanded={() =>
                this.props.filterActions.setFilterExpansionState(
                  filter.key,
                  !isFilterExpanded(filter),
                )
              }
              missingAggValue={""}
            />
          ) : filter.key === INGESTION_FILTER_KEY ? (
            <TriStateSidebarSection
              key={filter.key}
              title={filter.display || "Datasets"}
              filterKey={INGESTION_FILTER_KEY}
              options={filter.options || []}
              positiveValues={chipDatasets.positive}
              negativeValues={chipDatasets.negative}
              onToggle={this.onToggleDataset}
              agg={aggs.find((e) => e.key === filter.key)}
              isExpanded={isFilterExpanded(filter)}
              setExpanded={() =>
                this.props.filterActions.setFilterExpansionState(
                  filter.key,
                  !isFilterExpanded(filter),
                )
              }
              missingAggValue={"0"}
            />
          ) : (
            <SearchFilter
              filter={filter}
              isExpanded={isFilterExpanded(filter)}
              activeFilters={this.props.activeFilters || {}}
              updateActiveFilters={this.updateSelectedFilters}
              key={filter.key}
              agg={aggs.find((e) => e.key === filter.key)}
              missingAggValue={"0"}
              setFilterExpansionState={
                this.props.filterActions.setFilterExpansionState
              }
            />
          ),
        )}
      </div>
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapStateToProps(state: any) {
  return {
    filters: state.filters,
    activeFilters: (state.urlParams && state.urlParams.filters) || {},
    q: (state.urlParams && state.urlParams.q) || "",
    currentResults: state.search.currentResults,
    expandedFilters: state.expandedFilters,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDispatchToProps(dispatch: any) {
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
