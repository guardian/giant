import React from "react";
import PropTypes from "prop-types";

import { MenuChevron } from "../UtilComponents/MenuChevron";
import { TriStateCheckbox } from "../UtilComponents/TriStateCheckbox";

/** Tri-state values: off → positive → negative → off */
const STATE_OFF = "off";
const STATE_POSITIVE = "positive";
const STATE_NEGATIVE = "negative";

/**
 * A generic sidebar filter section with tri-state checkboxes.
 *
 * Each option cycles: neutral (off) → included (positive) → excluded (negative) → neutral.
 *
 * Semantics:
 *   - All neutral: no filter applied → show everything
 *   - Has includes: only included items shown; neutral items are omitted
 *   - Excludes only: everything except excluded items
 *   - Has includes + excludes: includes shown, excludes not shown
 *
 * Supports optional suboptions (expandable sub-items with counts, no independent checkboxes).
 */
export default class TriStateSidebarSection extends React.Component {
  static propTypes = {
    /** Section title (e.g. "Workspaces", "Datasets") */
    title: PropTypes.string.isRequired,
    /** Filter key used for expansion state */
    filterKey: PropTypes.string.isRequired,
    /** Options from the backend /api/filters response */
    options: PropTypes.arrayOf(
      PropTypes.shape({
        value: PropTypes.string.isRequired,
        display: PropTypes.string,
        suboptions: PropTypes.array,
      }),
    ).isRequired,
    /** Currently-included values */
    positiveValues: PropTypes.arrayOf(PropTypes.string).isRequired,
    /** Currently-excluded values */
    negativeValues: PropTypes.arrayOf(PropTypes.string).isRequired,
    /** Called with { positive: string[], negative: string[] } after a toggle */
    onToggle: PropTypes.func.isRequired,
    /** Agg bucket from the search response (may be undefined) */
    agg: PropTypes.shape({
      key: PropTypes.string,
      buckets: PropTypes.array,
    }),
    /** Whether this section is expanded */
    isExpanded: PropTypes.bool.isRequired,
    /** Toggle the section expansion state */
    setExpanded: PropTypes.func.isRequired,
    /** Value to show when agg count is missing (e.g. "0" or "") */
    missingAggValue: PropTypes.string,
  };

  static defaultProps = {
    missingAggValue: "0",
  };

  state = {
    /** Set of option values whose sub-items are expanded */
    expandedOptions: new Set(),
  };

  toggleOptionExpanded = (optionValue) => {
    this.setState((prev) => {
      const next = new Set(prev.expandedOptions);
      if (next.has(optionValue)) next.delete(optionValue);
      else next.add(optionValue);
      return { expandedOptions: next };
    });
  };

  /** Get the tri-state for a given option value */
  getOptionState(value) {
    if (this.props.positiveValues.includes(value)) return STATE_POSITIVE;
    if (this.props.negativeValues.includes(value)) return STATE_NEGATIVE;
    return STATE_OFF;
  }

  /**
   * Cycle an option through: off → positive → negative → off
   */
  toggleOption = (value, e) => {
    e.stopPropagation();
    const { positiveValues, negativeValues, onToggle } = this.props;
    const state = this.getOptionState(value);

    let nextPositive = [...positiveValues];
    let nextNegative = [...negativeValues];

    if (state === STATE_OFF) {
      nextPositive.push(value);
    } else if (state === STATE_POSITIVE) {
      nextPositive = nextPositive.filter((v) => v !== value);
      nextNegative.push(value);
    } else {
      nextNegative = nextNegative.filter((v) => v !== value);
    }

    onToggle({ positive: nextPositive, negative: nextNegative });
  };

  /** Find the agg bucket for a given option value */
  findAggBucket(value) {
    const agg = this.props.agg;
    if (!agg || !agg.buckets) return undefined;
    return agg.buckets.find((b) => b.key === value);
  }

  renderAggCount(value) {
    const bucket = this.findAggBucket(value);
    if (bucket) {
      return <div className="sidebar__count">{bucket.count}</div>;
    }
    if (this.props.agg) {
      return <div className="sidebar__count">{this.props.missingAggValue}</div>;
    }
    return null;
  }

  renderSubOptions(option) {
    if (!this.state.expandedOptions.has(option.value)) return null;
    if (!option.suboptions || option.suboptions.length === 0) return null;

    return option.suboptions.map((sub) => {
      const subBucket = this.findSubBucket(option.value, sub.value);
      // Hide sub-items with no results unless the parent is active
      if (
        this.props.agg &&
        !subBucket &&
        this.getOptionState(option.value) === STATE_OFF
      ) {
        return null;
      }

      return (
        <div key={sub.value} className="sidebar__item sidebar__mime-info">
          <div className="sidebar__chevron-container" />
          <div className="sidebar__item__text">{sub.display || sub.value}</div>
          {subBucket && <div className="sidebar__count">{subBucket.count}</div>}
        </div>
      );
    });
  }

  /** Find a sub-bucket within a parent option's agg */
  findSubBucket(parentValue, subValue) {
    const parentBucket = this.findAggBucket(parentValue);
    if (!parentBucket || !parentBucket.buckets) return undefined;
    return parentBucket.buckets.find((b) => b.key === subValue);
  }

  renderOptions() {
    if (!this.props.isExpanded) return null;

    return this.props.options.map((option) => {
      const optState = this.getOptionState(option.value);
      const isActive = optState !== STATE_OFF;
      const hasSuboptions = option.suboptions && option.suboptions.length > 0;
      const isSubExpanded = this.state.expandedOptions.has(option.value);

      return (
        <div key={option.value}>
          <div
            className="sidebar__filtervalue"
            onClick={() =>
              hasSuboptions && this.toggleOptionExpanded(option.value)
            }
          >
            <div className={isActive ? "sidebar__item" : "sidebar__item"}>
              <div className="sidebar__chevron-container">
                {hasSuboptions && <MenuChevron expanded={isSubExpanded} />}
              </div>
              <div className="sidebar__item__text">
                {option.display || option.value}
              </div>
              {this.renderAggCount(option.value)}
              <TriStateCheckbox
                state={optState}
                onClick={(e) => this.toggleOption(option.value, e)}
              />
            </div>
          </div>
          {this.renderSubOptions(option)}
        </div>
      );
    });
  }

  render() {
    return (
      <div className="sidebar__group">
        <div className="sidebar__item" onClick={this.props.setExpanded}>
          <MenuChevron expanded={this.props.isExpanded} />
          <span className="sidebar__title__text">{this.props.title}</span>
        </div>
        {this.renderOptions()}
      </div>
    );
  }
}
