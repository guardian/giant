import { useCallback, useMemo, useState } from "react";
import { HighlightForSearchNavigation, HighlightsState } from "./model";
import { removeLastUnmatchedQuote } from "../../util/stringUtils";
import authFetch from "../../util/auth/authFetch";

/**
 * - "find": on-demand find-in-document queries typed by the user.
 * - "search": the workspace-level search query, fixed for the lifetime of the
 *   page viewer. Parses chip syntax and returns highlights with a distinct prefix
 *   so both sets can coexist without colliding.
 */
type HighlightEndpoint = "search" | "find";

export type HighlightNavigationState = {
  query: string;
  highlightsState: HighlightsState;
  focusedHighlight: HighlightForSearchNavigation | null;
  isPending: boolean;
  fetchHighlights: (query: string) => Promise<void> | undefined;
  jumpToNext: () => void;
  jumpToPrevious: () => void;
};

export function useHighlightNavigation(
  uri: string,
  endpoint: HighlightEndpoint,
): HighlightNavigationState {
  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [highlights, setHighlights] = useState<HighlightForSearchNavigation[]>(
    [],
  );
  const [isPending, setIsPending] = useState(false);

  const fetchHighlights = useCallback(
    (q: string) => {
      if (!q) {
        setFocusedIndex(null);
        setHighlights([]);
        setQuery("");
        return;
      }

      const params = new URLSearchParams();
      // The backend will respect quotes and do an exact search,
      // but if quotes are unbalanced elasticsearch will error
      params.set("q", removeLastUnmatchedQuote(q));

      setQuery(q);
      setIsPending(true);
      // TODO: handle error
      return authFetch(`/api/pages2/${uri}/${endpoint}?${params.toString()}`)
        .then((res) => res.json())
        .then((results: HighlightForSearchNavigation[]) => {
          setIsPending(false);
          setHighlights(results);
          setFocusedIndex(results.length > 0 ? 0 : null);
        });
    },
    [uri, endpoint],
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
    query,
    highlightsState,
    focusedHighlight,
    isPending,
    fetchHighlights,
    jumpToNext,
    jumpToPrevious,
  };
}
