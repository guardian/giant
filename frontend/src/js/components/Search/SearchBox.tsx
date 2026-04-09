import React, {
  useState,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";

import { ProgressAnimation } from "../UtilComponents/ProgressAnimation";
import ActiveFiltersBar from "./ActiveFiltersBar";
import AddFilterModal from "./AddFilterModal";
import { isMultiValueChip } from "./chipNames";
import {
  parseChips,
  rebuildQ,
  Chip,
  ParsedChips,
  SuggestedField,
} from "./chipParsing";
import { ChipEditValue } from "./ActiveFilterChip";
import {
  CHIP_NAME_DATASET,
  CHIP_NAME_WORKSPACE,
  CHIP_KIND_SINGLE,
  CHIP_KIND_MULTI,
  CHIP_KIND_DATE_RANGE,
  CHIP_TYPE_DATE_RANGE,
} from "./chipNames";

export function extractPlainText(q: string | null | undefined): string {
  if (!q) return "";
  try {
    const parsed = JSON.parse(q);
    if (!Array.isArray(parsed)) return q;
    return parsed.filter((s: unknown) => typeof s === "string").join(" ");
  } catch {
    return q;
  }
}

export function wrapPlainText(text: string): string {
  return JSON.stringify([text]);
}

interface SidebarFilter {
  key: string;
  options: { value: string; display: string }[];
}

export interface SearchBoxProps {
  searchText: string;
  onSearchTextChange: (text: string) => void;
  q: string;
  isSearchInProgress: boolean;
  onFilterChange: (q: string) => void;
  resetQuery: () => void;
  suggestedFields?: SuggestedField[];
  sidebarFilters?: SidebarFilter[];
  onSubmit: () => void;
}

export interface SearchBoxHandle {
  focus: () => void;
  select: () => void;
}

const SearchBox = forwardRef<SearchBoxHandle, SearchBoxProps>(
  function SearchBox(
    {
      searchText,
      onSearchTextChange,
      q,
      isSearchInProgress,
      onFilterChange,
      resetQuery,
      suggestedFields,
      sidebarFilters,
      onSubmit,
    },
    ref,
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingChip, setEditingChip] = useState<Chip | null>(null);
    const [editingChipIndex, setEditingChipIndex] = useState(-1);

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      select: () => textareaRef.current?.select(),
    }));

    const chipsParsed = useCallback((): ParsedChips => {
      return parseChips(q, suggestedFields || []);
    }, [q, suggestedFields]);

    const rebuildQWithCurrentText = useCallback(
      (definedChips: Chip[]): string => {
        return rebuildQ(definedChips, wrapPlainText(searchText));
      },
      [searchText],
    );

    const handleRemoveChip = useCallback(
      (index: number) => {
        const { definedChips } = chipsParsed();
        const newChips = definedChips.filter((_, i) => i !== index);
        onFilterChange(rebuildQWithCurrentText(newChips));
      },
      [chipsParsed, onFilterChange, rebuildQWithCurrentText],
    );

    const handleToggleNegate = useCallback(
      (index: number) => {
        const { definedChips } = chipsParsed();
        const chip = definedChips[index];
        const targetNegate = !chip.negate;

        if (chip.kind === CHIP_KIND_MULTI) {
          const targetIndex = definedChips.findIndex(
            (c, i) =>
              i !== index &&
              c.name === chip.name &&
              c.kind === CHIP_KIND_MULTI &&
              c.negate === targetNegate,
          );
          if (targetIndex !== -1) {
            const merged = { ...definedChips[targetIndex] } as typeof chip;
            const mergedValues = [...merged.values];
            (chip.values || []).forEach((v) => {
              if (!mergedValues.includes(v)) mergedValues.push(v);
            });
            merged.values = mergedValues;
            const newChips = definedChips
              .map((c, i) => (i === targetIndex ? merged : c))
              .filter((_, i) => i !== index);
            onFilterChange(rebuildQWithCurrentText(newChips));
            return;
          }
        }

        const newChips = definedChips.map((c, i) =>
          i === index ? { ...c, negate: targetNegate } : c,
        );
        onFilterChange(rebuildQWithCurrentText(newChips));
      },
      [chipsParsed, onFilterChange, rebuildQWithCurrentText],
    );

    const handleEditChipValue = useCallback(
      (index: number, newValueOrValues: ChipEditValue) => {
        const { definedChips } = chipsParsed();
        let newChips = definedChips.map((c, i) => {
          if (i !== index) return c;
          switch (c.kind) {
            case CHIP_KIND_DATE_RANGE:
              if (
                newValueOrValues &&
                typeof newValueOrValues === "object" &&
                !Array.isArray(newValueOrValues)
              ) {
                return {
                  ...c,
                  from: newValueOrValues.from,
                  to: newValueOrValues.to,
                };
              }
              return c;
            case CHIP_KIND_MULTI: {
              const values = Array.isArray(newValueOrValues)
                ? (newValueOrValues as string[])
                : [newValueOrValues as string];
              return { ...c, values };
            }
            case CHIP_KIND_SINGLE:
            default:
              return { ...c, value: newValueOrValues as string };
          }
        });
        // Remove multi-value chips with no values left
        newChips = newChips.filter(
          (c) =>
            !(
              c.kind === CHIP_KIND_MULTI &&
              (c as MultiChipLike).values.length === 0
            ),
        );
        // Remove date range chips with both dates cleared
        newChips = newChips.filter(
          (c) =>
            !(
              c.kind === CHIP_KIND_DATE_RANGE &&
              !(c as DateRangeLike).from &&
              !(c as DateRangeLike).to
            ),
        );
        onFilterChange(rebuildQWithCurrentText(newChips as Chip[]));
      },
      [chipsParsed, onFilterChange, rebuildQWithCurrentText],
    );

    const handleActivateDefault = useCallback(
      (
        name: string,
        valueOrValues: ChipEditValue,
        chipType: string,
        negate = false,
      ) => {
        const { definedChips } = chipsParsed();

        // Date Range activation
        if (
          chipType === CHIP_TYPE_DATE_RANGE &&
          valueOrValues &&
          typeof valueOrValues === "object" &&
          !Array.isArray(valueOrValues)
        ) {
          const existingIndex = definedChips.findIndex(
            (c) => c.kind === CHIP_KIND_DATE_RANGE && c.negate === negate,
          );
          if (existingIndex !== -1) {
            const existing = definedChips[existingIndex];
            if (existing.kind === CHIP_KIND_DATE_RANGE) {
              const merged = { ...existing };
              if (valueOrValues.from) merged.from = valueOrValues.from;
              if (valueOrValues.to) merged.to = valueOrValues.to;
              const newChips = definedChips.map((c, i) =>
                i === existingIndex ? merged : c,
              );
              onFilterChange(rebuildQWithCurrentText(newChips));
              return;
            }
          }
          const newChip: Chip = {
            kind: CHIP_KIND_DATE_RANGE,
            name: "Date Range",
            negate,
            chipType: CHIP_TYPE_DATE_RANGE,
            from: valueOrValues.from || "",
            to: valueOrValues.to || "",
          };
          onFilterChange(rebuildQWithCurrentText([...definedChips, newChip]));
          return;
        }

        const multi = isMultiValueChip(name);
        const incomingValues = multi
          ? Array.isArray(valueOrValues)
            ? valueOrValues
            : [valueOrValues]
          : null;

        // Try to merge into existing chip of same name+polarity
        if (multi) {
          const existingIndex = definedChips.findIndex(
            (c) =>
              c.name === name &&
              c.kind === CHIP_KIND_MULTI &&
              c.negate === negate,
          );
          if (existingIndex !== -1) {
            const existing = definedChips[existingIndex];
            if (existing.kind === CHIP_KIND_MULTI) {
              const merged = { ...existing };
              const mergedValues = [...merged.values];
              incomingValues!.forEach((v) => {
                if (!mergedValues.includes(v as string))
                  mergedValues.push(v as string);
              });
              merged.values = mergedValues;
              const newChips = definedChips.map((c, i) =>
                i === existingIndex ? merged : c,
              );
              onFilterChange(rebuildQWithCurrentText(newChips));
              return;
            }
          }
        }

        // Create new chip
        const newChip: Chip = multi
          ? {
              kind: CHIP_KIND_MULTI,
              name,
              negate,
              chipType,
              values: (incomingValues || []) as string[],
            }
          : {
              kind: CHIP_KIND_SINGLE,
              name,
              negate,
              chipType,
              value: valueOrValues as string,
            };
        onFilterChange(rebuildQWithCurrentText([...definedChips, newChip]));
      },
      [chipsParsed, onFilterChange, rebuildQWithCurrentText],
    );

    // ── Modal handlers ──────────────────────────────────────────────

    const handleOpenAddFilter = useCallback(
      (chip?: Chip, chipIndex?: number) => {
        if (chip && chipIndex !== undefined && chipIndex >= 0) {
          setEditingChip(chip);
          setEditingChipIndex(chipIndex);
        } else {
          setEditingChip(null);
          setEditingChipIndex(-1);
        }
        setModalOpen(true);
      },
      [],
    );

    const handleCloseModal = useCallback(() => {
      setModalOpen(false);
      setEditingChip(null);
      setEditingChipIndex(-1);
    }, []);

    const handleModalConfirm = useCallback(
      (chip: Chip, editIndex: number) => {
        if (editIndex >= 0) {
          const { definedChips } = chipsParsed();
          const newChips = definedChips.map((c, i) =>
            i === editIndex ? chip : c,
          );
          onFilterChange(rebuildQWithCurrentText(newChips));
        } else {
          switch (chip.kind) {
            case CHIP_KIND_DATE_RANGE:
              handleActivateDefault(
                chip.name,
                { from: chip.from, to: chip.to },
                chip.chipType,
                chip.negate,
              );
              break;
            case CHIP_KIND_MULTI:
              handleActivateDefault(
                chip.name,
                chip.values,
                chip.chipType,
                chip.negate,
              );
              break;
            case CHIP_KIND_SINGLE:
            default:
              handleActivateDefault(
                chip.name,
                chip.value,
                chip.chipType,
                chip.negate,
              );
              break;
          }
        }
        handleCloseModal();
      },
      [
        chipsParsed,
        onFilterChange,
        rebuildQWithCurrentText,
        handleActivateDefault,
        handleCloseModal,
      ],
    );

    // ── Text input handlers ─────────────────────────────────────────

    const handleSearchTextChange = (
      e: React.ChangeEvent<HTMLTextAreaElement>,
    ) => {
      onSearchTextChange(e.target.value);
      autoResizeTextarea();
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
    };

    const autoResizeTextarea = () => {
      const el = textareaRef.current;
      if (el) {
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
      }
    };

    // ── Available filters (augment suggestedFields with sidebar data) ──

    const getAvailableFilters = useCallback((): SuggestedField[] => {
      const base = (suggestedFields || []) as SuggestedField[];
      const extra: SuggestedField[] = [];

      const ingestionFilter = (sidebarFilters || []).find(
        (f) => f.key === "ingestion",
      );
      if (ingestionFilter) {
        extra.push({
          name: CHIP_NAME_DATASET,
          type: "dataset",
          options: ingestionFilter.options
            .map((o) => ({ value: o.value, label: o.display }))
            .sort((a, b) =>
              a.label.localeCompare(b.label, undefined, {
                sensitivity: "base",
              }),
            ),
        });
      }

      const workspaceFilter = (sidebarFilters || []).find(
        (f) => f.key === "workspace",
      );
      if (workspaceFilter) {
        extra.push({
          name: CHIP_NAME_WORKSPACE,
          type: "workspace",
          options: workspaceFilter.options
            .map((o) => ({ value: o.value, label: o.display }))
            .sort((a, b) =>
              a.label.localeCompare(b.label, undefined, {
                sensitivity: "base",
              }),
            ),
        });
      }

      return [...base, ...extra];
    }, [suggestedFields, sidebarFilters]);

    // ── Render ──────────────────────────────────────────────────────

    const { definedChips } = chipsParsed();
    const availableFilters = getAvailableFilters();

    const spinner = isSearchInProgress ? <ProgressAnimation /> : false;

    return (
      <div>
        <div className="search-box">
          <div className="search-box__input">
            <textarea
              ref={textareaRef}
              className="search-box__text-input"
              rows={1}
              value={searchText}
              onChange={handleSearchTextChange}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search…"
              aria-label="Search query"
            />
          </div>
          <div className="search__actions">{spinner}</div>
          <div className="search__buttons">
            <button
              className="btn search__button"
              title="Search"
              onClick={onSubmit}
              disabled={isSearchInProgress}
            >
              Search
            </button>
            <button
              className="btn search__button search__button--clear"
              title="Clear search query and filters"
              onClick={resetQuery}
              disabled={isSearchInProgress}
            >
              Clear
            </button>
          </div>
        </div>
        <ActiveFiltersBar
          chips={definedChips}
          availableFilters={availableFilters}
          onRemoveChip={handleRemoveChip}
          onToggleNegate={handleToggleNegate}
          onEditChipValue={handleEditChipValue}
          onActivateDefault={handleActivateDefault}
          onOpenAddFilter={handleOpenAddFilter}
        />
        <AddFilterModal
          isOpen={modalOpen}
          editingChip={editingChip}
          editingChipIndex={editingChipIndex}
          availableFilters={availableFilters}
          onConfirm={handleModalConfirm}
          onClose={handleCloseModal}
        />
      </div>
    );
  },
);

export default SearchBox;

// Internal type helpers for narrowing in handleEditChipValue
type MultiChipLike = { values: string[] };
type DateRangeLike = { from: string; to: string };
