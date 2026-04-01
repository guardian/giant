/**
 * Tri-state cycling logic shared by all filter components.
 *
 * Each filter value can be in one of three states:
 *   off → positive (include) → negative (exclude) → off
 *
 * This module provides a pure function that computes the next
 * positive/negative arrays after toggling a single key.
 */

export type TriState = "off" | "positive" | "negative";

export interface PolarityArrays {
  positive: string[];
  negative: string[];
}

/** Determine the current tri-state for a key. */
export function getTriState(
  key: string,
  positive: string[],
  negative: string[],
): TriState {
  if (positive.includes(key)) return "positive";
  if (negative.includes(key)) return "negative";
  return "off";
}

/**
 * Cycle a single key through: off → positive → negative → off.
 *
 * Returns new positive/negative arrays (the originals are not mutated).
 */
export function triStateCycle(
  key: string,
  positive: string[],
  negative: string[],
): PolarityArrays {
  const state = getTriState(key, positive, negative);

  switch (state) {
    case "off":
      return { positive: [...positive, key], negative };
    case "positive":
      return {
        positive: positive.filter((k) => k !== key),
        negative: [...negative, key],
      };
    case "negative":
      return {
        positive,
        negative: negative.filter((k) => k !== key),
      };
  }
}
