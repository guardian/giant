import React from "react";
import PropTypes from "prop-types";

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
  { value: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "Word (.docx)" },
  { value: "application/vnd.ms-excel", label: "Excel (.xls)" },
  { value: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", label: "Excel (.xlsx)" },
  { value: "application/vnd.ms-powerpoint", label: "PowerPoint (.ppt)" },
  { value: "application/vnd.openxmlformats-officedocument.presentationml.presentation", label: "PowerPoint (.pptx)" },
  { value: "message/rfc822", label: "Email (.eml)" },
  { value: "application/zip", label: "ZIP Archive" },
  { value: "audio/mpeg", label: "MP3 Audio" },
  { value: "video/mp4", label: "MP4 Video" },
];

/** Number of values shown inline before truncation with "+N more" */
const MAX_VISIBLE_VALUES = 2;

/**
 * Chip names that support multiple simultaneous values.
 * One UI chip ↔ N backend chips of the same name.
 */
const MULTI_VALUE_CHIP_NAMES = new Set(["Mime Type", "Has Field"]);

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

/** Resolve the options list for a multi-value chip. */
function getMultiSelectOptions(name, propOptions) {
  if (name === "Mime Type") return MIME_TYPE_OPTIONS;
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
    negate: PropTypes.bool.isRequired,
    chipType: PropTypes.string.isRequired,
    /** Whether this chip supports multi-value selection */
    multiValue: PropTypes.bool,
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
    // Pending values for dormant multi-value chips (committed on dropdown close)
    pendingValues: [],
    // Pending negate for dormant chips (committed alongside values)
    pendingNegate: false,
  };

  dropdownRef = React.createRef();

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
      this.setState({ dropdownOpen: false });
      // Commit pending values on dormant multi-value chips
      if (this.props.dormant && this.state.pendingValues.length > 0) {
        this.props.onEditValue([...this.state.pendingValues], this.state.pendingNegate);
        this.setState({ pendingValues: [], pendingNegate: false });
      }
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
        />
      );
    }

    return (
      <span
        className="active-filter-chip__value-text active-filter-chip__value-text--editable"
        onClick={this.onStartEdit}
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
    const selectedValues = dormant ? pendingValues : (values || []);

    // Build truncated display text
    let displayText;
    if (selectedValues.length === 0) {
      displayText = "all";
    } else if (selectedValues.length <= MAX_VISIBLE_VALUES) {
      displayText = selectedValues
        .map((v) => getDisplayLabel(v, allOptions))
        .join(", ");
    } else {
      const visible = selectedValues
        .slice(0, MAX_VISIBLE_VALUES)
        .map((v) => getDisplayLabel(v, allOptions));
      displayText = `${visible.join(", ")} +${selectedValues.length - MAX_VISIBLE_VALUES} more`;
    }

    return (
      <span className="active-filter-chip__multi-select" ref={this.dropdownRef}>
        <span
          className="active-filter-chip__multi-select-trigger"
          onClick={() => this.setState({ dropdownOpen: !dropdownOpen })}
          title="Click to select values"
        >
          {displayText}
          <span className="active-filter-chip__multi-select-arrow">▾</span>
        </span>
        {dropdownOpen && (
          <div className="active-filter-chip__multi-select-dropdown">
            {allOptions.map((opt) => (
              <label
                key={opt.value}
                className="active-filter-chip__multi-select-option"
              >
                <input
                  type="checkbox"
                  checked={selectedValues.includes(opt.value)}
                  onChange={() => this.toggleMultiValue(opt.value)}
                />
                <span className="active-filter-chip__multi-select-option-label">
                  {opt.label}
                </span>
              </label>
            ))}
            {allOptions.length === 0 && (
              <div className="active-filter-chip__multi-select-empty">
                No options available
              </div>
            )}
          </div>
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
        title={chipType === "date_ex" ? "Select date (exclusive)" : "Select date"}
      />
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

    if (chipType === "date" || chipType === "date_ex") {
      return (
        <React.Fragment>
          <span className="active-filter-chip__dormant-label">all</span>
          <input
            className="active-filter-chip__date-input active-filter-chip__date-input--dormant"
            type="date"
            value=""
            onChange={(e) => {
              if (e.target.value) {
                this.props.onEditValue(e.target.value, this.state.pendingNegate);
              }
            }}
            title="Pick a date to activate this filter"
          />
        </React.Fragment>
      );
    }

    // Free-text dormant chip — click "all" to start editing
    return (
      <span
        className="active-filter-chip__dormant-label active-filter-chip__dormant-label--clickable"
        onClick={() => this.setState({ isEditingValue: true, editValue: "" })}
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
            this.props.onEditValue(this.state.editValue, this.state.pendingNegate);
            this.setState({ isEditingValue: false, pendingNegate: false });
          } else if (e.key === "Escape") {
            this.setState({ isEditingValue: false, editValue: "" });
          }
        }}
        onBlur={() => {
          if (this.state.editValue) {
            this.props.onEditValue(this.state.editValue, this.state.pendingNegate);
          }
          this.setState({ isEditingValue: false, pendingNegate: false });
        }}
        autoFocus
        placeholder="Type a value..."
      />
    );
  }

  /** Dispatch to the right renderer based on chip configuration */
  renderValueEditor() {
    const { chipType, multiValue, dormant } = this.props;

    // Multi-value chips always use the multi-select dropdown
    // (handles dormant "all" display internally)
    if (multiValue) {
      return this.renderMultiSelectValue();
    }

    // Dormant single-value chips
    if (dormant) {
      return this.renderDormantSingleValue();
    }

    // Active single-value chips
    switch (chipType) {
      case "date":
      case "date_ex":
        return this.renderDateValue();
      case "workspace_folder":
        return this.renderWorkspaceFolderValue();
      case "text":
      default:
        return this.renderTextValue();
    }
  }

  render() {
    const { name, negate, chipType, onRemove, onToggleNegate, dormant, multiValue } = this.props;
    const isWorkspaceFolder = chipType === "workspace_folder";
    const isDormant = !!dormant;
    // A dormant multi-value chip with pending selections looks semi-active
    const hasPending = isDormant && multiValue && this.state.pendingValues.length > 0;

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
      >
        {/* Include/Exclude toggle — left segment (static + on dormant chips) */}
        <button
          className={[
            "active-filter-chip__negate-btn",
            isDormant && !hasPending ? "active-filter-chip__negate-btn--inert" : "",
          ].filter(Boolean).join(" ")}
          onClick={isDormant && !hasPending ? undefined : isDormant ? this.togglePendingNegate : onToggleNegate}
          title={
            isDormant && !hasPending
              ? "Including"
              : effectiveNegate
                ? "Excluding (click to include)"
                : "Including (click to exclude)"
          }
        >
          <div className="active-filter-chip__button-icon">
            {isDormant && !hasPending ? "+" : effectiveNegate ? "−" : "+"}
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
          <span className="active-filter-chip__end-cap" />
        ) : (
          <button
            className="active-filter-chip__remove-btn"
            onClick={
              isDormant
                ? () => this.setState({ pendingValues: [], pendingNegate: false, dropdownOpen: false })
                : onRemove
            }
            title={hasPending ? "Clear selections" : "Remove filter"}
          >
            <div className="active-filter-chip__button-icon">
              ×
            </div>
          </button>
        )}
      </span>
    );
  }
}
