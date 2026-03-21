/**
 * Shared constants for chip names, types, and kinds.
 *
 * All magic strings live here so typos cause import errors
 * rather than silent runtime bugs.
 */

// ── Chip names (the `n` field in the backend wire format) ────────────

export const CHIP_NAME_MIME_TYPE = "Mime Type";
export const CHIP_NAME_FILE_TYPE = "File Type";
export const CHIP_NAME_HAS_FIELD = "Has Field";
export const CHIP_NAME_CREATED_AFTER = "Created After";
export const CHIP_NAME_CREATED_BEFORE = "Created Before";
export const CHIP_NAME_DATE_RANGE = "Date Range";
export const CHIP_NAME_WORKSPACE_FOLDER = "workspace_folder";
export const CHIP_NAME_DATASET = "Dataset";
export const CHIP_NAME_WORKSPACE = "Workspace";
export const CHIP_NAME_LANGUAGE = "Language";

// ── Chip kinds (discriminated union tag for UI chip shape) ───────────

/** Single-value chip: has `value` (string) */
export const CHIP_KIND_SINGLE = "single";
/** Multi-value chip: has `values` (string[]) */
export const CHIP_KIND_MULTI = "multi";
/** Date Range chip: has `from` and `to` (strings) */
export const CHIP_KIND_DATE_RANGE = "dateRange";

// ── Chip types (the `t` field — UI rendering hint) ──────────────────

export const CHIP_TYPE_TEXT = "text";
export const CHIP_TYPE_DATE = "date";
export const CHIP_TYPE_DATE_EX = "date_ex";
export const CHIP_TYPE_DROPDOWN = "dropdown";
export const CHIP_TYPE_FILE_TYPE = "file_type";
export const CHIP_TYPE_DATE_RANGE = "date_range";
export const CHIP_TYPE_WORKSPACE_FOLDER = "workspace_folder";
export const CHIP_TYPE_DATASET = "dataset";
export const CHIP_TYPE_WORKSPACE = "workspace";

// ── Multi-value chip names ──────────────────────────────────────────

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
