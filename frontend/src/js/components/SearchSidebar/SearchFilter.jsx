import React from "react";
import PropTypes from "prop-types";

import { searchFilter } from "../../types/SearchFilter.js";
import { SearchFilterOption } from "./SearchFilterOption";
import { MenuChevron } from "../UtilComponents/MenuChevron";

export default class SearchFilter extends React.Component {
  static propTypes = {
    filter: searchFilter,
    activeFilters: PropTypes.object.isRequired,
    updateActiveFilters: PropTypes.func.isRequired,
    agg: PropTypes.object,
    missingAggValue: PropTypes.string.isRequired,
    setFilterExpansionState: PropTypes.func.isRequired,
    isExpanded: PropTypes.bool,
  };

  toggleExpanded = () => {
    this.props.setFilterExpansionState(
      this.props.filter.key,
      !this.props.isExpanded,
    );
  };

  updateActiveSearchFilters = (options) => {
    const newSearchFilters = Object.assign({}, this.props.activeFilters, {
      [this.props.filter.key]: options,
    });
    this.props.updateActiveFilters(newSearchFilters);
  };

  renderOptions() {
    if (!this.props.isExpanded) {
      return false;
    }

    const agg = this.props.agg;

    return this.props.filter.options.map((option) => (
      <SearchFilterOption
        rootKey={this.props.filter.key}
        key={option.value}
        hideable={this.props.filter.hideable}
        aggBucket={
          agg ? agg.buckets.find((b) => b.key === option.value) : undefined
        }
        option={option}
        selectedOptions={this.props.activeFilters[this.props.filter.key] || []}
        updateSelectedOptions={this.updateActiveSearchFilters}
        missingAggValue={this.props.missingAggValue}
      />
    ));
  }

  render() {
    return (
      <div className="sidebar__group">
        <div className="sidebar__item" onClick={this.toggleExpanded}>
          <MenuChevron expanded={this.props.isExpanded} />
          <span className="sidebar__title__text">
            {this.props.filter.display
              ? this.props.filter.display
              : this.props.filter.value}
          </span>
        </div>
        {this.renderOptions()}
      </div>
    );
  }
}
