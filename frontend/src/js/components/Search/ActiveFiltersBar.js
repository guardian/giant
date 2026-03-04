import React from "react";
import PropTypes from "prop-types";
import ActiveFilterChip from "./ActiveFilterChip";
import AddIcon from "react-icons/lib/md/add";
import {
  CHIP_NAME_FILE_TYPE,
  CHIP_NAME_DATE_RANGE,
  CHIP_NAME_HAS_FIELD,
  CHIP_KIND_SINGLE,
  CHIP_KIND_MULTI,
  CHIP_KIND_DATE_RANGE,
  CHIP_TYPE_FILE_TYPE,
  CHIP_TYPE_DATE_RANGE,
  CHIP_TYPE_DROPDOWN,
} from "./chipNames";

/**
 * Default filter chips shown when no filters are active.
 * These act as prompts — showing users what filters are available.
 * Each maps to a chip type with sensible defaults.
 */
const DEFAULT_FILTERS = [
  { name: CHIP_NAME_FILE_TYPE, chipType: CHIP_TYPE_FILE_TYPE, label: CHIP_NAME_FILE_TYPE, kind: CHIP_KIND_MULTI },
  { name: CHIP_NAME_DATE_RANGE, chipType: CHIP_TYPE_DATE_RANGE, label: CHIP_NAME_DATE_RANGE, kind: CHIP_KIND_DATE_RANGE },
  { name: CHIP_NAME_HAS_FIELD, chipType: CHIP_TYPE_DROPDOWN, label: CHIP_NAME_HAS_FIELD, kind: CHIP_KIND_MULTI },
];

/**
 * Renders filter chips below the search box.
 *
 * When the user has active filters, those are shown.
 * When no filters are active, default "dormant" chips are shown
 * as prompts (e.g. "File Types: all") that the user can click to activate.
 */
export default class ActiveFiltersBar extends React.Component {
  static propTypes = {
    chips: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string.isRequired,
        value: PropTypes.string,
        values: PropTypes.arrayOf(PropTypes.string),
        negate: PropTypes.bool.isRequired,
        chipType: PropTypes.string.isRequired,
        kind: PropTypes.oneOf([CHIP_KIND_SINGLE, CHIP_KIND_MULTI, CHIP_KIND_DATE_RANGE]).isRequired,
        options: PropTypes.array,
        workspaceId: PropTypes.string,
        folderId: PropTypes.string,
      })
    ).isRequired,
    /** All available filter definitions from the backend (suggestedFields) */
    availableFilters: PropTypes.array,
    onRemoveChip: PropTypes.func.isRequired,
    onToggleNegate: PropTypes.func.isRequired,
    onEditChipValue: PropTypes.func.isRequired,
    /** Called with (name, value, chipType, negate) when a dormant default chip is activated */
    onActivateDefault: PropTypes.func.isRequired,
    /** Open the "Add Filter" modal (no args = new, with chip+index = edit) */
    onOpenAddFilter: PropTypes.func.isRequired,
  };

  renderMoreFiltersButton() {
    return (
      <button
        className="active-filters-bar__add-btn"
        onClick={() => this.props.onOpenAddFilter()}
        title="Add a filter"
        aria-label="Add a filter"
      >
        <AddIcon className="active-filters-bar__add-icon" />
        More filters
      </button>
    );
  }

  render() {
    const { chips, availableFilters, onRemoveChip, onToggleNegate, onEditChipValue, onActivateDefault } = this.props;

    // Show active chips if we have them
    if (chips.length > 0) {
      // Figure out which default filters are already active.
      // Hide the dormant chip as soon as ANY active chip of that name exists.
      const activeNames = new Set(chips.map((c) => c.name));
      const remainingDefaults = DEFAULT_FILTERS.filter(
        (d) => !activeNames.has(d.name)
      );

      return (
        <div className="active-filters-bar" role="toolbar" aria-label="Active search filters">
          {chips.map((chip, index) => (
            <ActiveFilterChip
              key={`active-${index}`}
              index={index}
              name={chip.name}
              value={chip.value}
              values={chip.values}
              from={chip.from}
              to={chip.to}
              kind={chip.kind}
              negate={chip.negate}
              chipType={chip.chipType}
              options={chip.options}
              onRemove={() => onRemoveChip(index)}
              onToggleNegate={() => onToggleNegate(index)}
              onEditValue={(newValue) => onEditChipValue(index, newValue)}
            />
          ))}
          {remainingDefaults.map((def) => {
            const fieldDef = (availableFilters || []).find((f) => f.name === def.name);
            return (
              <ActiveFilterChip
                key={`default-${def.name}`}
                index={-1}
                name={def.label}
                value={def.kind === CHIP_KIND_MULTI ? undefined : "all"}
                values={def.kind === CHIP_KIND_MULTI ? [] : undefined}
                kind={def.kind}
                negate={false}
                chipType={def.chipType}
                options={fieldDef ? fieldDef.options : undefined}
                dormant
                onRemove={() => {}}
                onToggleNegate={() => {}}
                onEditValue={(newValue, negate) => onActivateDefault(def.name, newValue, def.chipType, negate)}
              />
            );
          })}
          {this.renderMoreFiltersButton()}
        </div>
      );
    }

    // No active chips — show all defaults as dormant prompts
    return (
      <div className="active-filters-bar" role="toolbar" aria-label="Search filters">
        {DEFAULT_FILTERS.map((def) => {
          const fieldDef = (availableFilters || []).find((f) => f.name === def.name);
          return (
            <ActiveFilterChip
              key={`default-${def.name}`}
              index={-1}
              name={def.label}
              value={def.kind === CHIP_KIND_MULTI ? undefined : "all"}
              values={def.kind === CHIP_KIND_MULTI ? [] : undefined}
              kind={def.kind}
              negate={false}
              chipType={def.chipType}
              options={fieldDef ? fieldDef.options : undefined}
              dormant
              onRemove={() => {}}
              onToggleNegate={() => {}}
              onEditValue={(newValue, negate) => onActivateDefault(def.name, newValue, def.chipType, negate)}
            />
          );
        })}
        {this.renderMoreFiltersButton()}
      </div>
    );
  }
}
