import React, { useState, useEffect, useCallback } from "react";
import Modal from "../UtilComponents/Modal";
import { FILE_TYPE_CATEGORIES } from "./fileTypeCategories";
import { isMultiValueChip } from "./chipNames";
import { Chip } from "./chipParsing";
import {
  CHIP_NAME_FILE_TYPE,
  CHIP_NAME_DATE_RANGE,
  CHIP_NAME_CREATED_AFTER,
  CHIP_NAME_CREATED_BEFORE,
  CHIP_NAME_MIME_TYPE,
  CHIP_KIND_SINGLE,
  CHIP_KIND_MULTI,
  CHIP_KIND_DATE_RANGE,
  CHIP_TYPE_TEXT,
  CHIP_TYPE_DATE,
  CHIP_TYPE_DATE_EX,
  CHIP_TYPE_DROPDOWN,
  CHIP_TYPE_FILE_TYPE,
  CHIP_TYPE_DATE_RANGE,
} from "./chipNames";

/**
 * Filter names that are consolidated into higher-level UI concepts
 * and should not appear directly in the filter picker.
 */
const HIDDEN_FILTER_NAMES = new Set([
  CHIP_NAME_CREATED_AFTER,
  CHIP_NAME_CREATED_BEFORE,
  CHIP_NAME_MIME_TYPE,
]);

/**
 * Built-in filter definitions not provided by suggestedFields.
 */
const BUILT_IN_FILTERS: FilterDef[] = [
  { name: CHIP_NAME_FILE_TYPE, type: CHIP_TYPE_FILE_TYPE },
  { name: CHIP_NAME_DATE_RANGE, type: CHIP_TYPE_DATE_RANGE },
];

interface FilterDef {
  name: string;
  type?: string;
  options?: { value: string; label: string }[] | string[];
}

function resolveFilterMeta(
  name: string,
  backendType: string | null | undefined,
): {
  kind:
    | typeof CHIP_KIND_SINGLE
    | typeof CHIP_KIND_MULTI
    | typeof CHIP_KIND_DATE_RANGE;
  chipType: string;
  multi: boolean;
} {
  if (name === CHIP_NAME_DATE_RANGE) {
    return {
      kind: CHIP_KIND_DATE_RANGE,
      chipType: CHIP_TYPE_DATE_RANGE,
      multi: false,
    };
  }
  if (name === CHIP_NAME_FILE_TYPE) {
    return {
      kind: CHIP_KIND_MULTI,
      chipType: CHIP_TYPE_FILE_TYPE,
      multi: true,
    };
  }
  if (isMultiValueChip(name)) {
    return {
      kind: CHIP_KIND_MULTI,
      chipType: backendType || CHIP_TYPE_DROPDOWN,
      multi: true,
    };
  }
  return {
    kind: CHIP_KIND_SINGLE,
    chipType: backendType || CHIP_TYPE_TEXT,
    multi: false,
  };
}

interface AddFilterModalProps {
  isOpen: boolean;
  editingChip: Chip | null;
  editingChipIndex: number;
  availableFilters?: FilterDef[];
  onConfirm: (chip: Chip, editIndex: number) => void;
  onClose: () => void;
}

interface FormState {
  selectedFilter: string;
  polarity: string;
  textValue: string;
  multiValues: string[];
  dateFrom: string;
  dateTo: string;
}

function getInitialFormState(editingChip: Chip | null): FormState {
  if (editingChip) {
    return {
      selectedFilter: editingChip.name,
      polarity: editingChip.negate ? "exclude" : "include",
      textValue: ("value" in editingChip ? editingChip.value : "") || "",
      multiValues: "values" in editingChip ? [...editingChip.values] : [],
      dateFrom: ("from" in editingChip ? editingChip.from : "") || "",
      dateTo: ("to" in editingChip ? editingChip.to : "") || "",
    };
  }
  return {
    selectedFilter: "",
    polarity: "include",
    textValue: "",
    multiValues: [],
    dateFrom: "",
    dateTo: "",
  };
}

const AddFilterModal: React.FC<AddFilterModalProps> = ({
  isOpen,
  editingChip,
  editingChipIndex,
  availableFilters,
  onConfirm,
  onClose,
}) => {
  const [form, setForm] = useState<FormState>(() =>
    getInitialFormState(editingChip),
  );

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setForm(getInitialFormState(editingChip));
    }
  }, [isOpen, editingChip]);

  const getFilterList = useCallback((): FilterDef[] => {
    const backendFilters = (availableFilters || []).filter(
      (f) => !HIDDEN_FILTER_NAMES.has(f.name),
    );
    const backendNames = new Set(backendFilters.map((f) => f.name));
    const builtIns = BUILT_IN_FILTERS.filter((f) => !backendNames.has(f.name));
    return [...builtIns, ...backendFilters];
  }, [availableFilters]);

  const getFilterDef = useCallback(
    (name: string): FilterDef | null => {
      return getFilterList().find((f) => f.name === name) || null;
    },
    [getFilterList],
  );

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setForm({
      selectedFilter: e.target.value,
      polarity: form.polarity,
      textValue: "",
      multiValues: [],
      dateFrom: "",
      dateTo: "",
    });
  };

  const handlePolarityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, polarity: e.target.value }));
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, textValue: e.target.value }));
  };

  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, dateFrom: e.target.value }));
  };

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, dateTo: e.target.value }));
  };

  const toggleMultiValue = (value: string) => {
    setForm((prev) => {
      const next = prev.multiValues.includes(value)
        ? prev.multiValues.filter((v) => v !== value)
        : [...prev.multiValues, value];
      return { ...prev, multiValues: next };
    });
  };

  const isValid = (): boolean => {
    if (!form.selectedFilter) return false;
    const def = getFilterDef(form.selectedFilter);
    const meta = resolveFilterMeta(form.selectedFilter, def ? def.type : null);

    switch (meta.kind) {
      case CHIP_KIND_DATE_RANGE:
        return form.dateFrom !== "" || form.dateTo !== "";
      case CHIP_KIND_MULTI:
        return form.multiValues.length > 0;
      case CHIP_KIND_SINGLE:
      default:
        return form.textValue.trim() !== "";
    }
  };

  const handleConfirm = () => {
    if (!isValid()) return;

    const negate = form.polarity === "exclude";
    const def = getFilterDef(form.selectedFilter);
    const meta = resolveFilterMeta(form.selectedFilter, def ? def.type : null);

    let chip: Chip;
    switch (meta.kind) {
      case CHIP_KIND_DATE_RANGE:
        chip = {
          kind: CHIP_KIND_DATE_RANGE,
          name: form.selectedFilter,
          from: form.dateFrom,
          to: form.dateTo,
          negate,
          chipType: meta.chipType,
        };
        break;
      case CHIP_KIND_MULTI:
        chip = {
          kind: CHIP_KIND_MULTI,
          name: form.selectedFilter,
          values: form.multiValues,
          negate,
          chipType: meta.chipType,
          options: def ? def.options : undefined,
        };
        break;
      case CHIP_KIND_SINGLE:
      default:
        chip = {
          kind: CHIP_KIND_SINGLE,
          name: form.selectedFilter,
          value: form.textValue.trim(),
          negate,
          chipType: meta.chipType,
        };
        break;
    }

    onConfirm(chip, editingChipIndex);
  };

  const renderValueInput = () => {
    if (!form.selectedFilter) return null;

    const def = getFilterDef(form.selectedFilter);
    const meta = resolveFilterMeta(form.selectedFilter, def ? def.type : null);

    switch (meta.kind) {
      case CHIP_KIND_DATE_RANGE:
        return (
          <div className="add-filter-modal__date-range">
            <label className="add-filter-modal__date-range-label">
              From
              <input
                className="add-filter-modal__date-input"
                type="date"
                value={form.dateFrom}
                onChange={handleDateFromChange}
              />
            </label>
            <label className="add-filter-modal__date-range-label">
              To
              <input
                className="add-filter-modal__date-input"
                type="date"
                value={form.dateTo}
                onChange={handleDateToChange}
              />
            </label>
          </div>
        );

      case CHIP_KIND_MULTI: {
        const options =
          form.selectedFilter === CHIP_NAME_FILE_TYPE
            ? FILE_TYPE_CATEGORIES
            : def && def.options
              ? def.options.map((o) =>
                  typeof o === "string" ? { value: o, label: o } : o,
                )
              : [];
        return (
          <div
            className="add-filter-modal__multi-select"
            role="group"
            aria-label="Select values"
          >
            {options.map((opt) => {
              const checked = form.multiValues.includes(opt.value);
              return (
                <label key={opt.value} className="add-filter-modal__option">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleMultiValue(opt.value)}
                  />
                  <span className="add-filter-modal__option-label">
                    {opt.label}
                  </span>
                </label>
              );
            })}
          </div>
        );
      }

      case CHIP_KIND_SINGLE:
      default: {
        const backendType = def ? def.type : CHIP_TYPE_TEXT;
        if (
          backendType === CHIP_TYPE_DATE ||
          backendType === CHIP_TYPE_DATE_EX
        ) {
          return (
            <input
              className="add-filter-modal__date-input"
              type="date"
              value={form.textValue}
              onChange={handleTextChange}
              autoFocus
            />
          );
        }
        return (
          <input
            className="add-filter-modal__text-input"
            type="text"
            value={form.textValue}
            onChange={handleTextChange}
            placeholder="Enter value…"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirm();
            }}
          />
        );
      }
    }
  };

  const isEditing = editingChip != null;
  const title = isEditing ? "Edit Filter" : "Add Filter";
  const confirmLabel = isEditing ? "Save" : "Add Filter";
  const filterList = getFilterList();

  return (
    <Modal
      isOpen={isOpen}
      dismiss={onClose}
      panelClassName="add-filter-modal__panel"
    >
      <h3 className="add-filter-modal__title">{title}</h3>

      <div className="add-filter-modal__field">
        <label className="add-filter-modal__label">Filter type</label>
        <select
          className="add-filter-modal__select"
          value={form.selectedFilter}
          onChange={handleFilterChange}
          disabled={isEditing}
          autoFocus={!isEditing}
        >
          <option value="" disabled>
            Select a filter…
          </option>
          {filterList.map((f) => (
            <option key={f.name} value={f.name}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div className="add-filter-modal__field">
        <label className="add-filter-modal__label">Mode</label>
        <div className="add-filter-modal__radio-group">
          <label className="add-filter-modal__radio">
            <input
              type="radio"
              name="polarity"
              value="include"
              checked={form.polarity === "include"}
              onChange={handlePolarityChange}
            />
            Include
          </label>
          <label className="add-filter-modal__radio">
            <input
              type="radio"
              name="polarity"
              value="exclude"
              checked={form.polarity === "exclude"}
              onChange={handlePolarityChange}
            />
            Exclude
          </label>
        </div>
      </div>

      {form.selectedFilter && (
        <div className="add-filter-modal__field">
          <label className="add-filter-modal__label">Value</label>
          {renderValueInput()}
        </div>
      )}

      <div className="add-filter-modal__actions">
        <button className="btn add-filter-modal__cancel-btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn add-filter-modal__confirm-btn"
          onClick={handleConfirm}
          disabled={!isValid()}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

export default AddFilterModal;
