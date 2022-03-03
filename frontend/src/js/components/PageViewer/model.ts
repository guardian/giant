// Hardcoded container sizes - should make these dynamic but that can wait for now...
export const CONTAINER_SIZE = 1000;
export const CONTAINER_AND_MARGIN_SIZE = 1020;

// Copy-pasta from the old reducer
export type PageDimensions = {
  width: number;
  height: number;
  top: number;
  bottom: number;
};

export type SearchResultHighlightSpan = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export type SearchResultHighlight = {
  type: "SearchResultPageHighlight";
  id: string;
  data: SearchResultHighlightSpan[];
};

export type Highlight = SearchResultHighlight; // TODO MRB: add a highlight type for comments

export type Page = {
  // TODO: Do we need this value wrapper? Keep getting lost looking for highlights, then remember I need to expand value
  page: number;
  dimensions: PageDimensions;
  // The highlights as rectangles to overlay on the document
  highlights: Highlight[];
  currentLanguage: string;
  allLanguages: string;
};
