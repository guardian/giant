import { useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import _ from "lodash";
import { GiantState } from "../../types/redux/GiantState";
import { Resource } from "../../types/Resource";
import { setCurrentHighlight } from "../../actions/highlights";

export interface SearchHighlightStepper {
  query: string;
  currentHighlight?: number;
  totalHighlights: number;
  next: () => void;
  previous: () => void;
}

export function useSearchHighlightStepper(): SearchHighlightStepper {
  const dispatch = useDispatch();

  const resource = useSelector<GiantState, Resource | null>(
    (state) => state.resource,
  );
  const view = useSelector<GiantState, string | undefined>(
    (state) => state.urlParams.view,
  );
  const query = useSelector<GiantState, string>((state) => state.urlParams.q);

  const { currentHighlight, totalHighlights } = useSelector(
    (state: GiantState) => {
      if (state.resource && state.urlParams.view) {
        const highlights =
          state.highlights[`${state.resource.uri}-${state.urlParams.q}`];
        const highlightForView = _.get(highlights, state.urlParams.view);
        const currentHighlight = highlightForView?.currentHighlight;
        const viewItemHighlights = _.get(
          state.resource,
          state.urlParams.view,
        )?.highlights;
        const totalHighlights = viewItemHighlights
          ? viewItemHighlights.length
          : 0;
        return { currentHighlight, totalHighlights };
      }

      return { currentHighlight: undefined, totalHighlights: 0 };
    },
  );

  const next = useCallback(() => {
    if (!resource || !view) return;
    const isLastHighlight =
      totalHighlights > 0 && currentHighlight === totalHighlights - 1;
    const newHighlight =
      currentHighlight === undefined || isLastHighlight
        ? 0
        : currentHighlight + 1;
    dispatch(setCurrentHighlight(resource.uri, query, view, newHighlight));
  }, [resource, view, query, currentHighlight, totalHighlights, dispatch]);

  const previous = useCallback(() => {
    if (!resource || !view) return;
    const isFirstHighlight =
      currentHighlight === undefined || currentHighlight === 0;
    const lastHighlight = totalHighlights > 0 ? totalHighlights - 1 : 0;
    const newHighlight = isFirstHighlight
      ? lastHighlight
      : currentHighlight - 1;
    dispatch(setCurrentHighlight(resource.uri, query, view, newHighlight));
  }, [resource, view, query, currentHighlight, totalHighlights, dispatch]);

  return {
    query: query,
    currentHighlight,
    totalHighlights,
    next,
    previous,
  };
}
