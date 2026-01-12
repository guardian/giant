import React from "react";
import PropTypes from "prop-types";
import ReactTooltip from "react-tooltip";
import InfoIcon from "react-icons/lib/md/info-outline";

import { searchFilter, searchFilterOption } from "../../types/SearchFilter.js";
import { searchResultsPropType } from "../../types/SearchResults";
import { MenuChevron } from "../UtilComponents/MenuChevron";
import { Checkbox } from "../UtilComponents/Checkbox";
import markdownToHtml from "../../util/markdownToHtml";
import _get from "lodash/get";

import { connect } from "react-redux";

export class SearchFilterValueUntranslated extends React.Component {
  static propTypes = {
    currentResults: searchResultsPropType,
    filter: searchFilter,
    rootKey: PropTypes.string.isRequired,
    optionValue: searchFilterOption.isRequired,
    selected: PropTypes.bool.isRequired,
    toggleSelected: PropTypes.func.isRequired,
    expandable: PropTypes.bool,
    expanded: PropTypes.bool,
    disabled: PropTypes.bool,
    indeterminate: PropTypes.bool,
    onClick: PropTypes.func,
    aggBucket: PropTypes.object,
    hideable: PropTypes.bool.isRequired,
    missingAggValue: PropTypes.string.isRequired,
  };

  onClick = (e) => {
    if (this.props.onClick) {
      this.props.onClick(e);
    }
  };

  toggleOption = (e) => {
    e.stopPropagation();
    this.props.toggleSelected(this.props.optionValue.value);
  };

  isActiveFilter = () => {
    const activeFilters = _get(
      this.props,
      "activeFilters." + this.props.rootKey,
    );
    if (activeFilters) {
      return activeFilters.some((filter) =>
        filter.startsWith(this.props.optionValue.value),
      );
    } else {
      return false;
    }
  };

  renderAggCounts = () => {
    if (this.props.aggBucket) {
      return <div className="sidebar__count">{this.props.aggBucket.count}</div>;
    }

    if (!this.props.aggBucket && this.props.currentResults) {
      return <div className="sidebar__count">{this.props.missingAggValue}</div>;
    }

    return false;
  };

  render() {
    const { explanation } = this.props.optionValue;
    // If this can be hidden, we dont have a current search, this filter is not selected and we don't have any hits then hide this option
    if (
      this.props.hideable &&
      this.props.currentResults &&
      !this.isActiveFilter() &&
      this.props.aggBucket === undefined
    ) {
      return false;
    }

    return (
      <div
        className={
          this.props.disabled
            ? "sidebar__item sidebar__item--disabled"
            : "sidebar__item"
        }
        onClick={this.onClick}
      >
        <div className="sidebar__chevron-container">
          {this.props.expandable ? (
            <MenuChevron expanded={this.props.expanded || false} />
          ) : (
            false
          )}
        </div>
        <div className="sidebar__item__text">
          {this.props.optionValue.display
            ? this.props.optionValue.display
            : this.props.optionValue.value}
          {explanation ? (
            <InfoIcon
              className="info-icon"
              data-tip={markdownToHtml(explanation)}
              data-effect="solid"
            />
          ) : (
            false
          )}
        </div>
        {this.renderAggCounts()}
        <Checkbox
          selected={this.props.selected}
          indeterminate={this.props.indeterminate}
          onClick={this.toggleOption}
        />
        <ReactTooltip insecure={false} html={true} />
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    activeFilters: state.urlParams && state.urlParams.filters,
    currentResults: state.search.currentResults,
  };
}

export default connect(mapStateToProps)(SearchFilterValueUntranslated);
