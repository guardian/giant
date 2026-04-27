import { useCallback, useMemo, useState } from "react";
import { HighlightForSearchNavigation, HighlightsState } from "./model";
import { removeLastUnmatchedQuote } from "../../util/stringUtils";
import authFetch from "../../util/auth/authFetch";

export type PageFindState = {
  findQuery: string;
  highlightsState: HighlightsState;
  focusedHighlight: HighlightForSearchNavigation | null;
  isPending: boolean;
  performFind: (query: string) => Promise<void> | undefined;
  jumpToNext: () => void;
  jumpToPrevious: () => void;
};

export function usePageFind(uri: string): PageFindState {
  const [findQuery, setFindQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [highlights, setHighlights] = useState<HighlightForSearchNavigation[]>(
    [],
  );
  const [isPending, setIsPending] = useState(false);

  const performFind = useCallback(
    (query: string) => {
      if (!query) {
        setFocusedIndex(null);
        setHighlights([]);
        setFindQuery("");
        return;
      }

      const params = new URLSearchParams();
      // The backend will respect quotes and do an exact search,
      // but if quotes are unbalanced elasticsearch will error
      params.set("q", removeLastUnmatchedQuote(query));

      setFindQuery(query);
      setIsPending(true);
      // TODO: handle error
      return authFetch(`/api/pages2/${uri}/find?${params.toString()}`)
        .then((res) => res.json())
        .then((results: HighlightForSearchNavigation[]) => {
          setIsPending(false);
          setHighlights(results);
          setFocusedIndex(results.length > 0 ? 0 : null);
        });
    },
    [uri],
  );

  const jumpToNext = useCallback(() => {
    if (highlights.length > 0) {
      setFocusedIndex((prev) =>
        prev !== null && prev < highlights.length - 1 ? prev + 1 : 0,
      );
    }
  }, [highlights.length]);

  const jumpToPrevious = useCallback(() => {
    if (highlights.length > 0) {
      setFocusedIndex((prev) =>
        prev !== null && prev > 0 ? prev - 1 : highlights.length - 1,
      );
    }
  }, [highlights.length]);

  const highlightsState = useMemo<HighlightsState>(
    () => ({
      focusedIndex,
      highlights,
    }),
    [focusedIndex, highlights],
  );

  const focusedHighlight =
    focusedIndex !== null ? (highlights[focusedIndex] ?? null) : null;

  return {
    findQuery,
    highlightsState,
    focusedHighlight,
    isPending,
    performFind,
    jumpToNext,
    jumpToPrevious,
  };
}
