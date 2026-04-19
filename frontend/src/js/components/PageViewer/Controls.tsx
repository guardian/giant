import React, { FC, useCallback, useEffect, useState } from "react";
import { SearchStepper } from "./SearchStepper";
import { HighlightForSearchNavigation, HighlightsState } from "./model";
import { removeLastUnmatchedQuote } from "../../util/stringUtils";
import authFetch from "../../util/auth/authFetch";

type ControlsProps = {
  fixedQuery: string;
  uri: string;
  onHighlightStateChange: (newState: HighlightsState) => void;
};

export const Controls: FC<ControlsProps> = ({
  fixedQuery,
  uri,
  onHighlightStateChange,
}) => {
  const [focusedFindHighlightIndex, setFocusedFindHighlightIndex] = useState<
    number | null
  >(null);
  const [findHighlights, setFindHighlights] = useState<
    HighlightForSearchNavigation[]
  >([]);
  const [isFindPending, setIsFindPending] = useState<boolean>(false);

  useEffect(() => {
    onHighlightStateChange({
      focusedIndex: focusedFindHighlightIndex,
      highlights: findHighlights,
    });
  }, [focusedFindHighlightIndex, findHighlights, onHighlightStateChange]);

  const performFind = useCallback(
    (query: string) => {
      if (!query) {
        setFocusedFindHighlightIndex(null);
        setFindHighlights([]);
        return;
      }

      const params = new URLSearchParams();
      params.set("q", removeLastUnmatchedQuote(query));
      setIsFindPending(true);
      // TODO: handle error
      return authFetch(`/api/pages2/${uri}/search?${params.toString()}`)
        .then((res) => res.json())
        .then((highlights) => {
          setIsFindPending(false);
          setFindHighlights(highlights);
          if (highlights.length > 0) {
            setFocusedFindHighlightIndex(0);
          } else {
            setFocusedFindHighlightIndex(null);
          }
        });
    },
    [uri],
  );

  // Auto-trigger the search when mounted with a fixed query
  useEffect(() => {
    if (fixedQuery) {
      performFind(fixedQuery);
    }
  }, [fixedQuery, performFind]);

  const jumpToNextFindHit = useCallback(() => {
    if (findHighlights.length > 0) {
      const nextHighlightIndex =
        focusedFindHighlightIndex !== null &&
        focusedFindHighlightIndex < findHighlights.length - 1
          ? focusedFindHighlightIndex + 1
          : 0;

      setFocusedFindHighlightIndex(nextHighlightIndex);
    }
  }, [findHighlights, focusedFindHighlightIndex]);

  const jumpToPreviousFindHit = useCallback(() => {
    if (findHighlights.length > 0) {
      const previousHighlightIndex =
        focusedFindHighlightIndex !== null && focusedFindHighlightIndex > 0
          ? focusedFindHighlightIndex - 1
          : findHighlights.length - 1;

      setFocusedFindHighlightIndex(previousHighlightIndex);
    }
  }, [findHighlights, focusedFindHighlightIndex]);

  return (
    <SearchStepper
      query={fixedQuery}
      current={focusedFindHighlightIndex ?? undefined}
      total={findHighlights.length}
      isPending={isFindPending}
      onNext={jumpToNextFindHit}
      onPrevious={jumpToPreviousFindHit}
    />
  );
};
