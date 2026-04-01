import React, { useState, useEffect, useCallback } from "react";
import MultiSelectDropdown from "./MultiSelectDropdown";
import { FILE_TYPE_CATEGORIES } from "./fileTypeCategories";
import { MIME_TYPE_OPTIONS } from "./mimeTypeOptions";
import {
  CHIP_KIND_SINGLE,
  CHIP_KIND_MULTI,
  CHIP_KIND_DATE_RANGE,
  CHIP_TYPE_DATE,
  CHIP_TYPE_DATE_EX,
  CHIP_TYPE_WORKSPACE_FOLDER,
  CHIP_NAME_MIME_TYPE,
  CHIP_NAME_FILE_TYPE,
} from "./chipNames";
import type { SelectOption } from "./chipDisplayUtils";

// Re-export for downstream consumers
export { truncateChipDisplay } from "./chipDisplayUtils";
export type { SelectOption } from "./chipDisplayUtils";

export type ChipEditValue = string | string[] | { from: string; to: string };

export interface ActiveFilterChipProps {
  index: number;
  name: string;
  value?: string;
  values?: string[];
  from?: string;
  to?: string;
  negate: boolean;
  chipType: string;
  kind:
    | typeof CHIP_KIND_SINGLE
    | typeof CHIP_KIND_MULTI
    | typeof CHIP_KIND_DATE_RANGE;
  options?: SelectOption[];
  dormant?: boolean;
  onRemove: () => void;
  onToggleNegate: () => void;
  onEditValue: (newValue: ChipEditValue, negate?: boolean) => void;
}

/** Resolve the options list for a multi-value chip. */
function resolveMultiSelectOptions(
  name: string,
  options: SelectOption[] | undefined,
): SelectOption[] {
  if (name === CHIP_NAME_MIME_TYPE) return MIME_TYPE_OPTIONS;
  if (name === CHIP_NAME_FILE_TYPE)
    return FILE_TYPE_CATEGORIES as SelectOption[];
  return options || [];
}

const ActiveFilterChip: React.FC<ActiveFilterChipProps> = (props) => {
  const {
    name,
    value,
    values,
    from,
    to,
    negate,
    chipType,
    kind,
    options,
    dormant,
    onRemove,
    onToggleNegate,
    onEditValue,
  } = props;

  const [isEditingValue, setIsEditingValue] = useState(false);
  const [editValue, setEditValue] = useState(value || "");
  const [pendingValues, setPendingValues] = useState<string[]>([]);
  const [pendingNegate, setPendingNegate] = useState(false);

  useEffect(() => {
    setEditValue(value || "");
  }, [value]);

  // --- Text editing ---

  const onStartEdit = useCallback(() => {
    setIsEditingValue(true);
    setEditValue(value ?? "");
  }, [value]);

  const commitEdit = useCallback(() => {
    onEditValue(editValue);
    setIsEditingValue(false);
  }, [editValue, onEditValue]);

  const cancelEdit = useCallback(() => {
    setIsEditingValue(false);
    setEditValue(value || "");
  }, [value]);

  const onEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") commitEdit();
      else if (e.key === "Escape") cancelEdit();
    },
    [commitEdit, cancelEdit],
  );

  // --- Multi-value toggle ---

  const toggleMultiValue = useCallback(
    (optionValue: string) => {
      if (dormant) {
        setPendingValues((current) =>
          current.includes(optionValue)
            ? current.filter((v) => v !== optionValue)
            : [...current, optionValue],
        );
      } else {
        const currentValues = values || [];
        const newValues = currentValues.includes(optionValue)
          ? currentValues.filter((v) => v !== optionValue)
          : [...currentValues, optionValue];
        onEditValue(newValues);
      }
    },
    [dormant, values, onEditValue],
  );

  const onDropdownClose = useCallback(() => {
    if (dormant && pendingValues.length > 0) {
      onEditValue([...pendingValues], pendingNegate);
      setPendingValues([]);
      setPendingNegate(false);
    }
  }, [dormant, pendingValues, pendingNegate, onEditValue]);

  // --- Value renderers ---

  const renderTextValue = () => {
    if (isEditingValue) {
      return (
        <input
          className="active-filter-chip__value-input"
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={onEditKeyDown}
          onBlur={commitEdit}
          autoFocus
          aria-label={`Edit ${name} value`}
        />
      );
    }
    return (
      <span
        className="active-filter-chip__value-text active-filter-chip__value-text--editable"
        role="button"
        tabIndex={0}
        onClick={onStartEdit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onStartEdit();
          }
        }}
        aria-label={`Edit value: ${value || "empty"}`}
        title="Click to edit value"
      >
        {value || <em className="active-filter-chip__empty">empty</em>}
      </span>
    );
  };

  const renderDateValue = () => (
    <input
      className="active-filter-chip__date-input"
      type="date"
      value={value || ""}
      onChange={(e) => onEditValue(e.target.value)}
      aria-label={`${name} date`}
      title={
        chipType === CHIP_TYPE_DATE_EX
          ? "Select date (exclusive)"
          : "Select date"
      }
    />
  );

  const renderDateRangeValue = () => (
    <span className="active-filter-chip__date-range">
      <input
        className="active-filter-chip__date-input"
        type="date"
        value={from || ""}
        onChange={(e) => onEditValue({ from: e.target.value, to: to || "" })}
        aria-label="Date range start"
        title="From date (exclusive — documents after this date)"
      />
      <span className="active-filter-chip__date-range-sep" aria-hidden="true">
        to
      </span>
      <input
        className="active-filter-chip__date-input"
        type="date"
        value={to || ""}
        onChange={(e) => onEditValue({ from: from || "", to: e.target.value })}
        aria-label="Date range end"
        title="To date (documents before this date)"
      />
    </span>
  );

  const renderDormantDateRange = () => (
    <span className="active-filter-chip__date-range">
      <span className="active-filter-chip__dormant-label">all</span>
      <input
        className="active-filter-chip__date-input active-filter-chip__date-input--dormant"
        type="date"
        value=""
        onChange={(e) => {
          if (e.target.value) {
            onEditValue({ from: e.target.value, to: "" }, pendingNegate);
          }
        }}
        aria-label="Pick a start date to activate this filter"
        title="Pick a start date"
      />
      <span className="active-filter-chip__date-range-sep" aria-hidden="true">
        to
      </span>
      <input
        className="active-filter-chip__date-input active-filter-chip__date-input--dormant"
        type="date"
        value=""
        onChange={(e) => {
          if (e.target.value) {
            onEditValue({ from: "", to: e.target.value }, pendingNegate);
          }
        }}
        aria-label="Pick an end date to activate this filter"
        title="Pick an end date"
      />
    </span>
  );

  const renderWorkspaceFolderValue = () => (
    <span className="active-filter-chip__value-text" title={value}>
      {value || <em className="active-filter-chip__empty">folder</em>}
    </span>
  );

  const renderDormantSingleValue = () => {
    if (chipType === CHIP_TYPE_DATE || chipType === CHIP_TYPE_DATE_EX) {
      return (
        <>
          <span className="active-filter-chip__dormant-label">all</span>
          <input
            className="active-filter-chip__date-input active-filter-chip__date-input--dormant"
            type="date"
            value=""
            onChange={(e) => {
              if (e.target.value) {
                onEditValue(e.target.value, pendingNegate);
              }
            }}
            aria-label={`Pick a date for ${name}`}
            title="Pick a date to activate this filter"
          />
        </>
      );
    }

    return (
      <span
        className="active-filter-chip__dormant-label active-filter-chip__dormant-label--clickable"
        role="button"
        tabIndex={0}
        onClick={() => setIsEditingValue(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsEditingValue(true);
          }
        }}
        aria-label={`Set a value for ${name}`}
        title="Click to set a filter value"
      >
        {isEditingValue ? (
          <input
            className="active-filter-chip__value-input"
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && editValue) {
                onEditValue(editValue, pendingNegate);
                setIsEditingValue(false);
                setPendingNegate(false);
              } else if (e.key === "Escape") {
                setIsEditingValue(false);
                setEditValue("");
              }
            }}
            onBlur={() => {
              if (editValue) {
                onEditValue(editValue, pendingNegate);
              }
              setIsEditingValue(false);
              setPendingNegate(false);
            }}
            autoFocus
            aria-label={`Enter value for ${name}`}
            placeholder="Type a value..."
          />
        ) : (
          "all"
        )}
      </span>
    );
  };

  const renderValueEditor = () => {
    switch (kind) {
      case CHIP_KIND_DATE_RANGE:
        return dormant ? renderDormantDateRange() : renderDateRangeValue();

      case CHIP_KIND_MULTI:
        return (
          <MultiSelectDropdown
            name={name}
            options={resolveMultiSelectOptions(name, options)}
            values={values}
            pendingValues={pendingValues}
            dormant={dormant}
            onToggleValue={toggleMultiValue}
            onClose={onDropdownClose}
          />
        );

      case CHIP_KIND_SINGLE:
      default:
        if (dormant) return renderDormantSingleValue();
        switch (chipType) {
          case CHIP_TYPE_DATE:
          case CHIP_TYPE_DATE_EX:
            return renderDateValue();
          case CHIP_TYPE_WORKSPACE_FOLDER:
            return renderWorkspaceFolderValue();
          default:
            return renderTextValue();
        }
    }
  };

  // --- Render ---

  const isDormant = !!dormant;
  const isWorkspaceFolder = chipType === CHIP_TYPE_WORKSPACE_FOLDER;
  const hasPending =
    isDormant && kind === CHIP_KIND_MULTI && pendingValues.length > 0;
  const effectiveNegate = isDormant ? pendingNegate : negate;

  const chipClassName = [
    "active-filter-chip",
    effectiveNegate ? "active-filter-chip--negate" : "",
    isDormant && !hasPending ? "active-filter-chip--dormant" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const negateInert = (isDormant && !hasPending) || isWorkspaceFolder;

  return (
    <span
      className={chipClassName}
      role="group"
      aria-label={`${effectiveNegate ? "Exclude" : "Include"} ${name} filter${isDormant && !hasPending ? " (inactive)" : ""}`}
    >
      <button
        className={[
          "active-filter-chip__negate-btn",
          negateInert ? "active-filter-chip__negate-btn--inert" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={
          negateInert
            ? undefined
            : isDormant
              ? () => setPendingNegate((prev) => !prev)
              : onToggleNegate
        }
        aria-label={
          negateInert
            ? isWorkspaceFolder
              ? "Including (scope filter)"
              : "Including"
            : effectiveNegate
              ? "Excluding — click to include"
              : "Including — click to exclude"
        }
        aria-pressed={effectiveNegate}
        title={
          negateInert
            ? isWorkspaceFolder
              ? "Including (scope filter)"
              : "Including"
            : effectiveNegate
              ? "Excluding (click to include)"
              : "Including (click to exclude)"
        }
      >
        <div className="active-filter-chip__button-icon" aria-hidden="true">
          {negateInert ? "+" : effectiveNegate ? "−" : "+"}
        </div>
      </button>

      <span className="active-filter-chip__body">
        <span className="active-filter-chip__name">{name}</span>
        <span className="active-filter-chip__value">{renderValueEditor()}</span>
      </span>

      {isDormant && !hasPending ? (
        <span className="active-filter-chip__end-cap" aria-hidden="true" />
      ) : (
        <button
          className="active-filter-chip__remove-btn"
          onClick={
            isDormant
              ? () => {
                  setPendingValues([]);
                  setPendingNegate(false);
                }
              : onRemove
          }
          aria-label={
            hasPending ? `Clear ${name} selections` : `Remove ${name} filter`
          }
          title={hasPending ? "Clear selections" : "Remove filter"}
        >
          <div className="active-filter-chip__button-icon" aria-hidden="true">
            ×
          </div>
        </button>
      )}
    </span>
  );
};

export default ActiveFilterChip;
