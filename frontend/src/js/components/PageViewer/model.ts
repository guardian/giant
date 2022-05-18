import { PDFPageProxy } from "pdfjs-dist/types/display/api";

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
