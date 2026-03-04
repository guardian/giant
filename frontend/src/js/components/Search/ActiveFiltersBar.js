import React from "react";
import PropTypes from "prop-types";
import ActiveFilterChip from "./ActiveFilterChip";

/**
 * Default filter chips shown when no filters are active.
 * These act as prompts — showing users what filters are available.
 * Each maps to a chip type with sensible defaults.
 */
const DEFAULT_FILTERS = [
  { name: "Mime Type", chipType: "text", label: "File Types", multiValue: true },
  { name: "Created After", chipType: "date_ex", label: "Created After", multiValue: false },
  { name: "Created Before", chipType: "date", label: "Created Before", multiValue: false },
  { name: "Has Field", chipType: "dropdown", label: "Has Field", multiValue: true },
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
        multiValue: PropTypes.bool,
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
  };

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
              negate={chip.negate}
              chipType={chip.chipType}
              multiValue={chip.multiValue}
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
                value={def.multiValue ? undefined : "all"}
                values={def.multiValue ? [] : undefined}
                negate={false}
                chipType={def.chipType}
                multiValue={def.multiValue}
                options={fieldDef ? fieldDef.options : undefined}
                dormant
                onRemove={() => {}}
                onToggleNegate={() => {}}
                onEditValue={(newValue, negate) => onActivateDefault(def.name, newValue, def.chipType, negate)}
              />
            );
          })}
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
              value={def.multiValue ? undefined : "all"}
              values={def.multiValue ? [] : undefined}
              negate={false}
              chipType={def.chipType}
              multiValue={def.multiValue}
              options={fieldDef ? fieldDef.options : undefined}
              dormant
              onRemove={() => {}}
              onToggleNegate={() => {}}
              onEditValue={(newValue, negate) => onActivateDefault(def.name, newValue, def.chipType, negate)}
            />
          );
        })}
      </div>
    );
  }
}
