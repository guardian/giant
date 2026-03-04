import React from "react";
import PropTypes from "prop-types";

import { ProgressAnimation } from "../UtilComponents/ProgressAnimation";
import { suggestedFieldsPropType } from "../../types/SuggestedFields";

import ActiveFiltersBar from "./ActiveFiltersBar";
import AddFilterModal from "./AddFilterModal";
import { isMultiValueChip } from "./ActiveFilterChip";
import { parseChips, rebuildQ } from "./chipParsing";
import {
  CHIP_NAME_DATASET,
  CHIP_NAME_WORKSPACE,
} from "./chipNames";
import {
  CHIP_NAME_DATE_RANGE,
  CHIP_KIND_SINGLE,
  CHIP_KIND_MULTI,
  CHIP_KIND_DATE_RANGE,
  CHIP_TYPE_DATE_RANGE,
} from "./chipNames";

/**
 * Extract plain text from a JSON-encoded q string.
 * Joins all string segments, ignoring chip objects.
 */
export function extractPlainText(q) {
  if (!q) return "";
  try {
    const parsed = JSON.parse(q);
    if (!Array.isArray(parsed)) return q;
    return parsed
      .filter((s) => typeof s === "string")
      .join(" ")
      .trim();
  } catch (e) {
    return q;
  }
}

/**
 * Wrap plain text into JSON-encoded q format.
 */
export function wrapPlainText(text) {
  return JSON.stringify([text]);
}

export default class SearchBox extends React.Component {
  static propTypes = {
    q: PropTypes.string.isRequired,
    isSearchInProgress: PropTypes.bool.isRequired,
    updateVisibleText: PropTypes.func.isRequired,
    /** Update visible text AND trigger debounced search (for chip actions) */
    onFilterChange: PropTypes.func.isRequired,
    resetQuery: PropTypes.func.isRequired,
    suggestedFields: PropTypes.arrayOf(suggestedFieldsPropType),
    /** Sidebar filter definitions from /api/filters (for workspace/dataset options) */
    sidebarFilters: PropTypes.array,
    updateSearchText: PropTypes.func.isRequired,
  };

  state = {
    modalOpen: false,
    editingChip: null,
    editingChipIndex: -1,
  };

  focus = () => {
    if (this.searchInput) {
      this.searchInput.focus();
    }
  };

  select = () => {
    if (this.searchInput) {
      this.searchInput.select();
    }
  };

  /**
   * Parse the current q value — delegates to the standalone parseChips().
   */
  parseChips() {
    return parseChips(this.props.q, this.props.suggestedFields);
  }

  /**
   * Rebuild the full q value — delegates to the standalone rebuildQ().
   */
  rebuildQ(definedChips, textOnlyQ) {
    return rebuildQ(definedChips, textOnlyQ);
  }

  handleRemoveChip = (index) => {
    const { definedChips, textOnlyQ } = this.parseChips();
    const newChips = definedChips.filter((_, i) => i !== index);
    const newQ = this.rebuildQ(newChips, textOnlyQ);
    this.props.onFilterChange(newQ);
  };

  handleToggleNegate = (index) => {
    const { definedChips, textOnlyQ } = this.parseChips();
    const chip = definedChips[index];
    const targetNegate = !chip.negate;

    if (chip.kind === CHIP_KIND_MULTI) {
      // Check if there's already a chip of the same name with the target polarity
      const targetIndex = definedChips.findIndex(
        (c, i) => i !== index && c.name === chip.name && c.kind === CHIP_KIND_MULTI && c.negate === targetNegate
      );
      if (targetIndex !== -1) {
        // Merge values into the existing target chip — then remove the source
        const merged = { ...definedChips[targetIndex] };
        const mergedValues = [...merged.values];
        (chip.values || []).forEach((v) => {
          if (!mergedValues.includes(v)) mergedValues.push(v);
        });
        merged.values = mergedValues;
        const newChips = definedChips
          .map((c, i) => (i === targetIndex ? merged : c))
          .filter((_, i) => i !== index);
        const newQ = this.rebuildQ(newChips, textOnlyQ);
        this.props.onFilterChange(newQ);
        return;
      }
    }

    // Simple flip for single-value chips or when no same-name target exists
    const newChips = definedChips.map((c, i) =>
      i === index ? { ...c, negate: targetNegate } : c
    );
    const newQ = this.rebuildQ(newChips, textOnlyQ);
    this.props.onFilterChange(newQ);
  };

  handleEditChipValue = (index, newValueOrValues) => {
    const { definedChips, textOnlyQ } = this.parseChips();
    let newChips = definedChips.map((c, i) => {
      if (i !== index) return c;
      switch (c.kind) {
        case CHIP_KIND_DATE_RANGE:
          if (newValueOrValues && typeof newValueOrValues === "object" && !Array.isArray(newValueOrValues)) {
            return { ...c, from: newValueOrValues.from, to: newValueOrValues.to };
          }
          return c;
        case CHIP_KIND_MULTI: {
          const values = Array.isArray(newValueOrValues) ? newValueOrValues : [newValueOrValues];
          return { ...c, values };
        }
        case CHIP_KIND_SINGLE:
        default:
          return { ...c, value: newValueOrValues };
      }
    });
    // Remove multi-value chips with no values left (reverts to dormant)
    newChips = newChips.filter((c) => !(c.kind === CHIP_KIND_MULTI && (c.values || []).length === 0));
    // Remove date range chips with both dates cleared
    newChips = newChips.filter((c) => !(c.kind === CHIP_KIND_DATE_RANGE && !c.from && !c.to));
    const newQ = this.rebuildQ(newChips, textOnlyQ);
    this.props.onFilterChange(newQ);
  };

  /**
   * Activate a dormant default chip — creates a real chip in the query string.
   * Accepts either a single value (string) or multiple values (string[]).
   * negate: whether the user toggled exclude before committing.
   *
   * For multi-value chips, if there’s already an active chip of the same
   * name+polarity, the new values are merged into it.
   */
  handleActivateDefault = (name, valueOrValues, chipType, negate = false) => {
    const { definedChips, textOnlyQ } = this.parseChips();

    // Date Range activation — valueOrValues is { from, to }
    if (chipType === CHIP_TYPE_DATE_RANGE && valueOrValues && typeof valueOrValues === "object" && !Array.isArray(valueOrValues)) {
      // Merge into an existing Date Range chip of the same polarity if present
      const existingIndex = definedChips.findIndex(
        (c) => c.kind === CHIP_KIND_DATE_RANGE && c.negate === negate
      );
      if (existingIndex !== -1) {
        const merged = { ...definedChips[existingIndex] };
        if (valueOrValues.from) merged.from = valueOrValues.from;
        if (valueOrValues.to) merged.to = valueOrValues.to;
        const newChips = definedChips.map((c, i) => (i === existingIndex ? merged : c));
        const newQ = this.rebuildQ(newChips, textOnlyQ);
        this.props.onFilterChange(newQ);
        return;
      }
      const newChip = {
        kind: CHIP_KIND_DATE_RANGE,
        name: CHIP_NAME_DATE_RANGE,
        negate,
        chipType: CHIP_TYPE_DATE_RANGE,
        from: valueOrValues.from || "",
        to: valueOrValues.to || "",
      };
      const newChips = [...definedChips, newChip];
      const newQ = this.rebuildQ(newChips, textOnlyQ);
      this.props.onFilterChange(newQ);
      return;
    }

    const multi = isMultiValueChip(name);
    const kind = multi ? CHIP_KIND_MULTI : CHIP_KIND_SINGLE;
    const incomingValues = multi
      ? (Array.isArray(valueOrValues) ? valueOrValues : [valueOrValues])
      : null;

    // Try to merge into an existing chip of the same name+polarity
    if (multi) {
      const existingIndex = definedChips.findIndex(
        (c) => c.name === name && c.kind === CHIP_KIND_MULTI && c.negate === negate
      );
      if (existingIndex !== -1) {
        const merged = { ...definedChips[existingIndex] };
        const mergedValues = [...merged.values];
        incomingValues.forEach((v) => {
          if (!mergedValues.includes(v)) mergedValues.push(v);
        });
        merged.values = mergedValues;
        const newChips = definedChips.map((c, i) => (i === existingIndex ? merged : c));
        const newQ = this.rebuildQ(newChips, textOnlyQ);
        this.props.onFilterChange(newQ);
        return;
      }
    }

    // No existing chip to merge into — create a new one
    const newChip = {
      kind,
      name,
      negate,
      chipType,
      ...(multi
        ? { values: incomingValues }
        : { value: valueOrValues }),
    };
    const newChips = [...definedChips, newChip];
    const newQ = this.rebuildQ(newChips, textOnlyQ);
    this.props.onFilterChange(newQ);
  };

  // ── Plain text search input helpers ────────────────────────────────

  /**
   * Get the plain text portion of the query (without filter chips).
   */
  getSearchText() {
    const { textOnlyQ } = this.parseChips();
    return extractPlainText(textOnlyQ);
  }

  /**
   * When the user types in the plain text search input,
   * merge it back with the existing filter chips.
   */
  handleSearchTextChange = (e) => {
    const newText = e.target.value;
    const { definedChips } = this.parseChips();
    const newTextQ = wrapPlainText(newText);
    if (definedChips.length > 0) {
      const merged = this.rebuildQ(definedChips, newTextQ);
      this.props.updateVisibleText(merged);
    } else {
      this.props.updateVisibleText(newTextQ);
    }
  };

  handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      this.props.updateSearchText();
    }
  };

  // ── Modal handlers ───────────────────────────────────────────────

  handleOpenAddFilter = (chip, chipIndex) => {
    if (chip && chipIndex >= 0) {
      // Edit mode
      this.setState({ modalOpen: true, editingChip: chip, editingChipIndex: chipIndex });
    } else {
      // New filter mode
      this.setState({ modalOpen: true, editingChip: null, editingChipIndex: -1 });
    }
  };

  handleCloseModal = () => {
    this.setState({ modalOpen: false, editingChip: null, editingChipIndex: -1 });
  };

  /**
   * Called when the user confirms in the Add Filter modal.
   * chip: the chip data from the modal form.
   * editIndex: -1 for new, >= 0 for editing an existing chip.
   */
  handleModalConfirm = (chip, editIndex) => {
    if (editIndex >= 0) {
      // Editing an existing chip — replace it
      const { definedChips, textOnlyQ } = this.parseChips();
      const newChips = definedChips.map((c, i) => (i === editIndex ? chip : c));
      const newQ = this.rebuildQ(newChips, textOnlyQ);
      this.props.onFilterChange(newQ);
    } else {
      // Adding a new chip — delegate to handleActivateDefault for merge logic
      switch (chip.kind) {
        case CHIP_KIND_DATE_RANGE:
          this.handleActivateDefault(
            chip.name,
            { from: chip.from, to: chip.to },
            chip.chipType,
            chip.negate
          );
          break;
        case CHIP_KIND_MULTI:
          this.handleActivateDefault(chip.name, chip.values, chip.chipType, chip.negate);
          break;
        case CHIP_KIND_SINGLE:
        default:
          this.handleActivateDefault(chip.name, chip.value, chip.chipType, chip.negate);
          break;
      }
    }
    this.handleCloseModal();
  };

  /**
   * Build the available filters list, augmenting suggestedFields with
   * Dataset and Workspace options derived from the sidebar /api/filters data.
   */
  getAvailableFilters() {
    const base = this.props.suggestedFields || [];
    const sidebarFilters = this.props.sidebarFilters || [];

    const extra = [];

    // "ingestion" filter key → Dataset chip options
    const ingestionFilter = sidebarFilters.find((f) => f.key === "ingestion");
    if (ingestionFilter) {
      extra.push({
        name: CHIP_NAME_DATASET,
        type: "dataset",
        options: ingestionFilter.options.map((o) => ({
          value: o.value,
          label: o.display,
        })),
      });
    }

    // "workspace" filter key → Workspace chip options
    const workspaceFilter = sidebarFilters.find((f) => f.key === "workspace");
    if (workspaceFilter) {
      extra.push({
        name: CHIP_NAME_WORKSPACE,
        type: "workspace",
        options: workspaceFilter.options.map((o) => ({
          value: o.value,
          label: o.display,
        })),
      });
    }

    return [...base, ...extra];
  }

  render() {
    const { definedChips } = this.parseChips();
    const availableFilters = this.getAvailableFilters();

    const spinner = this.props.isSearchInProgress ? (
      <ProgressAnimation />
    ) : (
      false
    );
    return (
      <div>
        <div className="search-box">
          <div className="search-box__input">
            <input
              ref={(el) => (this.searchInput = el)}
              className="search-box__text-input"
              type="text"
              value={this.getSearchText()}
              onChange={this.handleSearchTextChange}
              onKeyDown={this.handleSearchKeyDown}
              placeholder="Search…"
              aria-label="Search query"
            />
          </div>
          <div className="search__actions">{spinner}</div>
          <div className={"search__buttons"}>
            <button
              className="btn"
              title="Search"
              onClick={this.props.updateSearchText}
              disabled={this.props.isSearchInProgress}
            >
              Search
            </button>
            <button
              className="btn"
              title="Clear search query and filters"
              onClick={this.props.resetQuery}
              disabled={this.props.isSearchInProgress}
            >
              Clear
            </button>
          </div>
        </div>
        <ActiveFiltersBar
          chips={definedChips}
          availableFilters={availableFilters}
          onRemoveChip={this.handleRemoveChip}
          onToggleNegate={this.handleToggleNegate}
          onEditChipValue={this.handleEditChipValue}
          onActivateDefault={this.handleActivateDefault}
          onOpenAddFilter={this.handleOpenAddFilter}
        />
        <AddFilterModal
          isOpen={this.state.modalOpen}
          editingChip={this.state.editingChip}
          editingChipIndex={this.state.editingChipIndex}
          availableFilters={availableFilters}
          onConfirm={this.handleModalConfirm}
          onClose={this.handleCloseModal}
        />
      </div>
    );
  }
}
