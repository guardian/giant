import React from "react";

import { MenuChevron } from "../UtilComponents/MenuChevron";
import { TriStateCheckbox } from "../UtilComponents/TriStateCheckbox";
import { TriState, getTriState, triStateCycle } from "../Search/triStateCycle";
import { PolarityValues } from "../Search/chipParsing";
import {
  FILE_TYPE_CATEGORIES,
  FileTypeCategory,
  mimeToCategory,
} from "../Search/fileTypeCategories";

interface AggBucket {
  key: string;
  count?: number;
  buckets?: AggBucket[];
}

interface FileTypeSidebarFilterProps {
  positiveCategories: string[];
  negativeCategories: string[];
  onToggleCategory: (values: PolarityValues) => void;
  agg?: { key: string; buckets?: AggBucket[] };
  isExpanded: boolean;
  setExpanded: () => void;
}

export interface FileTypeSidebarFilterState {
  expandedCategories: Set<string>;
}

export default class FileTypeSidebarFilter extends React.Component<
  FileTypeSidebarFilterProps,
  FileTypeSidebarFilterState
> {
  state: FileTypeSidebarFilterState = {
    expandedCategories: new Set<string>(),
  };

  toggleCategoryExpanded = (catKey: string) => {
    this.setState((prev) => {
      const next = new Set(prev.expandedCategories);
      if (next.has(catKey)) next.delete(catKey);
      else next.add(catKey);
      return { expandedCategories: next };
    });
  };

  toggleCategory = (catKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = triStateCycle(
      catKey,
      this.props.positiveCategories,
      this.props.negativeCategories,
    );
    this.props.onToggleCategory(result);
  };

  getCategoryState(catKey: string): TriState {
    return getTriState(
      catKey,
      this.props.positiveCategories,
      this.props.negativeCategories,
    );
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
    const counts = new Map<string, number>();
    const mimeCounts = new Map<string, number>();
    let uncategorisedCount = 0;
    const uncategorisedMimes: { key: string; count: number }[] = [];
    const agg = this.props.agg;
    if (!agg || !agg.buckets)
      return { counts, mimeCounts, uncategorisedCount, uncategorisedMimes };

    agg.buckets.forEach((parentBucket) => {
      const subBuckets = parentBucket.buckets || [];
      subBuckets.forEach((b) => {
        mimeCounts.set(b.key, b.count ?? 0);
        const cat = mimeToCategory(b.key);
        if (cat) {
          counts.set(cat, (counts.get(cat) || 0) + (b.count ?? 0));
        } else {
          uncategorisedCount += b.count ?? 0;
          uncategorisedMimes.push({ key: b.key, count: b.count ?? 0 });
        }
      });
    });
    return { counts, mimeCounts, uncategorisedCount, uncategorisedMimes };
  }

  renderMimeSubItems(
    category: FileTypeCategory,
    mimeCounts: Map<string, number>,
  ) {
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

  renderOtherRow(
    uncategorisedCount: number,
    uncategorisedMimes: { key: string; count: number }[],
  ) {
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
                <MenuChevron
                  expanded={isExpanded}
                  onClick={(e) => {
                    e.stopPropagation();
                    this.toggleCategoryExpanded("__other");
                  }}
                />
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
      const isActive = catState !== "off";

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
                {hasMimeSubs && (
                  <MenuChevron
                    expanded={isExpanded}
                    onClick={(e) => {
                      e.stopPropagation();
                      this.toggleCategoryExpanded(cat.value);
                    }}
                  />
                )}
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
          <MenuChevron
            expanded={this.props.isExpanded}
            onClick={(e) => {
              e.stopPropagation();
              this.props.setExpanded();
            }}
          />
          <span className="sidebar__title__text">File Types</span>
        </div>
        {this.renderCategories()}
      </div>
    );
  }
}
