import clamp from "lodash/clamp";

/**
 * Resolve a raw page-number input (as typed into the footer's page field)
 * to a valid page in the range [1, totalPages], or null if the input isn't
 * a usable number.
 *
 * Pure and side-effect free so it can be unit tested directly.
 */
export function parsePageInput(raw: string, totalPages: number): number | null {
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? clamp(parsed, 1, totalPages) : null;
}
