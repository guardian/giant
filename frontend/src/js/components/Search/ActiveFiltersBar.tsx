import React from "react";
import ActiveFilterChip, { ChipEditValue } from "./ActiveFilterChip";
import AddIcon from "react-icons/lib/md/add";
import { Chip, SuggestedField } from "./chipParsing";
import {
  CHIP_NAME_FILE_TYPE,
  CHIP_NAME_DATE_RANGE,
  CHIP_NAME_DATASET,
  CHIP_NAME_WORKSPACE,
  CHIP_KIND_MULTI,
  CHIP_KIND_DATE_RANGE,
  CHIP_TYPE_FILE_TYPE,
  CHIP_TYPE_DATE_RANGE,
  CHIP_TYPE_DATASET,
  CHIP_TYPE_WORKSPACE,
} from "./chipNames";

interface ActiveFiltersBarProps {
  chips: Chip[];
  availableFilters?: SuggestedField[];
  onRemoveChip: (index: number) => void;
  onToggleNegate: (index: number) => void;
  onEditChipValue: (index: number, newValue: ChipEditValue) => void;
  onActivateDefault: (
    name: string,
    value: ChipEditValue,
    chipType: string,
    negate?: boolean,
  ) => void;
  onOpenAddFilter: (chip?: Chip, index?: number) => void;
}

/**
 * Default filter chips shown when no filters are active.
 * These act as prompts — showing users what filters are available.
 * Each maps to a chip type with sensible defaults.
 */
const DEFAULT_FILTERS = [
  {
    name: CHIP_NAME_DATASET,
    chipType: CHIP_TYPE_DATASET,
    label: CHIP_NAME_DATASET,
    kind: CHIP_KIND_MULTI,
  },
  {
    name: CHIP_NAME_WORKSPACE,
    chipType: CHIP_TYPE_WORKSPACE,
    label: CHIP_NAME_WORKSPACE,
    kind: CHIP_KIND_MULTI,
  },
  {
    name: CHIP_NAME_DATE_RANGE,
    chipType: CHIP_TYPE_DATE_RANGE,
    label: CHIP_NAME_DATE_RANGE,
    kind: CHIP_KIND_DATE_RANGE,
  },
  {
    name: CHIP_NAME_FILE_TYPE,
    chipType: CHIP_TYPE_FILE_TYPE,
    label: CHIP_NAME_FILE_TYPE,
    kind: CHIP_KIND_MULTI,
  },
] as const;

function normaliseOptions(
  options: string[] | { value: string; label: string }[] | undefined,
) {
  if (!options) return undefined;
  return options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
}

/**
 * Renders filter chips below the search box.
 *
 * When the user has active filters, those are shown.
 * When no filters are active, default "dormant" chips are shown
 * as prompts (e.g. "File Types: all") that the user can click to activate.
 */
const ActiveFiltersBar: React.FC<ActiveFiltersBarProps> = ({
  chips,
  availableFilters,
  onRemoveChip,
  onToggleNegate,
  onEditChipValue,
  onActivateDefault,
  onOpenAddFilter,
}) => {
  const moreFiltersButton = (
    <button
      className="active-filters-bar__add-btn"
      onClick={() => onOpenAddFilter()}
      title="Add a filter"
      aria-label="Add a filter"
    >
      <AddIcon className="active-filters-bar__add-icon" />
      More filters
    </button>
  );

  const renderDefaultChip = (def: (typeof DEFAULT_FILTERS)[number]) => {
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
        options={normaliseOptions(fieldDef ? fieldDef.options : undefined)}
        dormant
        onRemove={() => {}}
        onToggleNegate={() => {}}
        onEditValue={(newValue, negate) =>
          onActivateDefault(def.name, newValue, def.chipType, negate)
        }
      />
    );
  };

  if (chips.length > 0) {
    const activeNames = new Set(chips.map((c) => c.name));
    const remainingDefaults = DEFAULT_FILTERS.filter(
      (d) => !activeNames.has(d.name),
    );

    return (
      <div
        className="active-filters-bar"
        role="toolbar"
        aria-label="Active search filters"
      >
        {chips.map((chip, index) => {
          const rawOptions =
            ("options" in chip ? chip.options : undefined) ||
            (availableFilters || []).find((f) => f.name === chip.name)?.options;
          const chipOptions = normaliseOptions(rawOptions);
          return (
            <ActiveFilterChip
              key={`active-${index}`}
              index={index}
              name={chip.name}
              value={"value" in chip ? chip.value : undefined}
              values={"values" in chip ? chip.values : undefined}
              from={"from" in chip ? chip.from : undefined}
              to={"to" in chip ? chip.to : undefined}
              kind={chip.kind}
              negate={chip.negate}
              chipType={chip.chipType}
              options={chipOptions}
              onRemove={() => onRemoveChip(index)}
              onToggleNegate={() => onToggleNegate(index)}
              onEditValue={(newValue) => onEditChipValue(index, newValue)}
            />
          );
        })}
        {remainingDefaults.map(renderDefaultChip)}
        {moreFiltersButton}
      </div>
    );
  }

  return (
    <div
      className="active-filters-bar"
      role="toolbar"
      aria-label="Search filters"
    >
      {DEFAULT_FILTERS.map(renderDefaultChip)}
      {moreFiltersButton}
    </div>
  );
};

export default ActiveFiltersBar;
