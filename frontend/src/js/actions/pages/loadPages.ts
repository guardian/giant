import { ThunkAction } from "redux-thunk";
import { fetchPages } from "../../components/viewer/PageViewer/pageViewerApi";
import { GiantAction, PagesActionType } from "../../types/redux/GiantActions";
import { GiantState } from "../../types/redux/GiantState";

export function loadPages(
  uri: string,
  q?: string,
  maybeViewportTop?: number,
  maybeViewportBottom?: number,
): ThunkAction<void, GiantState, void, GiantAction> {
  const viewportTop = maybeViewportTop ?? 0;
  const viewportBottom = maybeViewportBottom ?? window.innerHeight;
  const pageApiUri = `/api/pages/text/${uri}`;

  return async (dispatch) => {
    const doc = await fetchPages(pageApiUri, viewportTop, viewportBottom, q);
    dispatch({ type: PagesActionType.SET_PAGES, doc });
  };
}
