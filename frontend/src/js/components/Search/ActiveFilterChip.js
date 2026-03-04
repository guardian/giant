import React from "react";
import PropTypes from "prop-types";
import { FILE_TYPE_CATEGORIES } from "./fileTypeCategories";
import {
  CHIP_NAME_MIME_TYPE,
  CHIP_NAME_FILE_TYPE,
  CHIP_NAME_HAS_FIELD,
  CHIP_NAME_DATASET,
  CHIP_NAME_WORKSPACE,
  CHIP_NAME_LANGUAGE,
  CHIP_KIND_SINGLE,
  CHIP_KIND_MULTI,
  CHIP_KIND_DATE_RANGE,
  CHIP_TYPE_DATE,
  CHIP_TYPE_DATE_EX,
  CHIP_TYPE_WORKSPACE_FOLDER,
} from "./chipNames";

/**
 * A single filter chip in the active filters bar.
 *
 * Supports two modes:
 *  - Single-value: text input, date picker, or read-only (workspace_folder)
 *  - Multi-value: checkbox dropdown for multiple selections
 *    (Mime Type, Has Field, and future Datasets/Workspaces)
 *
 * Displays: [+/−] FilterName : [value editor] [×]
 */

// Well-known MIME type options with friendly labels for the multi-select dropdown
const MIME_TYPE_OPTIONS = [
  { value: "application/pdf", label: "PDF" },
  { value: "text/plain", label: "Plain Text" },
  { value: "text/html", label: "HTML" },
  { value: "text/csv", label: "CSV" },
  { value: "image/jpeg", label: "JPEG Image" },
  { value: "image/png", label: "PNG Image" },
  { value: "image/tiff", label: "TIFF Image" },
  { value: "application/msword", label: "Word (.doc)" },
  {
    value:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    label: "Word (.docx)",
  },
  { value: "application/vnd.ms-excel", label: "Excel (.xls)" },
  {
    value: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    label: "Excel (.xlsx)",
  },
  { value: "application/vnd.ms-powerpoint", label: "PowerPoint (.ppt)" },
  {
    value:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    label: "PowerPoint (.pptx)",
  },
  { value: "message/rfc822", label: "Email (.eml)" },
  { value: "application/zip", label: "ZIP Archive" },
  { value: "audio/mpeg", label: "MP3 Audio" },
  { value: "video/mp4", label: "MP4 Video" },
];

/** Maximum character budget for display text in a multi-value chip.
 *  Individual labels are ellipsis-truncated to fit, and a "+N more"
 *  suffix is appended when not all values fit within the budget. */
const MAX_DISPLAY_CHARS = 36;

/**
 * Chip names that support multiple simultaneous values.
 * One UI chip ↔ N backend chips of the same name.
 */
const MULTI_VALUE_CHIP_NAMES = new Set([
  CHIP_NAME_MIME_TYPE,
  CHIP_NAME_HAS_FIELD,
  CHIP_NAME_FILE_TYPE,
  CHIP_NAME_DATASET,
  CHIP_NAME_WORKSPACE,
  CHIP_NAME_LANGUAGE,
]);

/** Check whether a given chip name supports multi-value selection. */
export function isMultiValueChip(name) {
  return MULTI_VALUE_CHIP_NAMES.has(name);
}

/** Get the display label for a value given an options list. */
function getDisplayLabel(value, allOptions) {
  if (!allOptions) return value;
  const opt = allOptions.find((o) => o.value === value);
  return opt ? opt.label : value;
}

/**
 * Build a character-budget-aware display string from an array of labels.
 *
 * Algorithm:
 *   1. If all labels joined with ", " fit within `budget`, return them.
 *   2. Otherwise greedily add labels while they fit. Each label after the
 *      first costs an extra 2 chars for ", ".  Reserve space for the
 *      " +N more" suffix (where N = remaining items).
 *   3. A single label that exceeds the budget is ellipsis-truncated so
 *      there's always at least one visible name.
 *
 * @param {string[]} labels - Display labels (already resolved from IDs)
 * @param {number} budget - Maximum character count
 * @returns {string}
 */
export function truncateChipDisplay(labels, budget) {
  if (labels.length === 0) return "all";

  const full = labels.join(", ");
  if (full.length <= budget) return full;

  const ELLIPSIS = "\u2026"; // …
  const SEPARATOR = ", ";
  const shown = [];
  let used = 0;

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const remaining = labels.length - i - 1;
    const sepCost = shown.length > 0 ? SEPARATOR.length : 0;
    // When there are remaining items the suffix is ", +N more" if we already
    // have shown items, or ", +N more" after a truncated first label.
    // Use a consistent suffix cost that includes the separator.
    const suffixStr = remaining > 0 ? `${SEPARATOR}+${remaining} more` : "";
    const suffixCost =
      shown.length > 0
        ? suffixStr.length
        : remaining > 0
          ? suffixStr.length
          : 0;
    const available = budget - used - sepCost - suffixCost;

    if (available <= 0 && shown.length > 0) break;

    if (label.length <= available) {
      shown.push(label);
      used += sepCost + label.length;
    } else if (shown.length === 0) {
      // First label must always appear — truncate it with ellipsis
      const truncLen = Math.max(1, budget - suffixCost - ELLIPSIS.length);
      shown.push(label.slice(0, truncLen) + ELLIPSIS);
      used = shown[0].length;
      // Don't try to fit more after a truncated first label
      const leftover = labels.length - 1;
      if (leftover > 0) {
        return `${shown[0]}${SEPARATOR}+${leftover} more`;
      }
      return shown[0];
    } else {
      break;
    }
  }

  const leftover = labels.length - shown.length;
  if (leftover > 0) {
    return `${shown.join(SEPARATOR)}${SEPARATOR}+${leftover} more`;
  }
  return shown.join(SEPARATOR);
}

/** Resolve the options list for a multi-value chip. */
function getMultiSelectOptions(name, propOptions) {
  if (name === CHIP_NAME_MIME_TYPE) return MIME_TYPE_OPTIONS;
  if (name === CHIP_NAME_FILE_TYPE) return FILE_TYPE_CATEGORIES;
  // Dataset and Workspace options are dynamic (user-specific)
  // and passed through from the sidebar filters API
  return propOptions || [];
}

export default class ActiveFilterChip extends React.Component {
  static propTypes = {
    index: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    /** Single-value chips (text, date) */
    value: PropTypes.string,
    /** Multi-value chips — one UI chip holds N backend chips */
    values: PropTypes.arrayOf(PropTypes.string),
    /** Date Range chip — compound from/to */
    from: PropTypes.string,
    to: PropTypes.string,
    negate: PropTypes.bool.isRequired,
    chipType: PropTypes.string.isRequired,
    /** Discriminated union tag: "single", "multi", or "dateRange" */
    kind: PropTypes.oneOf([
      CHIP_KIND_SINGLE,
      CHIP_KIND_MULTI,
      CHIP_KIND_DATE_RANGE,
    ]).isRequired,
    options: PropTypes.array,
    /** When true, the chip is a dormant default showing "all" */
    dormant: PropTypes.bool,
    onRemove: PropTypes.func.isRequired,
    onToggleNegate: PropTypes.func.isRequired,
    /**
     * Called with new value(s):
     *  - single-value: onEditValue(string)
     *  - multi-value:  onEditValue(string[])
     */
    onEditValue: PropTypes.func.isRequired,
  };

  state = {
    isEditingValue: false,
    editValue: this.props.value || "",
    // Multi-value dropdown state
    dropdownOpen: false,
    // Index of keyboard-focused option in the multi-select dropdown (-1 = none)
    focusedOptionIndex: -1,
    // Computed positioning for the dropdown (set on open)
    dropdownStyle: {},
    // Pending values for dormant multi-value chips (committed on dropdown close)
    pendingValues: [],
    // Pending negate for dormant chips (committed alongside values)
    pendingNegate: false,
  };

  dropdownRef = React.createRef();
  triggerRef = React.createRef();
  optionRefs = [];

  componentDidMount() {
    document.addEventListener("mousedown", this.handleClickOutside);
  }

  componentWillUnmount() {
    document.removeEventListener("mousedown", this.handleClickOutside);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.value !== this.props.value) {
      this.setState({ editValue: this.props.value || "" });
    }
  }

  handleClickOutside = (e) => {
    if (
      this.dropdownRef.current &&
      !this.dropdownRef.current.contains(e.target)
    ) {
      this.closeDropdown();
    }
  };

  /** Close the multi-select dropdown and commit pending dormant values */
  closeDropdown = () => {
    this.setState({ dropdownOpen: false, focusedOptionIndex: -1 });
    // Commit pending values on dormant multi-value chips
    if (this.props.dormant && this.state.pendingValues.length > 0) {
      this.props.onEditValue(
        [...this.state.pendingValues],
        this.state.pendingNegate,
      );
      this.setState({ pendingValues: [], pendingNegate: false });
    }
  };

  /** Open the dropdown, compute position, and focus the first option */
  openDropdown = () => {
    const style = this.computeDropdownPosition();
    this.setState({
      dropdownOpen: true,
      focusedOptionIndex: 0,
      dropdownStyle: style,
    });
  };

  /**
   * Measure the trigger element and decide whether to flip the dropdown
   * upward or to the right so it stays within the viewport.
   */
  computeDropdownPosition = () => {
    const style = { top: "calc(100% + 4px)", left: "0" };
    const trigger = this.triggerRef.current;
    if (!trigger) return style;

    const rect = trigger.getBoundingClientRect();
    const dropdownMaxHeight = 280; // matches SCSS max-height
    const dropdownMinWidth = 200; // matches SCSS min-width
    const gap = 4;
    const margin = 8; // breathing room from viewport edge

    // Flip upward if not enough room below
    const spaceBelow = window.innerHeight - rect.bottom;
    if (
      spaceBelow < dropdownMaxHeight + gap + margin &&
      rect.top > spaceBelow
    ) {
      style.top = "auto";
      style.bottom = "calc(100% + " + gap + "px)";
    }

    // Flip to open rightward-aligned if not enough room to the right
    const spaceRight = window.innerWidth - rect.left;
    if (spaceRight < dropdownMinWidth + margin) {
      style.left = "auto";
      style.right = "0";
    }

    return style;
  };

  /** Toggle dropdown open/closed */
  toggleDropdown = () => {
    if (this.state.dropdownOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  };

  /** Keyboard handler for the multi-select trigger button */
  handleTriggerKeyDown = (e) => {
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        this.toggleDropdown();
        break;
      case "ArrowDown":
        e.preventDefault();
        if (!this.state.dropdownOpen) {
          this.openDropdown();
        }
        break;
      case "Escape":
        if (this.state.dropdownOpen) {
          e.preventDefault();
          e.stopPropagation();
          this.closeDropdown();
          // Return focus to the trigger
          if (this.triggerRef.current) this.triggerRef.current.focus();
        }
        break;
      default:
        break;
    }
  };

  /** Keyboard handler for the multi-select dropdown options */
  handleDropdownKeyDown = (e, allOptions) => {
    const { focusedOptionIndex } = this.state;
    const optionCount = allOptions.length;
    if (optionCount === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        this.setState(
          (prev) => {
            const next = Math.min(prev.focusedOptionIndex + 1, optionCount - 1);
            return { focusedOptionIndex: next };
          },
          () => this.scrollFocusedOptionIntoView(),
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        this.setState(
          (prev) => {
            const next = Math.max(prev.focusedOptionIndex - 1, 0);
            return { focusedOptionIndex: next };
          },
          () => this.scrollFocusedOptionIntoView(),
        );
        break;
      case "Home":
        e.preventDefault();
        this.setState({ focusedOptionIndex: 0 }, () =>
          this.scrollFocusedOptionIntoView(),
        );
        break;
      case "End":
        e.preventDefault();
        this.setState({ focusedOptionIndex: optionCount - 1 }, () =>
          this.scrollFocusedOptionIntoView(),
        );
        break;
      case " ":
      case "Enter":
        e.preventDefault();
        if (focusedOptionIndex >= 0 && focusedOptionIndex < optionCount) {
          this.toggleMultiValue(allOptions[focusedOptionIndex].value);
        }
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        this.closeDropdown();
        if (this.triggerRef.current) this.triggerRef.current.focus();
        break;
      case "Tab":
        this.closeDropdown();
        break;
      default:
        break;
    }
  };

  /** Scroll the keyboard-focused option into view within the dropdown */
  scrollFocusedOptionIntoView = () => {
    const ref = this.optionRefs[this.state.focusedOptionIndex];
    if (ref) {
      ref.scrollIntoView({ block: "nearest" });
    }
  };

  // --- Dormant negate toggle ---
  togglePendingNegate = () => {
    this.setState((prev) => ({ pendingNegate: !prev.pendingNegate }));
  };

  // --- Text editing ---
  onStartEdit = () => {
    this.setState({
      isEditingValue: true,
      editValue: this.props.value,
    });
  };

  onEditChange = (e) => {
    this.setState({ editValue: e.target.value });
  };

  onEditKeyDown = (e) => {
    if (e.key === "Enter") {
      this.commitEdit();
    } else if (e.key === "Escape") {
      this.cancelEdit();
    }
  };

  commitEdit = () => {
    this.props.onEditValue(this.state.editValue);
    this.setState({ isEditingValue: false });
  };

  cancelEdit = () => {
    this.setState({
      isEditingValue: false,
      editValue: this.props.value || "",
    });
  };

  // --- Multi-value checkbox toggle ---

  toggleMultiValue = (optionValue) => {
    if (this.props.dormant) {
      // Accumulate locally while dropdown is open (committed on close)
      this.setState((prev) => {
        const current = prev.pendingValues;
        const newValues = current.includes(optionValue)
          ? current.filter((v) => v !== optionValue)
          : [...current, optionValue];
        return { pendingValues: newValues };
      });
    } else {
      // Active chip — update immediately
      const currentValues = this.props.values || [];
      const newValues = currentValues.includes(optionValue)
        ? currentValues.filter((v) => v !== optionValue)
        : [...currentValues, optionValue];
      this.props.onEditValue(newValues);
    }
  };

  // --- Value rendering by type ---

  renderTextValue() {
    const { value } = this.props;
    const { isEditingValue, editValue } = this.state;

    if (isEditingValue) {
      return (
        <input
          className="active-filter-chip__value-input"
          type="text"
          value={editValue}
          onChange={this.onEditChange}
          onKeyDown={this.onEditKeyDown}
          onBlur={this.commitEdit}
          autoFocus
          aria-label={`Edit ${this.props.name} value`}
        />
      );
    }

    return (
      <span
        className="active-filter-chip__value-text active-filter-chip__value-text--editable"
        role="button"
        tabIndex={0}
        onClick={this.onStartEdit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            this.onStartEdit();
          }
        }}
        aria-label={`Edit value: ${value || "empty"}`}
        title="Click to edit value"
      >
        {value || <em className="active-filter-chip__empty">empty</em>}
      </span>
    );
  }

  /** Multi-select checkbox dropdown (Mime Type, Has Field, future Datasets/Workspaces) */
  renderMultiSelectValue() {
    const { name, values, options, dormant } = this.props;
    const { dropdownOpen, pendingValues } = this.state;
    const allOptions = getMultiSelectOptions(name, options);

    // Dormant chips use local pending state; active chips use prop values
    const selectedValues = dormant ? pendingValues : values || [];

    // Build truncated display text using a character budget.
    // Labels are ellipsis-truncated individually, and a "+N more" suffix is
    // shown when not all values can fit within MAX_DISPLAY_CHARS.
    let displayText;
    if (selectedValues.length === 0) {
      displayText = "all";
    } else {
      displayText = truncateChipDisplay(
        selectedValues.map((v) => getDisplayLabel(v, allOptions)),
        MAX_DISPLAY_CHARS,
      );
    }

    // Ensure refs array has the right length
    this.optionRefs = allOptions.map(() => null);

    const dropdownId = `multi-select-dropdown-${name.replace(/\s+/g, "-").toLowerCase()}`;

    return (
      <span className="active-filter-chip__multi-select" ref={this.dropdownRef}>
        <button
          ref={this.triggerRef}
          type="button"
          className="active-filter-chip__multi-select-trigger"
          onClick={this.toggleDropdown}
          onKeyDown={this.handleTriggerKeyDown}
          aria-haspopup="listbox"
          aria-expanded={dropdownOpen}
          aria-controls={dropdownOpen ? dropdownId : undefined}
          aria-label={`${name}: ${displayText}. Click to ${dropdownOpen ? "close" : "open"} options`}
          title="Click to select values"
        >
          <span aria-hidden="true">{displayText}</span>
          <span
            className="active-filter-chip__multi-select-arrow"
            aria-hidden="true"
          >
            ▾
          </span>
        </button>
        {dropdownOpen && (
          <ul
            id={dropdownId}
            className="active-filter-chip__multi-select-dropdown"
            style={this.state.dropdownStyle}
            role="listbox"
            aria-label={`${name} options`}
            aria-multiselectable="true"
            tabIndex={-1}
            onKeyDown={(e) => this.handleDropdownKeyDown(e, allOptions)}
            ref={(el) => {
              if (el) el.focus();
            }}
          >
            {allOptions.map((opt, idx) => {
              const isSelected = selectedValues.includes(opt.value);
              const isFocused = this.state.focusedOptionIndex === idx;
              return (
                <li
                  key={opt.value}
                  ref={(el) => {
                    this.optionRefs[idx] = el;
                  }}
                  className={[
                    "active-filter-chip__multi-select-option",
                    isFocused
                      ? "active-filter-chip__multi-select-option--focused"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => this.toggleMultiValue(opt.value)}
                  onMouseEnter={() =>
                    this.setState({ focusedOptionIndex: idx })
                  }
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                  <span className="active-filter-chip__multi-select-option-label">
                    {opt.label}
                  </span>
                </li>
              );
            })}
            {allOptions.length === 0 && (
              <li
                className="active-filter-chip__multi-select-empty"
                role="option"
                aria-selected={false}
                aria-disabled="true"
              >
                No options available
              </li>
            )}
          </ul>
        )}
      </span>
    );
  }

  renderDateValue() {
    const { value, chipType } = this.props;

    return (
      <input
        className="active-filter-chip__date-input"
        type="date"
        value={value || ""}
        onChange={(e) => this.props.onEditValue(e.target.value)}
        aria-label={`${this.props.name} date`}
        title={
          chipType === CHIP_TYPE_DATE_EX
            ? "Select date (exclusive)"
            : "Select date"
        }
      />
    );
  }

  renderDateRangeValue() {
    const { from, to } = this.props;

    return (
      <span className="active-filter-chip__date-range">
        <input
          className="active-filter-chip__date-input"
          type="date"
          value={from || ""}
          onChange={(e) =>
            this.props.onEditValue({ from: e.target.value, to: to || "" })
          }
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
          onChange={(e) =>
            this.props.onEditValue({ from: from || "", to: e.target.value })
          }
          aria-label="Date range end"
          title="To date (documents before this date)"
        />
      </span>
    );
  }

  renderDormantDateRange() {
    return (
      <span className="active-filter-chip__date-range">
        <span className="active-filter-chip__dormant-label">all</span>
        <input
          className="active-filter-chip__date-input active-filter-chip__date-input--dormant"
          type="date"
          value=""
          onChange={(e) => {
            if (e.target.value) {
              this.props.onEditValue(
                { from: e.target.value, to: "" },
                this.state.pendingNegate,
              );
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
              this.props.onEditValue(
                { from: "", to: e.target.value },
                this.state.pendingNegate,
              );
            }
          }}
          aria-label="Pick an end date to activate this filter"
          title="Pick an end date"
        />
      </span>
    );
  }

  renderWorkspaceFolderValue() {
    const { value } = this.props;
    return (
      <span className="active-filter-chip__value-text" title={value}>
        {value || <em className="active-filter-chip__empty">folder</em>}
      </span>
    );
  }

  /**
   * Dormant single-value: "all" label with type-appropriate activation trigger.
   * Multi-value dormant chips use renderMultiSelectValue() directly.
   */
  renderDormantSingleValue() {
    const { chipType } = this.props;

    if (chipType === CHIP_TYPE_DATE || chipType === CHIP_TYPE_DATE_EX) {
      return (
        <React.Fragment>
          <span className="active-filter-chip__dormant-label">all</span>
          <input
            className="active-filter-chip__date-input active-filter-chip__date-input--dormant"
            type="date"
            value=""
            onChange={(e) => {
              if (e.target.value) {
                this.props.onEditValue(
                  e.target.value,
                  this.state.pendingNegate,
                );
              }
            }}
            aria-label={`Pick a date for ${this.props.name}`}
            title="Pick a date to activate this filter"
          />
        </React.Fragment>
      );
    }

    // Free-text dormant chip — click "all" to start editing
    return (
      <span
        className="active-filter-chip__dormant-label active-filter-chip__dormant-label--clickable"
        role="button"
        tabIndex={0}
        onClick={() => this.setState({ isEditingValue: true, editValue: "" })}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            this.setState({ isEditingValue: true, editValue: "" });
          }
        }}
        aria-label={`Set a value for ${this.props.name}`}
        title="Click to set a filter value"
      >
        {this.state.isEditingValue ? this.renderDormantTextEditor() : "all"}
      </span>
    );
  }

  renderDormantTextEditor() {
    return (
      <input
        className="active-filter-chip__value-input"
        type="text"
        value={this.state.editValue}
        onChange={this.onEditChange}
        onKeyDown={(e) => {
          if (e.key === "Enter" && this.state.editValue) {
            this.props.onEditValue(
              this.state.editValue,
              this.state.pendingNegate,
            );
            this.setState({ isEditingValue: false, pendingNegate: false });
          } else if (e.key === "Escape") {
            this.setState({ isEditingValue: false, editValue: "" });
          }
        }}
        onBlur={() => {
          if (this.state.editValue) {
            this.props.onEditValue(
              this.state.editValue,
              this.state.pendingNegate,
            );
          }
          this.setState({ isEditingValue: false, pendingNegate: false });
        }}
        autoFocus
        aria-label={`Enter value for ${this.props.name}`}
        placeholder="Type a value..."
      />
    );
  }

  /** Dispatch to the right renderer based on chip configuration */
  renderValueEditor() {
    const { chipType, kind, dormant } = this.props;

    switch (kind) {
      case CHIP_KIND_DATE_RANGE:
        return dormant
          ? this.renderDormantDateRange()
          : this.renderDateRangeValue();

      case CHIP_KIND_MULTI:
        // Multi-value chips always use the multi-select dropdown
        // (handles dormant "all" display internally)
        return this.renderMultiSelectValue();

      case CHIP_KIND_SINGLE:
      default:
        // Dormant single-value chips
        if (dormant) {
          return this.renderDormantSingleValue();
        }
        // Active single-value chips
        switch (chipType) {
          case CHIP_TYPE_DATE:
          case CHIP_TYPE_DATE_EX:
            return this.renderDateValue();
          case CHIP_TYPE_WORKSPACE_FOLDER:
            return this.renderWorkspaceFolderValue();
          default:
            return this.renderTextValue();
        }
    }
  }

  render() {
    const { name, negate, chipType, onRemove, onToggleNegate, dormant, kind } =
      this.props;
    const isWorkspaceFolder = chipType === CHIP_TYPE_WORKSPACE_FOLDER;
    const isDormant = !!dormant;
    // A dormant multi-value chip with pending selections looks semi-active
    const hasPending =
      isDormant &&
      kind === CHIP_KIND_MULTI &&
      this.state.pendingValues.length > 0;

    // Dormant chips use local pending negate; active chips use the prop
    const effectiveNegate = isDormant ? this.state.pendingNegate : negate;

    return (
      <span
        className={[
          "active-filter-chip",
          effectiveNegate ? "active-filter-chip--negate" : "",
          isDormant && !hasPending ? "active-filter-chip--dormant" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role="group"
        aria-label={`${effectiveNegate ? "Exclude" : "Include"} ${name} filter${isDormant && !hasPending ? " (inactive)" : ""}`}
      >
        {/* Include/Exclude toggle — left segment
            Inert (always +) on: dormant chips with no pending values, workspace_folder (backend unsupported) */}
        <button
          className={[
            "active-filter-chip__negate-btn",
            (isDormant && !hasPending) || isWorkspaceFolder
              ? "active-filter-chip__negate-btn--inert"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={
            isWorkspaceFolder
              ? undefined
              : isDormant && !hasPending
                ? undefined
                : isDormant
                  ? this.togglePendingNegate
                  : onToggleNegate
          }
          aria-label={
            isWorkspaceFolder
              ? "Including (scope filter)"
              : isDormant && !hasPending
                ? "Including"
                : effectiveNegate
                  ? "Excluding — click to include"
                  : "Including — click to exclude"
          }
          aria-pressed={effectiveNegate}
          title={
            isWorkspaceFolder
              ? "Including (scope filter)"
              : isDormant && !hasPending
                ? "Including"
                : effectiveNegate
                  ? "Excluding (click to include)"
                  : "Including (click to exclude)"
          }
        >
          <div className="active-filter-chip__button-icon" aria-hidden="true">
            {(isDormant && !hasPending) || isWorkspaceFolder
              ? "+"
              : effectiveNegate
                ? "−"
                : "+"}
          </div>
        </button>

        {/* Body — middle segment containing name + value */}
        <span className="active-filter-chip__body">
          <span className="active-filter-chip__name">{name}</span>
          <span className="active-filter-chip__value">
            {this.renderValueEditor()}
          </span>
        </span>

        {/* Right cap — remove button when active/pending, empty cap when dormant */}
        {isDormant && !hasPending ? (
          <span className="active-filter-chip__end-cap" aria-hidden="true" />
        ) : (
          <button
            className="active-filter-chip__remove-btn"
            onClick={
              isDormant
                ? () =>
                    this.setState({
                      pendingValues: [],
                      pendingNegate: false,
                      dropdownOpen: false,
                    })
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
  }
}
