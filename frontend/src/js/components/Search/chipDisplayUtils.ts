export interface SelectOption {
  value: string;
  label: string;
}

/** Get the display label for a value given an options list. */
export function getDisplayLabel(
  value: string,
  allOptions: SelectOption[] | null | undefined,
): string {
  if (!allOptions) return value;
  const opt = allOptions.find((o) => o.value === value);
  return opt ? opt.label : value;
}

/** Maximum character budget for display text in a multi-value chip.
 * Individual labels are ellipsis-truncated to fit, and a "+N more"
 * suffix is appended when not all values fit within the budget. */
export const MAX_DISPLAY_CHARS = 36;

/**
 * Build a character-budget-aware display string from an array of labels.
 *
 * Algorithm:
 * 1. If all labels joined with ", " fit within `budget`, return them.
 * 2. Otherwise greedily add labels while they fit. Each label after the
 *    first costs an extra 2 chars for ", ". Reserve space for the
 *    " +N more" suffix (where N = remaining items).
 * 3. A single label that exceeds the budget is ellipsis-truncated so
 *    there's always at least one visible name.
 */
export function truncateChipDisplay(labels: string[], budget: number): string {
  if (labels.length === 0) return "all";

  const full = labels.join(", ");
  if (full.length <= budget) return full;

  const ELLIPSIS = "\u2026"; // …
  const SEPARATOR = ", ";
  const shown: string[] = [];
  let used = 0;

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const remaining = labels.length - i - 1;
    const sepCost = shown.length > 0 ? SEPARATOR.length : 0;
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
