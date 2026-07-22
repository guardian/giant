export const COMBINED_VIEW = "combined";

/**
 * Views whose content is derived from the page text that backs the Combined
 * view, and which Elasticsearch therefore highlights against fields the page
 * index also contains (`text`, `ocr`). A match in one of these is normally also
 * reachable in Combined.
 *
 * Transcript / vttTranscript views are deliberately excluded: that content does
 * not live in the page index, and audio/video documents have no pages anyway.
 * The same will apply to any future translation view.
 */
export function isTextLikeView(view: string): boolean {
  return view === "text" || view.startsWith("ocr");
}

/**
 * Decide which view a paged document should open in, given its pageCount
 * response (which also answers whether the search query matches in the page
 * index — see getPageCount).
 *
 * Background (issues #733 / #760): Elasticsearch has no concept of the
 * "Combined" view — it is assembled in the frontend from the page index. So
 * search picks the document field with the most highlights (e.g. `text`,
 * `ocr.english`) and forces that view via `?view=…`, which then suppresses the
 * Combined default and lands the user in flat text/OCR even when Combined would
 * show the same match in the view we actually want people to use.
 *
 * This resolves that: prefer Combined whenever the search query is also
 * reachable there (`searchMatchesInPages`), and only fall back to the
 * search-forced flat view when it is not — e.g. lossy Tesseract OCR,
 * cross-field matches, or future translation matches that don't exist in the
 * page index. A document opened without a search query, or with an explicit
 * non-text view, is left untouched.
 *
 * Returns the view to switch to, or undefined to leave the current view alone.
 * The caller runs this once per pageCount response, so a user manually
 * switching tabs afterwards is never overridden.
 */
export function resolveInitialPagedView({
  pageCount,
  currentView,
  hasSearchQuery,
  searchMatchesInPages,
}: {
  pageCount: number;
  currentView: string | undefined;
  hasSearchQuery: boolean;
  // true/false from the backend when a query was sent; null or undefined when
  // no query was sent, or from a backend that predates the parameter.
  searchMatchesInPages: boolean | null | undefined;
}): string | undefined {
  // No pages means there is no Combined view to prefer.
  if (pageCount <= 0) {
    return undefined;
  }

  // Paged document with no view yet → default to Combined (existing behaviour,
  // e.g. opening from an ingestion or workspace).
  if (!currentView) {
    return COMBINED_VIEW;
  }

  // Search forced a text-like view: prefer Combined when the match is known to
  // be reachable there; otherwise honour the forced view so the user still
  // lands on a real match.
  if (
    hasSearchQuery &&
    isTextLikeView(currentView) &&
    searchMatchesInPages === true
  ) {
    return COMBINED_VIEW;
  }

  // Honour any other explicit view (Combined, preview, table, transcript, or a
  // text-like view without a search query or without a page match).
  return undefined;
}
