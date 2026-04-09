import React, { useRef, useCallback } from "react";
import { useSelect } from "downshift";
import {
  SelectOption,
  getDisplayLabel,
  truncateChipDisplay,
  MAX_DISPLAY_CHARS,
} from "./chipDisplayUtils";

interface MultiSelectDropdownProps {
  name: string;
  options: SelectOption[];
  /** Currently committed values (used when the chip is active) */
  values?: string[];
  /** Locally accumulated values (used when the chip is dormant) */
  pendingValues: string[];
  dormant?: boolean;
  onToggleValue: (value: string) => void;
  onClose: () => void;
}

/**
 * Multi-select dropdown for filter chips, powered by Downshift's useSelect
 * hook which handles keyboard navigation, ARIA attributes, and focus
 * management automatically.
 */
const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  name,
  options,
  values,
  pendingValues,
  dormant,
  onToggleValue,
  onClose,
}) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedValues = dormant ? pendingValues : values || [];

  const displayText =
    selectedValues.length === 0
      ? "all"
      : truncateChipDisplay(
          selectedValues.map((v) => getDisplayLabel(v, options)),
          MAX_DISPLAY_CHARS,
        );

  const handleSelectedItemChange = useCallback(
    ({ selectedItem }: { selectedItem: SelectOption | null | undefined }) => {
      if (selectedItem) {
        onToggleValue(selectedItem.value);
      }
    },
    [onToggleValue],
  );

  const {
    isOpen,
    getToggleButtonProps,
    getMenuProps,
    getItemProps,
    highlightedIndex,
  } = useSelect({
    items: options,
    // Keep the menu open after selection (multi-select behaviour).
    // Downshift calls stateReducer on every state change, so we intercept
    // the item-click and keydown-enter actions to prevent auto-close.
    stateReducer: (_state, actionAndChanges) => {
      const { changes, type } = actionAndChanges;
      switch (type) {
        case useSelect.stateChangeTypes.ItemClick:
        case useSelect.stateChangeTypes.ToggleButtonKeyDownEnter:
        case useSelect.stateChangeTypes.ToggleButtonKeyDownSpaceButton:
          return { ...changes, isOpen: true };
        default:
          return changes;
      }
    },
    onSelectedItemChange: handleSelectedItemChange,
    itemToString: (item) => item?.label ?? "",
  });

  // Notify parent when the dropdown closes (for dormant chip commit)
  const prevOpenRef = useRef(isOpen);
  React.useEffect(() => {
    if (prevOpenRef.current && !isOpen) {
      onClose();
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, onClose]);

  const dropdownId = `multi-select-dropdown-${name.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <span className="active-filter-chip__multi-select">
      <button
        {...getToggleButtonProps({
          ref: triggerRef,
          className: "active-filter-chip__multi-select-trigger",
          "aria-label": `${name}: ${displayText}. Click to ${isOpen ? "close" : "open"} options`,
          title: "Click to select values",
        })}
      >
        <span aria-hidden="true">{displayText}</span>
        <span
          className="active-filter-chip__multi-select-arrow"
          aria-hidden="true"
        >
          ▾
        </span>
      </button>
      <ul
        {...getMenuProps({
          id: dropdownId,
          className: `active-filter-chip__multi-select-dropdown${isOpen ? "" : " active-filter-chip__multi-select-dropdown--hidden"}`,
        })}
      >
        {isOpen &&
          options.map((opt, idx) => {
            const isSelected = selectedValues.includes(opt.value);
            const isFocused = highlightedIndex === idx;
            return (
              <li
                key={opt.value}
                {...getItemProps({
                  item: opt,
                  index: idx,
                  className: [
                    "active-filter-chip__multi-select-option",
                    isFocused
                      ? "active-filter-chip__multi-select-option--focused"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" "),
                  "aria-selected": isSelected,
                })}
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
        {isOpen && options.length === 0 && (
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
    </span>
  );
};

export default MultiSelectDropdown;
