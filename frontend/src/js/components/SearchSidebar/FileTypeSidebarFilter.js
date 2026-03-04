import React from "react";
import PropTypes from "prop-types";

import { MenuChevron } from "../UtilComponents/MenuChevron";
import { TriStateCheckbox } from "../UtilComponents/TriStateCheckbox";
import {
  FILE_TYPE_CATEGORIES,
  mimeToCategory,
} from "../Search/fileTypeCategories";

/** Tri-state values: unchecked → included → excluded → unchecked */
const STATE_OFF = "off";
const STATE_POSITIVE = "positive";
const STATE_NEGATIVE = "negative";

/**
 * Sidebar filter for file types, operating at category level.
 *
 * Categories (PDF, Images, Spreadsheets …) get tri-state checkboxes:
 *   off → positive (include) → negative (exclude) → off
 *
 * Individual MIME types are shown beneath each category with
 * counts only — no checkbox — purely informational.
 *
 * Reads / writes the same category keys as the File Type chip.
 */
export default class FileTypeSidebarFilter extends React.Component {
  static propTypes = {
    /** Currently-selected positive category keys */
    positiveCategories: PropTypes.arrayOf(PropTypes.string).isRequired,
    /** Currently-selected negative (excluded) category keys */
    negativeCategories: PropTypes.arrayOf(PropTypes.string).isRequired,
    /** Called with { positive: string[], negative: string[] } after a toggle */
    onToggleCategory: PropTypes.func.isRequired,
    /** mimeTypes agg bucket from the search response (may be undefined) */
    agg: PropTypes.shape({
      key: PropTypes.string,
      buckets: PropTypes.array,
    }),
    /** Whether the top-level "File Types" group is expanded */
    isExpanded: PropTypes.bool.isRequired,
    /** Toggle the group expansion state */
    setExpanded: PropTypes.func.isRequired,
  };

  state = {
    /** Set of category keys whose MIME sub-list is expanded */
    expandedCategories: new Set(),
  };

  toggleCategoryExpanded = (catKey) => {
    this.setState((prev) => {
      const next = new Set(prev.expandedCategories);
      if (next.has(catKey)) next.delete(catKey);
      else next.add(catKey);
      return { expandedCategories: next };
    });
  };

  /**
   * Cycle a category through: off → positive → negative → off
   */
  toggleCategory = (catKey, e) => {
    e.stopPropagation();
    const { positiveCategories, negativeCategories, onToggleCategory } =
      this.props;
    const state = this.getCategoryState(catKey);

    let nextPositive = [...positiveCategories];
    let nextNegative = [...negativeCategories];

    if (state === STATE_OFF) {
      // off → positive
      nextPositive.push(catKey);
    } else if (state === STATE_POSITIVE) {
      // positive → negative
      nextPositive = nextPositive.filter((k) => k !== catKey);
      nextNegative.push(catKey);
    } else {
      // negative → off
      nextNegative = nextNegative.filter((k) => k !== catKey);
    }

    onToggleCategory({ positive: nextPositive, negative: nextNegative });
  };

  /** Return the tri-state for a given category key */
  getCategoryState(catKey) {
    if (this.props.positiveCategories.includes(catKey)) return STATE_POSITIVE;
    if (this.props.negativeCategories.includes(catKey)) return STATE_NEGATIVE;
    return STATE_OFF;
  }

  /**
   * Build a map: categoryKey → totalCount from the ES agg buckets.
   *
   * The agg tree groups MIMEs under media-type prefixes ("image/", "application/", …).
   * A single category can span multiple prefixes (e.g. "spreadsheet" covers
   * application/* and text/csv), so we walk every leaf bucket, map it to its
   * category, and sum.
   */
  buildCategoryCounts() {
    const counts = new Map(); // categoryKey → number
    const mimeCounts = new Map(); // full MIME → number
    let uncategorisedCount = 0;
    const uncategorisedMimes = []; // [{key, count}]
    const agg = this.props.agg;
    if (!agg || !agg.buckets)
      return { counts, mimeCounts, uncategorisedCount, uncategorisedMimes };

    agg.buckets.forEach((parentBucket) => {
      const subBuckets = parentBucket.buckets || [];
      subBuckets.forEach((b) => {
        mimeCounts.set(b.key, b.count);
        const cat = mimeToCategory(b.key);
        if (cat) {
          counts.set(cat, (counts.get(cat) || 0) + b.count);
        } else {
          uncategorisedCount += b.count;
          uncategorisedMimes.push({ key: b.key, count: b.count });
        }
      });
    });
    return { counts, mimeCounts, uncategorisedCount, uncategorisedMimes };
  }

  renderMimeSubItems(category, mimeCounts) {
    if (!this.state.expandedCategories.has(category.value)) return null;

    const items = category.mimes
      .filter((m) => mimeCounts.has(m))
      .map((m) => (
        <div key={m} className="sidebar__item sidebar__mime-info">
          <div className="sidebar__chevron-container" />
          <div className="sidebar__item__text">{m}</div>
          <div className="sidebar__count">{mimeCounts.get(m)}</div>
        </div>
      ));

    return items.length > 0 ? items : null;
  }

  renderOtherRow(uncategorisedCount, uncategorisedMimes) {
    if (uncategorisedCount === 0) return null;

    const isExpanded = this.state.expandedCategories.has("__other");

    return (
      <div key="__other">
        <div
          className="sidebar__filtervalue"
          onClick={() => this.toggleCategoryExpanded("__other")}
        >
          <div className="sidebar__item sidebar__mime-info">
            <div className="sidebar__chevron-container">
              {uncategorisedMimes.length > 0 && (
                <MenuChevron expanded={isExpanded} />
              )}
            </div>
            <div className="sidebar__item__text">Other</div>
            <div className="sidebar__count">{uncategorisedCount}</div>
          </div>
        </div>
        {isExpanded &&
          uncategorisedMimes.map((m) => (
            <div key={m.key} className="sidebar__item sidebar__mime-info">
              <div className="sidebar__chevron-container" />
              <div className="sidebar__item__text">{m.key}</div>
              <div className="sidebar__count">{m.count}</div>
            </div>
          ))}
      </div>
    );
  }

  renderCategories() {
    if (!this.props.isExpanded) return null;

    const { counts, mimeCounts, uncategorisedCount, uncategorisedMimes } =
      this.buildCategoryCounts();
    const hasResults = this.props.agg && this.props.agg.buckets;

    const rows = FILE_TYPE_CATEGORIES.map((cat) => {
      const count = counts.get(cat.value) || 0;
      const catState = this.getCategoryState(cat.value);
      const isActive = catState !== STATE_OFF;

      // Hide categories with zero results (unless active)
      if (hasResults && count === 0 && !isActive) return null;

      const hasMimeSubs = cat.mimes.some((m) => mimeCounts.has(m));
      const isExpanded = this.state.expandedCategories.has(cat.value);

      return (
        <div key={cat.value}>
          <div
            className="sidebar__filtervalue"
            onClick={() => this.toggleCategoryExpanded(cat.value)}
          >
            <div className="sidebar__item">
              <div className="sidebar__chevron-container">
                {hasMimeSubs && <MenuChevron expanded={isExpanded} />}
              </div>
              <div className="sidebar__item__text">{cat.label}</div>
              {hasResults && <div className="sidebar__count">{count}</div>}
              <TriStateCheckbox
                state={catState}
                onClick={(e) => this.toggleCategory(cat.value, e)}
              />
            </div>
          </div>
          {this.renderMimeSubItems(cat, mimeCounts)}
        </div>
      );
    });

    rows.push(this.renderOtherRow(uncategorisedCount, uncategorisedMimes));
    return rows;
  }

  render() {
    return (
      <div className="sidebar__group">
        <div className="sidebar__item" onClick={this.props.setExpanded}>
          <MenuChevron expanded={this.props.isExpanded} />
          <span className="sidebar__title__text">File Types</span>
        </div>
        {this.renderCategories()}
      </div>
    );
  }
}
