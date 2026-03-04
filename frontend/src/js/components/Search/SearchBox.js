import React from "react";
import PropTypes from "prop-types";

import { ProgressAnimation } from "../UtilComponents/ProgressAnimation";
import { suggestedFieldsPropType } from "../../types/SuggestedFields";

import InputSupper from "../UtilComponents/InputSupper";
import ActiveFiltersBar from "./ActiveFiltersBar";
import { isMultiValueChip } from "./ActiveFilterChip";
import { parseChips, rebuildQ } from "./chipParsing";

export default class SearchBox extends React.Component {
  static propTypes = {
    q: PropTypes.string.isRequired,
    isSearchInProgress: PropTypes.bool.isRequired,
    updateVisibleText: PropTypes.func.isRequired,
    /** Update visible text AND trigger debounced search (for chip actions) */
    onFilterChange: PropTypes.func.isRequired,
    resetQuery: PropTypes.func.isRequired,
    suggestedFields: PropTypes.arrayOf(suggestedFieldsPropType),
    updateSearchText: PropTypes.func.isRequired,
  };

  focus = () => {
    if (this.searchInput && this.searchInput.focus) {
      try {
        this.searchInput.focus();
      } catch (e) {
        // InputSupper's internal ref may not be ready yet
      }
    }
  };

  select = () => {
    if (this.searchInput && this.searchInput.select) {
      try {
        this.searchInput.select();
      } catch (e) {
        // InputSupper's internal ref may not be ready yet
      }
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

    if (chip.multiValue) {
      // Check if there's already a chip of the same name with the target polarity
      const targetIndex = definedChips.findIndex(
        (c, i) => i !== index && c.name === chip.name && c.multiValue && c.negate === targetNegate
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
      if (c.multiValue) {
        const values = Array.isArray(newValueOrValues) ? newValueOrValues : [newValueOrValues];
        return { ...c, values };
      }
      return { ...c, value: newValueOrValues };
    });
    // Remove multi-value chips with no values left (reverts to dormant)
    newChips = newChips.filter((c) => !(c.multiValue && (c.values || []).length === 0));
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
    const multi = isMultiValueChip(name);
    const incomingValues = multi
      ? (Array.isArray(valueOrValues) ? valueOrValues : [valueOrValues])
      : null;

    // Try to merge into an existing chip of the same name+polarity
    if (multi) {
      const existingIndex = definedChips.findIndex(
        (c) => c.name === name && c.multiValue && c.negate === negate
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
      name,
      negate,
      chipType,
      multiValue: multi,
      ...(multi
        ? { values: incomingValues }
        : { value: valueOrValues }),
    };
    const newChips = [...definedChips, newChip];
    const newQ = this.rebuildQ(newChips, textOnlyQ);
    this.props.onFilterChange(newQ);
  };

  /**
   * Build the q value that InputSupper should display (text + in-progress chips only).
   * Completed filter chips are shown in the ActiveFiltersBar instead.
   */
  getInputSupperQ() {
    const { definedChips, textOnlyQ } = this.parseChips();
    return definedChips.length > 0 ? textOnlyQ : this.props.q;
  }

  /**
   * When InputSupper edits its value (typing, adding inline chips, etc.),
   * merge the completed filter chips back in so they aren't lost from q.
   */
  handleInputSupperChange = (newTextOnlyQ) => {
    const { definedChips } = this.parseChips();
    if (definedChips.length > 0) {
      const merged = this.rebuildQ(definedChips, newTextOnlyQ);
      this.props.updateVisibleText(merged);
    } else {
      this.props.updateVisibleText(newTextOnlyQ);
    }
  };

  render() {
    const { definedChips } = this.parseChips();

    const spinner = this.props.isSearchInProgress ? (
      <ProgressAnimation />
    ) : (
      false
    );
    return (
      <div>
        <div className="search-box">
          <InputSupper
            ref={(s) => (this.searchInput = s)}
            className="search-box__input"
            value={this.getInputSupperQ()}
            chips={this.props.suggestedFields}
            onChange={this.handleInputSupperChange}
            updateSearchText={this.props.updateSearchText}
          />
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
          availableFilters={this.props.suggestedFields}
          onRemoveChip={this.handleRemoveChip}
          onToggleNegate={this.handleToggleNegate}
          onEditChipValue={this.handleEditChipValue}
          onActivateDefault={this.handleActivateDefault}
        />
      </div>
    );
  }
}
