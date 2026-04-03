import { useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import _ from "lodash";
import { GiantState } from "../../types/redux/GiantState";
import { Resource } from "../../types/Resource";
import { setCurrentHighlight } from "../../actions/highlights";

export function useSearchHighlightStepper() {
  const dispatch = useDispatch();

  const resource = useSelector<GiantState, Resource | null>(
    (state) => state.resource,
  );
  const view = useSelector<GiantState, string | undefined>(
    (state) => state.urlParams.view,
  );
  const q = useSelector<GiantState, string>((state) => state.urlParams.q);

  const { currentHighlight, totalHighlights } = useSelector(
    (state: GiantState) => {
      let currentHighlight: number | undefined;
      let totalHighlights = 0;

      if (state.resource && state.urlParams.view) {
        const highlights =
          state.highlights[`${state.resource.uri}-${state.urlParams.q}`];
        if (highlights && _.get(highlights, state.urlParams.view)) {
          currentHighlight = _.get(
            highlights,
            state.urlParams.view,
          ).currentHighlight;
        }
        const viewItem = _.get(state.resource, state.urlParams.view);
        if (viewItem) {
          totalHighlights = viewItem.highlights
            ? viewItem.highlights.length
            : 0;
        }
      }

      return { currentHighlight, totalHighlights };
    },
  );

  const next = useCallback(() => {
    if (!resource || !view) return;
    let newHighlight: number;
    if (totalHighlights > 0 && currentHighlight === totalHighlights - 1) {
      newHighlight = 0;
    } else if (currentHighlight === undefined) {
      newHighlight = 0;
    } else {
      newHighlight = currentHighlight + 1;
    }
    dispatch(setCurrentHighlight(resource.uri, q, view, newHighlight));
  }, [resource, view, q, currentHighlight, totalHighlights, dispatch]);

  const previous = useCallback(() => {
    if (!resource || !view) return;
    let newHighlight: number;
    if (currentHighlight === 0) {
      newHighlight = (totalHighlights || 1) - 1;
    } else if (currentHighlight === undefined) {
      newHighlight = (totalHighlights || 1) - 1;
    } else {
      newHighlight = currentHighlight - 1;
    }
    dispatch(setCurrentHighlight(resource.uri, q, view, newHighlight));
  }, [resource, view, q, currentHighlight, totalHighlights, dispatch]);

  return {
    query: q,
    currentHighlight,
    totalHighlights,
    next,
    previous,
  };
}
