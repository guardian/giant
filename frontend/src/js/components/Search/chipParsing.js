import _isString from "lodash/isString";
import _isObject from "lodash/isObject";
import { isMultiValueChip } from "./ActiveFilterChip";
import {
  expandFileTypeValues,
  collapseMimesToCategories,
} from "./fileTypeCategories";

/**
 * Parse a q value (JSON-encoded array of strings and chip objects)
 * into plain text elements and defined chip elements.
 *
 * Multi-value chip types (e.g. Mime Type, Has Field) are grouped:
 * multiple backend chips with the same name → one UI chip with values[].
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
          // In-progress chips (no value yet) stay inline
          textParts.push(element);
        }
      }
    });

    // Group multi-value chip types by (name, polarity)
    // e.g. +Mime Type and -Mime Type are separate UI chips
    const definedChips = [];
    const multiValueGroups = new Map();
    // Accumulate date range halves by polarity, merge after loop
    const dateRangeAccum = new Map(); // key: "+" or "-" → { from, to, negate }

    rawChips.forEach((element) => {
      const negate = element.op === "-";

      // ── Date Range consolidation ──────────────────────────────
      // Merge Created After / Created Before into a single Date Range chip
      if (element.n === "Created After" || element.n === "Created Before") {
        const polarityKey = negate ? "-" : "+";
        if (!dateRangeAccum.has(polarityKey)) {
          dateRangeAccum.set(polarityKey, { from: "", to: "", negate });
        }
        const acc = dateRangeAccum.get(polarityKey);
        if (element.n === "Created After") acc.from = element.v;
        if (element.n === "Created Before") acc.to = element.v;
        return; // consumed — will be added after loop
      }

      // ── File Type reconstitution ──────────────────────────────
      // Backend chip: { n: "Mime Type", v: "…OR…", t: "file_type" }
      // UI chip:      { name: "File Type", values: ["pdf","spreadsheet"], … }
      if (element.n === "Mime Type" && element.t === "file_type") {
        const mimes = element.v
          .split(" OR ")
          .map((v) => v.trim())
          .filter(Boolean);
        const categoryKeys = collapseMimesToCategories(mimes);
        if (categoryKeys.length > 0) {
          const ftGroupKey = `File Type|${negate ? "-" : "+"}`;
          if (!multiValueGroups.has(ftGroupKey)) {
            const uiChip = {
              name: "File Type",
              values: categoryKeys,
              negate,
              chipType: "file_type",
              multiValue: true,
            };
            multiValueGroups.set(ftGroupKey, uiChip);
            definedChips.push(uiChip);
          } else {
            const existing = multiValueGroups.get(ftGroupKey);
            categoryKeys.forEach((k) => {
              if (!existing.values.includes(k)) {
                existing.values.push(k);
              }
            });
          }
        }
        return; // consumed — do not also create a Mime Type chip
      }

      // ── Normal chip handling ──────────────────────────────────
      const name = element.n;
      const groupKey = `${name}|${negate ? "-" : "+"}`;
      const fieldDef = (suggestedFields || []).find(
        (f) => f.name === name
      );

      if (isMultiValueChip(name)) {
        if (!multiValueGroups.has(groupKey)) {
          // Backend sends one chip with OR-joined values; split them back
          const values = element.v
            .split(" OR ")
            .map((v) => v.trim())
            .filter(Boolean);
          const uiChip = {
            name,
            values,
            negate,
            chipType: element.t,
            multiValue: true,
            options: fieldDef ? fieldDef.options : undefined,
          };
          multiValueGroups.set(groupKey, uiChip);
          definedChips.push(uiChip);
        } else {
          // Merge into existing chip of the same name+polarity
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
          name,
          value: element.v,
          negate: element.op === "-",
          chipType: element.t,
          multiValue: false,
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
          name: "Date Range",
          from: acc.from || "",
          to: acc.to || "",
          negate: acc.negate,
          chipType: "date_range",
          multiValue: false,
          dateRange: true,
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
 * Multi-value UI chips are serialized as a single backend chip with OR syntax.
 *
 * @param {Array} definedChips - UI chip objects
 * @param {string} textOnlyQ - JSON-encoded array of text + in-progress chips
 * @returns {string} - The full serialized q value
 */
export function rebuildQ(definedChips, textOnlyQ) {
  try {
    const textParts = JSON.parse(textOnlyQ);
    const chipParts = [];

    definedChips.forEach((c) => {
      // ── File Type → Mime Type expansion ─────────────────────
      if (c.name === "File Type" && c.multiValue) {
        const mimes = expandFileTypeValues(c.values || []);
        if (mimes.length > 0) {
          chipParts.push({
            n: "Mime Type",
            v: mimes.join(" OR "),
            op: c.negate ? "-" : "+",
            t: "file_type", // marker so parseChips reconstitutes
          });
        }
        return;
      }

      // ── Date Range → Created After + Created Before ─────────
      if (c.dateRange) {
        const op = c.negate ? "-" : "+";
        if (c.from) {
          chipParts.push({ n: "Created After", v: c.from, op, t: "date_range" });
        }
        if (c.to) {
          chipParts.push({ n: "Created Before", v: c.to, op, t: "date_range" });
        }
        return;
      }

      if (c.multiValue) {
        // Combine all selected values into a single backend chip with OR syntax
        if ((c.values || []).length > 0) {
          chipParts.push({
            n: c.name,
            v: c.values.join(" OR "),
            op: c.negate ? "-" : "+",
            t: c.chipType,
          });
        }
      } else {
        const chip = {
          n: c.name,
          v: c.value,
          op: c.negate ? "-" : "+",
          t: c.chipType,
        };
        if (c.workspaceId) chip.workspaceId = c.workspaceId;
        if (c.folderId) chip.folderId = c.folderId;
        return chipParts.push(chip);
      }
    });

    return JSON.stringify([...textParts, ...chipParts]);
  } catch (e) {
    return textOnlyQ;
  }
}
