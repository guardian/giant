import React, { FC, useEffect } from "react";
import { SearchStepper } from "./SearchStepper";
import { HighlightsState } from "./model";
import { useHighlightNavigation } from "./useHighlightNavigation";

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
  const {
    highlightsState,
    isPending,
    fetchHighlights,
    jumpToNext,
    jumpToPrevious,
  } = useHighlightNavigation(uri, "search");

  useEffect(() => {
    onHighlightStateChange(highlightsState);
  }, [highlightsState, onHighlightStateChange]);

  // Auto-trigger the search when mounted with a fixed query
  useEffect(() => {
    if (fixedQuery) {
      fetchHighlights(fixedQuery);
    }
  }, [fixedQuery, fetchHighlights]);

  return (
    <SearchStepper
      query={fixedQuery}
      current={highlightsState.focusedIndex ?? undefined}
      total={highlightsState.highlights.length}
      isPending={isPending}
      onNext={jumpToNext}
      onPrevious={jumpToPrevious}
    />
  );
};
