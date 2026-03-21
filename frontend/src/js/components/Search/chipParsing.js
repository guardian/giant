import _isString from "lodash/isString";
import _isObject from "lodash/isObject";
import { isMultiValueChip } from "./ActiveFilterChip";
import { expandFileTypeValues } from "./fileTypeCategories";
import {
  CHIP_NAME_MIME_TYPE,
  CHIP_NAME_FILE_TYPE,
  CHIP_NAME_DATASET,
  CHIP_NAME_WORKSPACE,
  CHIP_NAME_CREATED_AFTER,
  CHIP_NAME_CREATED_BEFORE,
  CHIP_NAME_DATE_RANGE,
  CHIP_KIND_SINGLE,
  CHIP_KIND_MULTI,
  CHIP_KIND_DATE_RANGE,
  CHIP_TYPE_FILE_TYPE,
  CHIP_TYPE_DATE_RANGE,
  CHIP_TYPE_DATASET,
  CHIP_TYPE_WORKSPACE,
} from "./chipNames";

/**
 * Parse a q value (JSON-encoded array of strings and chip objects)
 * into plain text elements and defined chip elements.
 *
 * Each UI chip has a `kind` discriminant:
 *   - "single":    { kind, name, value, negate, chipType }
 *   - "multi":     { kind, name, values, negate, chipType }
 *   - "dateRange": { kind, name, from, to, negate, chipType }
 *
 * Multi-value chip types (e.g. Mime Type, Has Field, File Type) are grouped:
 * multiple backend chips with the same name → one UI chip with values[].
 *
 * Date chips (Created After / Created Before) are consolidated into
 * a single Date Range chip with from/to fields.
 *
 * @param {string} q - The serialized query string
 * @param {Array} suggestedFields - Available field definitions (for options)
 * @returns {{ definedChips: Array, textOnlyQ: string }}
 */
export function parseChips(q, suggestedFields) {
  if (!q) return { definedChips: [], textOnlyQ: "[]" };

  try {
    const parsed = JSON.parse(q);
    if (!Array.isArray(parsed)) return { definedChips: [], textOnlyQ: q };

    const textParts = [];
    const rawChips = [];

    parsed.forEach((element) => {
      if (_isString(element)) {
        textParts.push(element);
      } else if (_isObject(element) && element.n && element.v !== undefined) {
        if (element.v !== "") {
          rawChips.push(element);
        } else {
          textParts.push(element);
        }
      }
    });

    const definedChips = [];
    const multiValueGroups = new Map();
    // Accumulate date range halves by polarity, merge after loop
    const dateRangeAccum = new Map();

    rawChips.forEach((element) => {
      const negate = element.op === "-";

      // ── Date Range consolidation ──────────────────────────────
      if (
        element.n === CHIP_NAME_CREATED_AFTER ||
        element.n === CHIP_NAME_CREATED_BEFORE
      ) {
        const polarityKey = negate ? "-" : "+";
        if (!dateRangeAccum.has(polarityKey)) {
          dateRangeAccum.set(polarityKey, { from: "", to: "", negate });
        }
        const acc = dateRangeAccum.get(polarityKey);
        if (element.n === CHIP_NAME_CREATED_AFTER) acc.from = element.v;
        if (element.n === CHIP_NAME_CREATED_BEFORE) acc.to = element.v;
        return;
      }

      // ── Normal chip handling ──────────────────────────────────
      const name = element.n;
      const groupKey = `${name}|${negate ? "-" : "+"}`;
      const fieldDef = (suggestedFields || []).find((f) => f.name === name);

      if (isMultiValueChip(name)) {
        if (!multiValueGroups.has(groupKey)) {
          const values = element.v
            .split(" OR ")
            .map((v) => v.trim())
            .filter(Boolean);
          const uiChip = {
            kind: CHIP_KIND_MULTI,
            name,
            values,
            negate,
            chipType: element.t,
            options: fieldDef ? fieldDef.options : undefined,
          };
          multiValueGroups.set(groupKey, uiChip);
          definedChips.push(uiChip);
        } else {
          const existing = multiValueGroups.get(groupKey);
          const extraValues = element.v
            .split(" OR ")
            .map((v) => v.trim())
            .filter(Boolean);
          extraValues.forEach((v) => {
            if (!existing.values.includes(v)) {
              existing.values.push(v);
            }
          });
        }
      } else {
        definedChips.push({
          kind: CHIP_KIND_SINGLE,
          name,
          value: element.v,
          negate,
          chipType: element.t,
          options: fieldDef ? fieldDef.options : undefined,
          workspaceId: element.workspaceId,
          folderId: element.folderId,
        });
      }
    });

    // Materialise accumulated date range chips
    dateRangeAccum.forEach((acc) => {
      if (acc.from || acc.to) {
        definedChips.push({
          kind: CHIP_KIND_DATE_RANGE,
          name: CHIP_NAME_DATE_RANGE,
          from: acc.from || "",
          to: acc.to || "",
          negate: acc.negate,
          chipType: CHIP_TYPE_DATE_RANGE,
        });
      }
    });

    const textOnlyQ = JSON.stringify(textParts);
    return { definedChips, textOnlyQ };
  } catch (e) {
    return { definedChips: [], textOnlyQ: q };
  }
}

/**
 * Rebuild the full q value by combining text-only q with the defined chips.
 *
 * Each chip's `kind` determines serialization:
 *   - "multi":     single backend chip with OR-joined values
 *   - "dateRange": expands to Created After + Created Before backend chips
 *   - "single":    one backend chip
 *
 * File Type chips are serialized as { n: "File Type", v: "pdf OR web", ... }.
 * Use toBackendQ() at the API boundary to expand them for the backend.
 *
 * @param {Array} definedChips - UI chip objects (with `kind` discriminant)
 * @param {string} textOnlyQ - JSON-encoded array of text + in-progress chips
 * @returns {string} - The full serialized q value
 */
export function rebuildQ(definedChips, textOnlyQ) {
  try {
    const textParts = textOnlyQ ? JSON.parse(textOnlyQ) : [];
    const chipParts = [];

    definedChips.forEach((c) => {
      const op = c.negate ? "-" : "+";

      switch (c.kind) {
        case CHIP_KIND_DATE_RANGE:
          if (c.from) {
            chipParts.push({
              n: CHIP_NAME_CREATED_AFTER,
              v: c.from,
              op,
              t: CHIP_TYPE_DATE_RANGE,
            });
          }
          if (c.to) {
            chipParts.push({
              n: CHIP_NAME_CREATED_BEFORE,
              v: c.to,
              op,
              t: CHIP_TYPE_DATE_RANGE,
            });
          }
          break;

        case CHIP_KIND_MULTI:
          if ((c.values || []).length > 0) {
            chipParts.push({
              n: c.name,
              v: c.values.join(" OR "),
              op,
              t: c.chipType,
            });
          }
          break;

        case CHIP_KIND_SINGLE:
        default: {
          const chip = { n: c.name, v: c.value, op, t: c.chipType };
          if (c.workspaceId) chip.workspaceId = c.workspaceId;
          if (c.folderId) chip.folderId = c.folderId;
          chipParts.push(chip);
          break;
        }
      }
    });

    return JSON.stringify([...textParts, ...chipParts]);
  } catch (e) {
    return textOnlyQ;
  }
}

/**
 * Transform a UI q string into one the backend can process.
 *
 * Currently this only expands File Type category chips:
 *   { n: "File Type", v: "pdf OR web" }
 *     → { n: "Mime Type", v: "application/pdf OR text/html OR ..." }
 *
 * Call this at the API boundary — NOT in rebuildQ — so that
 * the URL-stored q value stays human-readable and round-trips cleanly.
 *
 * @param {string} q - The serialized q value (from rebuildQ or the URL)
 * @returns {string} - Backend-ready q value
 */
export function toBackendQ(q) {
  if (!q) return q;
  try {
    const parsed = JSON.parse(q);
    if (!Array.isArray(parsed)) return q;

    const transformed = parsed.map((element) => {
      if (!_isObject(element) || element.n !== CHIP_NAME_FILE_TYPE)
        return element;

      // Expand File Type category keys → concrete MIME types
      const categoryKeys = (element.v || "")
        .split(" OR ")
        .map((v) => v.trim())
        .filter(Boolean);
      const mimes = expandFileTypeValues(categoryKeys);
      if (mimes.length === 0) return element;

      // Quote each MIME type so that forward slashes (e.g. image/jpeg) are not
      // interpreted as regex delimiters in the ES query-string syntax.
      return {
        ...element,
        n: CHIP_NAME_MIME_TYPE,
        v: mimes.map((m) => `"${m}"`).join(" OR "),
      };
    });

    return JSON.stringify(transformed);
  } catch (e) {
    return q;
  }
}

// ── Sidebar ↔ Chip bridging helpers ─────────────────────────────────

/**
 * Extract File Type category values from a q string, split by polarity.
 *
 * @param {string} q
 * @returns {{ positive: string[], negative: string[] }}
 */
export function getFileTypeCategoriesFromQ(q) {
  const empty = { positive: [], negative: [] };
  if (!q) return empty;
  try {
    const parsed = JSON.parse(q);
    if (!Array.isArray(parsed)) return empty;
    const result = { positive: [], negative: [] };
    for (const el of parsed) {
      if (_isObject(el) && el.n === CHIP_NAME_FILE_TYPE) {
        const values = (el.v || "")
          .split(" OR ")
          .map((v) => v.trim())
          .filter(Boolean);
        if (el.op === "-") {
          result.negative.push(...values);
        } else {
          result.positive.push(...values);
        }
      }
    }
    return result;
  } catch (e) {
    return empty;
  }
}

/**
 * Strip contradictions: if a value appears in both positive and negative,
 * positive wins and the value is removed from negative.
 */
function stripContradictions(positive, negative) {
  const positiveSet = new Set(positive);
  return negative.filter((v) => !positiveSet.has(v));
}

/**
 * Return a new q string with File Type chips set to the given categories.
 * Supports separate positive and negative (excluded) categories.
 * Contradictions are resolved: positive wins.
 *
 * @param {string} q - current serialised q
 * @param {{ positive: string[], negative: string[] }} categories
 * @returns {string} updated q
 */
export function setFileTypeCategoriesInQ(q, categories) {
  const { positive = [], negative: rawNegative = [] } = categories || {};
  const negative = stripContradictions(positive, rawNegative);
  const { definedChips, textOnlyQ } = parseChips(q, []);

  // Remove any existing File Type chip(s)
  const otherChips = definedChips.filter((c) => c.name !== CHIP_NAME_FILE_TYPE);

  if (positive.length > 0) {
    otherChips.push({
      kind: CHIP_KIND_MULTI,
      name: CHIP_NAME_FILE_TYPE,
      values: positive,
      negate: false,
      chipType: CHIP_TYPE_FILE_TYPE,
    });
  }

  if (negative.length > 0) {
    otherChips.push({
      kind: CHIP_KIND_MULTI,
      name: CHIP_NAME_FILE_TYPE,
      values: negative,
      negate: true,
      chipType: CHIP_TYPE_FILE_TYPE,
    });
  }

  return rebuildQ(otherChips, textOnlyQ);
}

// ── Workspace / Dataset chip ↔ sidebar helpers ──────────────────────

/**
 * Extract Dataset/Workspace values from a q string, split by polarity.
 *
 * @param {string} chipName - CHIP_NAME_DATASET or CHIP_NAME_WORKSPACE
 * @param {string} q
 * @returns {{ positive: string[], negative: string[] }}
 */
function getChipValuesFromQ(chipName, q) {
  const empty = { positive: [], negative: [] };
  if (!q) return empty;
  try {
    const parsed = JSON.parse(q);
    if (!Array.isArray(parsed)) return empty;
    const result = { positive: [], negative: [] };
    for (const el of parsed) {
      if (_isObject(el) && el.n === chipName) {
        const vals = (el.v || "")
          .split(" OR ")
          .map((v) => v.trim())
          .filter(Boolean);
        if (el.op === "-") {
          result.negative.push(...vals);
        } else {
          result.positive.push(...vals);
        }
      }
    }
    return result;
  } catch (e) {
    return empty;
  }
}

/**
 * Get the currently-selected dataset (collection/ingestion) values from q.
 * Returns { positive: [], negative: [] } when no Dataset chip is active (= "all").
 */
export function getDatasetsFromQ(q) {
  return getChipValuesFromQ(CHIP_NAME_DATASET, q);
}

/**
 * Get the currently-selected workspace IDs from q.
 * Returns { positive: [], negative: [] } when no Workspace chip is active (= "all").
 */
export function getWorkspacesFromQ(q) {
  return getChipValuesFromQ(CHIP_NAME_WORKSPACE, q);
}

/**
 * Return a new q string with Dataset chip values set.
 * Pass { positive: [], negative: [] } to remove the chip (= "all").
 */
export function setDatasetsInQ(q, values) {
  return setMultiChipInQ(q, CHIP_NAME_DATASET, CHIP_TYPE_DATASET, values);
}

/**
 * Return a new q string with Workspace chip values set.
 * Pass { positive: [], negative: [] } to remove the chip (= "all").
 */
export function setWorkspacesInQ(q, values) {
  return setMultiChipInQ(q, CHIP_NAME_WORKSPACE, CHIP_TYPE_WORKSPACE, values);
}

/**
 * Generic helper: set a multi-value chip's positive and negative values in q.
 * If both arrays are empty, the chip is removed entirely.
 *
 * @param {string} q
 * @param {string} chipName
 * @param {string} chipType
 * @param {{ positive: string[], negative: string[] }} values
 */
function setMultiChipInQ(q, chipName, chipType, values) {
  const { positive = [], negative: rawNegative = [] } = values || {};
  const negative = stripContradictions(positive, rawNegative);
  const { definedChips, textOnlyQ } = parseChips(q, []);
  const otherChips = definedChips.filter((c) => c.name !== chipName);

  if (positive.length > 0) {
    otherChips.push({
      kind: CHIP_KIND_MULTI,
      name: chipName,
      values: positive,
      negate: false,
      chipType,
    });
  }

  if (negative.length > 0) {
    otherChips.push({
      kind: CHIP_KIND_MULTI,
      name: chipName,
      values: negative,
      negate: true,
      chipType,
    });
  }

  return rebuildQ(otherChips, textOnlyQ);
}

/**
 * Extract Dataset and Workspace chip values from q, returning:
 *   - cleanedQ: q with Dataset/Workspace chips removed
 *   - chipFilters: { workspace?, ingestion?, workspace_exclude?, ingestion_exclude? }
 *
 * Called at the API boundary so that chip-based filtering is sent as
 * workspace[]/ingestion[] (include) and workspace_exclude[]/ingestion_exclude[]
 * (exclude) query params — the backend doesn't handle these as q-string chips.
 */
export function extractCollectionAndWorkspaceChips(q) {
  if (!q) return { cleanedQ: q, chipFilters: {} };
  try {
    const parsed = JSON.parse(q);
    if (!Array.isArray(parsed)) return { cleanedQ: q, chipFilters: {} };

    const kept = [];
    const workspaceValues = [];
    const ingestionValues = [];
    const workspaceExcludeValues = [];
    const ingestionExcludeValues = [];

    for (const el of parsed) {
      if (_isObject(el) && el.n === CHIP_NAME_WORKSPACE) {
        const vals = (el.v || "")
          .split(" OR ")
          .map((v) => v.trim())
          .filter(Boolean);
        if (el.op === "-") {
          workspaceExcludeValues.push(...vals);
        } else {
          workspaceValues.push(...vals);
        }
      } else if (_isObject(el) && el.n === CHIP_NAME_DATASET) {
        const vals = (el.v || "")
          .split(" OR ")
          .map((v) => v.trim())
          .filter(Boolean);
        if (el.op === "-") {
          ingestionExcludeValues.push(...vals);
        } else {
          ingestionValues.push(...vals);
        }
      } else {
        kept.push(el);
      }
    }

    // Strip contradictions at the API boundary — positive wins
    const cleanWorkspaceExclude = stripContradictions(
      workspaceValues,
      workspaceExcludeValues,
    );
    const cleanIngestionExclude = stripContradictions(
      ingestionValues,
      ingestionExcludeValues,
    );

    const chipFilters = {};
    if (workspaceValues.length > 0) chipFilters.workspace = workspaceValues;
    if (ingestionValues.length > 0) chipFilters.ingestion = ingestionValues;
    if (cleanWorkspaceExclude.length > 0)
      chipFilters.workspace_exclude = cleanWorkspaceExclude;
    if (cleanIngestionExclude.length > 0)
      chipFilters.ingestion_exclude = cleanIngestionExclude;

    return { cleanedQ: JSON.stringify(kept), chipFilters };
  } catch (e) {
    return { cleanedQ: q, chipFilters: {} };
  }
}
