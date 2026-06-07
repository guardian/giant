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

type ViewResolution =
  // Not enough information yet (page count or page-match probe still pending);
  // call again when more state arrives.
  | { kind: "wait" }
  // Honour the current view.
  | { kind: "keep" }
  // Switch to this view.
  | { kind: "set"; view: string };

/**
 * Decide which view a paged document should open in.
 *
 * Background (issues #733 / #760): Elasticsearch has no concept of the
 * "Combined" view — it is assembled in the frontend from the page index. So
 * search picks the document field with the most highlights (e.g. `text`,
 * `ocr.english`) and forces that view via `?view=…`, which then suppresses the
 * Combined default and lands the user in flat text/OCR even when Combined would
 * show the same match in the view we actually want people to use.
 *
 * This resolves that: for a paged document we prefer Combined whenever the
 * search query is also reachable there (`searchMatchesInPages`), and only fall
 * back to the search-forced flat view when it is not — e.g. lossy Tesseract OCR,
 * cross-field matches, or future translation matches that don't exist in the
 * page index. A document opened without a search query, or with an explicit
 * non-text view, is left untouched.
 *
 * The caller applies this once per document load so that a user manually
 * switching to the Text/OCR tab afterwards is respected.
 */
export function resolveInitialPagedView({
  totalPages,
  currentView,
  hasSearchQuery,
  searchMatchesInPages,
}: {
  totalPages: number | null;
  currentView: string | undefined;
  hasSearchQuery: boolean;
  // null = the page-match probe has not resolved yet.
  searchMatchesInPages: boolean | null;
}): ViewResolution {
  // Wait until we know whether the document is paged.
  if (totalPages === null) {
    return { kind: "wait" };
  }

  // No pages means there is no Combined view to prefer.
  if (totalPages <= 0) {
    return { kind: "keep" };
  }

  // Paged document with no view yet → default to Combined (existing behaviour,
  // e.g. opening from an ingestion or workspace).
  if (!currentView) {
    return { kind: "set", view: COMBINED_VIEW };
  }

  // Search forced a text-like view. Prefer Combined when the match is reachable
  // there; otherwise honour the forced view so the user still lands on a real
  // match.
  if (hasSearchQuery && isTextLikeView(currentView)) {
    if (searchMatchesInPages === null) {
      return { kind: "wait" };
    }
    return searchMatchesInPages
      ? { kind: "set", view: COMBINED_VIEW }
      : { kind: "keep" };
  }

  // Any other explicit view (Combined, preview, table, transcript, or a
  // text-like view opened without a search query) → honour it.
  return { kind: "keep" };
}
