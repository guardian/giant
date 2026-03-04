import _isString from "lodash/isString";
import _isObject from "lodash/isObject";
import { isMultiValueChip } from "./ActiveFilterChip";

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

    // Group multi-value chip types by name
    const definedChips = [];
    const multiValueGroups = new Map();

    rawChips.forEach((element) => {
      const name = element.n;
      const fieldDef = (suggestedFields || []).find(
        (f) => f.name === name
      );

      if (isMultiValueChip(name)) {
        if (!multiValueGroups.has(name)) {
          // Backend sends one chip with OR-joined values; split them back
          const values = element.v
            .split(" OR ")
            .map((v) => v.trim())
            .filter(Boolean);
          const uiChip = {
            name,
            values,
            negate: element.op === "-",
            chipType: element.t,
            multiValue: true,
            options: fieldDef ? fieldDef.options : undefined,
          };
          multiValueGroups.set(name, uiChip);
          definedChips.push(uiChip);
        } else {
          // If there are somehow multiple separate backend chips for the same
          // multi-value type (e.g. from legacy queries), merge them
          const existing = multiValueGroups.get(name);
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
