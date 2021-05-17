import { ThunkAction } from "redux-thunk";
import { fetchPages } from "../../components/viewer/PageViewer/pageViewerApi";
import { GiantAction, PagesActionType } from "../../types/redux/GiantActions";
import { GiantState } from "../../types/redux/GiantState";

export function loadPages(pageApiUri: string, viewportTop: number, viewportBottom: number, q?: string): ThunkAction<void, GiantState, void, GiantAction> {
    return async dispatch => {
        const doc = await fetchPages(pageApiUri, viewportTop, viewportBottom, q);
        dispatch({ type: PagesActionType.SET_PAGES, doc });
    };
}