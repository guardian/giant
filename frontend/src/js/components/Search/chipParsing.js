import _isString from "lodash/isString";
import _isObject from "lodash/isObject";
import { isMultiValueChip } from "./ActiveFilterChip";
import {
  expandFileTypeValues,
} from "./fileTypeCategories";
import {
  CHIP_NAME_MIME_TYPE,
  CHIP_NAME_FILE_TYPE,
  CHIP_NAME_CREATED_AFTER,
  CHIP_NAME_CREATED_BEFORE,
  CHIP_NAME_DATE_RANGE,
  CHIP_KIND_SINGLE,
  CHIP_KIND_MULTI,
  CHIP_KIND_DATE_RANGE,
  CHIP_TYPE_FILE_TYPE,
  CHIP_TYPE_DATE_RANGE,
  CHIP_TYPE_WORKSPACE_FOLDER,
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
  if (!q) return { definedChips: [], textOnlyQ: q };

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
      if (element.n === CHIP_NAME_CREATED_AFTER || element.n === CHIP_NAME_CREATED_BEFORE) {
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
      const fieldDef = (suggestedFields || []).find(
        (f) => f.name === name
      );

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
    const textParts = JSON.parse(textOnlyQ);
    const chipParts = [];

    definedChips.forEach((c) => {
      const op = c.negate ? "-" : "+";

      switch (c.kind) {
        case CHIP_KIND_DATE_RANGE:
          if (c.from) {
            chipParts.push({ n: CHIP_NAME_CREATED_AFTER, v: c.from, op, t: CHIP_TYPE_DATE_RANGE });
          }
          if (c.to) {
            chipParts.push({ n: CHIP_NAME_CREATED_BEFORE, v: c.to, op, t: CHIP_TYPE_DATE_RANGE });
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
      if (!_isObject(element) || element.n !== CHIP_NAME_FILE_TYPE) return element;

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
 * Extract File Type category values from a q string.
 * Returns an empty array if no File Type chip is present.
 *
 * @param {string} q
 * @returns {string[]} e.g. ["pdf", "word"]
 */
export function getFileTypeCategoriesFromQ(q) {
  if (!q) return [];
  try {
    const parsed = JSON.parse(q);
    if (!Array.isArray(parsed)) return [];
    for (const el of parsed) {
      if (_isObject(el) && el.n === CHIP_NAME_FILE_TYPE) {
        return (el.v || "")
          .split(" OR ")
          .map((v) => v.trim())
          .filter(Boolean);
      }
    }
    return [];
  } catch (e) {
    return [];
  }
}

/**
 * Return a new q string with the File Type chip set to the given categories.
 * If categories is empty, the File Type chip is removed.
 * If no File Type chip exists yet, one is created.
 *
 * @param {string} q            - current serialised q
 * @param {string[]} categories - category keys, e.g. ["pdf", "word"]
 * @returns {string} updated q
 */
export function setFileTypeCategoriesInQ(q, categories) {
  const { definedChips, textOnlyQ } = parseChips(q, []);

  // Remove any existing File Type chip(s)
  const otherChips = definedChips.filter(
    (c) => c.name !== CHIP_NAME_FILE_TYPE
  );

  if (categories.length > 0) {
    otherChips.push({
      kind: CHIP_KIND_MULTI,
      name: CHIP_NAME_FILE_TYPE,
      values: categories,
      negate: false,
      chipType: CHIP_TYPE_FILE_TYPE,
    });
  }

  return rebuildQ(otherChips, textOnlyQ);
}
