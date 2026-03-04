import React from "react";
import PropTypes from "prop-types";
import { FILE_TYPE_CATEGORIES } from "./fileTypeCategories";
import { isMultiValueChip } from "./ActiveFilterChip";
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
const BUILT_IN_FILTERS = [
  { name: CHIP_NAME_FILE_TYPE, type: CHIP_TYPE_FILE_TYPE },
  { name: CHIP_NAME_DATE_RANGE, type: CHIP_TYPE_DATE_RANGE },
];

/**
 * Resolve the kind, chipType, and whether multi-value for a given
 * filter name + backend type string.
 */
function resolveFilterMeta(name, backendType) {
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

/**
 * Modal dialog for adding or editing a filter chip.
 *
 * Props:
 *   isOpen            – whether the modal is visible
 *   editingChip       – if editing, the chip object; null for new
 *   editingChipIndex  – index of chip being edited (-1 for new)
 *   availableFilters  – suggestedFields from the backend
 *   onConfirm(chip)   – called with the chip data when the user clicks Add/Save
 *   onClose()         – called to dismiss the modal
 */
export default class AddFilterModal extends React.Component {
  static propTypes = {
    isOpen: PropTypes.bool.isRequired,
    editingChip: PropTypes.object,
    editingChipIndex: PropTypes.number,
    availableFilters: PropTypes.array,
    onConfirm: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = this.getInitialFormState(props);
    this.backdropRef = React.createRef();
  }

  componentDidUpdate(prevProps) {
    if (!prevProps.isOpen && this.props.isOpen) {
      // Modal just opened — reset form
      this.setState(this.getInitialFormState(this.props));
    }
  }

  getInitialFormState(props) {
    if (props.editingChip) {
      const chip = props.editingChip;
      return {
        selectedFilter: chip.name,
        polarity: chip.negate ? "exclude" : "include",
        // Single value
        textValue: chip.value || "",
        // Multi values
        multiValues: chip.values ? [...chip.values] : [],
        // Date range
        dateFrom: chip.from || "",
        dateTo: chip.to || "",
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

  /** Build the merged list of available filter names. */
  getFilterList() {
    const backendFilters = (this.props.availableFilters || []).filter(
      (f) => !HIDDEN_FILTER_NAMES.has(f.name),
    );
    const backendNames = new Set(backendFilters.map((f) => f.name));

    // Add built-ins that aren't already in the backend list
    const builtIns = BUILT_IN_FILTERS.filter((f) => !backendNames.has(f.name));
    return [...builtIns, ...backendFilters];
  }

  /** Find the backend filter definition for a given filter name. */
  getFilterDef(name) {
    const list = this.getFilterList();
    return list.find((f) => f.name === name) || null;
  }

  handleFilterChange = (e) => {
    this.setState({
      selectedFilter: e.target.value,
      textValue: "",
      multiValues: [],
      dateFrom: "",
      dateTo: "",
    });
  };

  handlePolarityChange = (e) => {
    this.setState({ polarity: e.target.value });
  };

  handleTextChange = (e) => {
    this.setState({ textValue: e.target.value });
  };

  handleDateFromChange = (e) => {
    this.setState({ dateFrom: e.target.value });
  };

  handleDateToChange = (e) => {
    this.setState({ dateTo: e.target.value });
  };

  toggleMultiValue = (value) => {
    this.setState((prev) => {
      const current = prev.multiValues;
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { multiValues: next };
    });
  };

  handleBackdropClick = (e) => {
    if (e.target === this.backdropRef.current) {
      this.props.onClose();
    }
  };

  handleKeyDown = (e) => {
    if (e.key === "Escape") {
      this.props.onClose();
    }
  };

  isValid() {
    const { selectedFilter, textValue, multiValues, dateFrom, dateTo } =
      this.state;
    if (!selectedFilter) return false;

    const def = this.getFilterDef(selectedFilter);
    const meta = resolveFilterMeta(selectedFilter, def ? def.type : null);

    switch (meta.kind) {
      case CHIP_KIND_DATE_RANGE:
        return dateFrom !== "" || dateTo !== "";
      case CHIP_KIND_MULTI:
        return multiValues.length > 0;
      case CHIP_KIND_SINGLE:
      default:
        return textValue.trim() !== "";
    }
  }

  handleConfirm = () => {
    if (!this.isValid()) return;

    const {
      selectedFilter,
      polarity,
      textValue,
      multiValues,
      dateFrom,
      dateTo,
    } = this.state;
    const negate = polarity === "exclude";
    const def = this.getFilterDef(selectedFilter);
    const meta = resolveFilterMeta(selectedFilter, def ? def.type : null);

    let chip;
    switch (meta.kind) {
      case CHIP_KIND_DATE_RANGE:
        chip = {
          kind: CHIP_KIND_DATE_RANGE,
          name: selectedFilter,
          from: dateFrom,
          to: dateTo,
          negate,
          chipType: meta.chipType,
        };
        break;
      case CHIP_KIND_MULTI:
        chip = {
          kind: CHIP_KIND_MULTI,
          name: selectedFilter,
          values: multiValues,
          negate,
          chipType: meta.chipType,
          options: def ? def.options : undefined,
        };
        break;
      case CHIP_KIND_SINGLE:
      default:
        chip = {
          kind: CHIP_KIND_SINGLE,
          name: selectedFilter,
          value: textValue.trim(),
          negate,
          chipType: meta.chipType,
        };
        break;
    }

    this.props.onConfirm(chip, this.props.editingChipIndex);
  };

  // ── Value input renderers ──────────────────────────────────

  renderTextInput() {
    return (
      <input
        className="add-filter-modal__text-input"
        type="text"
        value={this.state.textValue}
        onChange={this.handleTextChange}
        placeholder="Enter value…"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") this.handleConfirm();
        }}
      />
    );
  }

  renderDateInput() {
    return (
      <input
        className="add-filter-modal__date-input"
        type="date"
        value={this.state.textValue}
        onChange={this.handleTextChange}
        autoFocus
      />
    );
  }

  renderDateRangeInput() {
    return (
      <div className="add-filter-modal__date-range">
        <label className="add-filter-modal__date-range-label">
          From
          <input
            className="add-filter-modal__date-input"
            type="date"
            value={this.state.dateFrom}
            onChange={this.handleDateFromChange}
          />
        </label>
        <label className="add-filter-modal__date-range-label">
          To
          <input
            className="add-filter-modal__date-input"
            type="date"
            value={this.state.dateTo}
            onChange={this.handleDateToChange}
          />
        </label>
      </div>
    );
  }

  renderMultiSelectInput(options) {
    const { multiValues } = this.state;
    return (
      <div
        className="add-filter-modal__multi-select"
        role="group"
        aria-label="Select values"
      >
        {options.map((opt) => {
          const checked = multiValues.includes(opt.value);
          return (
            <label key={opt.value} className="add-filter-modal__option">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => this.toggleMultiValue(opt.value)}
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

  renderValueInput() {
    const { selectedFilter } = this.state;
    if (!selectedFilter) return null;

    const def = this.getFilterDef(selectedFilter);
    const meta = resolveFilterMeta(selectedFilter, def ? def.type : null);

    switch (meta.kind) {
      case CHIP_KIND_DATE_RANGE:
        return this.renderDateRangeInput();

      case CHIP_KIND_MULTI: {
        // For File Type, use FILE_TYPE_CATEGORIES; for others, use backend options
        const options =
          selectedFilter === CHIP_NAME_FILE_TYPE
            ? FILE_TYPE_CATEGORIES
            : def && def.options
              ? def.options.map((o) =>
                  typeof o === "string" ? { value: o, label: o } : o,
                )
              : [];
        return this.renderMultiSelectInput(options);
      }

      case CHIP_KIND_SINGLE:
      default: {
        const backendType = def ? def.type : CHIP_TYPE_TEXT;
        if (
          backendType === CHIP_TYPE_DATE ||
          backendType === CHIP_TYPE_DATE_EX
        ) {
          return this.renderDateInput();
        }
        return this.renderTextInput();
      }
    }
  }

  render() {
    if (!this.props.isOpen) return null;

    const isEditing = this.props.editingChip != null;
    const title = isEditing ? "Edit Filter" : "Add Filter";
    const confirmLabel = isEditing ? "Save" : "Add Filter";
    const filterList = this.getFilterList();

    return (
      <div
        className="add-filter-modal"
        ref={this.backdropRef}
        onClick={this.handleBackdropClick}
        onKeyDown={this.handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="add-filter-modal__panel">
          <h3 className="add-filter-modal__title">{title}</h3>

          {/* Filter type selector */}
          <div className="add-filter-modal__field">
            <label className="add-filter-modal__label">Filter type</label>
            <select
              className="add-filter-modal__select"
              value={this.state.selectedFilter}
              onChange={this.handleFilterChange}
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

          {/* Include / Exclude toggle */}
          <div className="add-filter-modal__field">
            <label className="add-filter-modal__label">Mode</label>
            <div className="add-filter-modal__radio-group">
              <label className="add-filter-modal__radio">
                <input
                  type="radio"
                  name="polarity"
                  value="include"
                  checked={this.state.polarity === "include"}
                  onChange={this.handlePolarityChange}
                />
                Include
              </label>
              <label className="add-filter-modal__radio">
                <input
                  type="radio"
                  name="polarity"
                  value="exclude"
                  checked={this.state.polarity === "exclude"}
                  onChange={this.handlePolarityChange}
                />
                Exclude
              </label>
            </div>
          </div>

          {/* Value input — varies by filter type */}
          {this.state.selectedFilter && (
            <div className="add-filter-modal__field">
              <label className="add-filter-modal__label">Value</label>
              {this.renderValueInput()}
            </div>
          )}

          {/* Action buttons */}
          <div className="add-filter-modal__actions">
            <button
              className="btn add-filter-modal__cancel-btn"
              onClick={this.props.onClose}
            >
              Cancel
            </button>
            <button
              className="btn add-filter-modal__confirm-btn"
              onClick={this.handleConfirm}
              disabled={!this.isValid()}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
