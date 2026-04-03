import { PDFPageProxy } from "pdfjs-dist";
import { range, uniq } from "lodash";

// Copy-pasta from the old reducer
export type PageDimensions = {
  width: number;
  height: number;
  top: number;
  bottom: number;
};

export type HighlightSpan = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export type FindHighlight = {
  type: "FindHighlight";
  id: string;
  data: HighlightSpan[];
};

export type SearchHighlight = {
  type: "SearchHighlight";
  id: string;
  data: HighlightSpan[];
};

export type Highlight = SearchHighlight | FindHighlight; // TODO MRB: add a highlight type for comments

// Used for positioning overlay text
export type PdfText = {
  value: string;
  left: string;
  top: string;
  fontSize: string;
  fontFamily: string;
  transform: string;
};

export type PageData = {
  // TODO: Do we need this value wrapper? Keep getting lost looking for highlights, then remember I need to expand value
  page: number;
  dimensions: PageDimensions;
  // The highlights as rectangles to overlay on the document
  highlights: Highlight[];
  currentLanguage: string;
  allLanguages: string;
};

export type CachedPreview = {
  canvas: HTMLCanvasElement;
  scale: number;
  // This is returned so that the page renderer can enqueue extracting the
  // text overlays *after* the first paint which should imporove snappiness.
  pdfPage: PDFPageProxy;
};

export type HighlightForSearchNavigation = {
  pageNumber: number;
  highlightNumber: number;
  id: string;
  firstSpan: {
    x: number;
    y: number;
    height: number;
    rotation: number;
    width: number;
  } | null;
};

export type HighlightsState = {
  // Beware !focusedIndex for checking null, since it can be 0
  focusedIndex: number | null;
  highlights: HighlightForSearchNavigation[];
};

export function getPreloadPages(highlightState: HighlightsState): number[] {
  if (
    highlightState.focusedIndex === null ||
    highlightState.highlights.length === 0
  ) {
    return [];
  }

  const length = highlightState.highlights.length;

  // From three highlights before to three highlights after,
  // wrapping if we hit an edge. If there are fewer than seven highlights,
  // we'll get them all, the uniq() call will prevent duplicates.
  const indexesOfHighlightsToPreload = uniq(
    range(-3, 3).map((offset) => {
      // type guard does not extend into .map() it seems
      const offsetIndex = (highlightState.focusedIndex ?? 0) + offset;
      // modulo - the regular % is 'remainder' in JS which is different
      return ((offsetIndex % length) + length) % length;
    }),
  );

  return uniq(
    indexesOfHighlightsToPreload.map(
      (idx) => highlightState.highlights[idx].pageNumber,
    ),
  );
}
