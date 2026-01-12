import { PagesAction, PagesActionType } from "../types/redux/GiantActions";
import { PagesState } from "../types/redux/GiantState";

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

export type SearchHighlight = {
  type: "SearchHighlight";
  id: string;
  data: SearchResultHighlightSpan[];
};

export type PageHighlight = SearchHighlight; // TODO MRB: add a highlight type for comments

export type Page = {
  // TODO: Do we need this value wrapper? Keep getting lost looking for highlights, then remember I need to expand value
  page: number;
  dimensions: PageDimensions;
  // The highlights as rectangles to overlay on the document
  highlights: PageHighlight[];
  currentLanguage: string;
  allLanguages: string;
};

export type PagedDocumentSummary = {
  numberOfPages: number;
  height: number;
};

export type PagedDocument = {
  summary: PagedDocumentSummary;
  pages: Array<Page>;
};

export function getNextOrPreviousHighlight(
  highlights: string[],
  navigationAction: "next" | "previous",
  currentHighlight: string,
): string {
  const currentIx = highlights.indexOf(currentHighlight);

  switch (navigationAction) {
    case "next":
      return highlights[(currentIx + 1) % highlights.length];

    case "previous":
      return currentIx === 0
        ? highlights[highlights.length - 1]
        : highlights[currentIx - 1];
  }
}

export function getSortedHighlightIds(doc: PagedDocument): string[] {
  const highlightIds = doc.pages.flatMap((page) =>
    page.highlights.map((h) => h.id),
  );
  return highlightIds.sort();
}

function getHighlightAfterPageLoad(
  doc: PagedDocument,
  lastHighlight?: string,
): string | undefined {
  const highlights = getSortedHighlightIds(doc);

  if (highlights.length === 0) {
    return undefined;
  }

  return lastHighlight ?? highlights[0];
}

// We store refs to the highlights to call scrollIntoView if they are off-screen when the user switches to them
// When the user scrolls and loads in a new page (but keeping the old page on-screen), the VDOM will keep the
// existing highlight elements so we should keep them too, as we won't get another mount callback for them.
function preserveMountedRefs(
  doc: PagedDocument,
  refs: { [id: string]: HTMLElement },
): { [id: string]: HTMLElement } {
  const ret: { [id: string]: HTMLElement } = {};

  for (const [id, ref] of Object.entries(refs)) {
    if (doc.pages.some((p) => p.highlights.some((h) => h.id === id))) {
      ret[id] = ref;
    }
  }

  return ret;
}

const initialState: PagesState = {
  mountedHighlightElements: {},
};

export default function pageViewerReducer(
  before: PagesState | undefined,
  action: PagesAction,
): PagesState {
  if (!before) {
    return initialState;
  }

  switch (action.type) {
    case PagesActionType.SET_CURRENT_HIGHLIGHT_ID:
      return {
        ...before,
        currentHighlightId: action.newHighlightId,
      };

    case PagesActionType.SEARCH_HIGHLIGHT_MOUNTED:
      return {
        ...before,
        mountedHighlightElements: {
          ...before.mountedHighlightElements,
          [action.id]: action.element,
        },
      };

    case PagesActionType.SET_PAGES: {
      const currentHighlightId = getHighlightAfterPageLoad(
        action.doc,
        before.currentHighlightId,
      );
      const mountedHighlightElements = preserveMountedRefs(
        action.doc,
        before.mountedHighlightElements,
      );

      return {
        doc: action.doc,
        currentHighlightId,
        mountedHighlightElements,
      };
    }

    case PagesActionType.RESET_PAGES:
      return initialState;

    default:
      return before;
  }
}
