import { HighlightForSearchNavigation, HighlightsState } from "./model";
import {
  HighlightNavigationState,
  useHighlightNavigation,
} from "./useHighlightNavigation";

export type PageFindState = {
  findQuery: string;
  highlightsState: HighlightsState;
  focusedHighlight: HighlightForSearchNavigation | null;
  isPending: boolean;
  performFind: (query: string) => Promise<void> | undefined;
  jumpToNext: () => void;
  jumpToPrevious: () => void;
};

function toPageFindState(nav: HighlightNavigationState): PageFindState {
  return {
    findQuery: nav.query,
    highlightsState: nav.highlightsState,
    focusedHighlight: nav.focusedHighlight,
    isPending: nav.isPending,
    performFind: nav.fetchHighlights,
    jumpToNext: nav.jumpToNext,
    jumpToPrevious: nav.jumpToPrevious,
  };
}

export function usePageFind(uri: string): PageFindState {
  return toPageFindState(useHighlightNavigation(uri, "find"));
}
