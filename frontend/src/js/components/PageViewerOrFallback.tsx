import React, { FC, useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import authFetch from "../util/auth/authFetch";
import { useParams } from "react-router-dom";
import get from "lodash/get";
import Viewer from "./viewer/Viewer";
import { PageViewer } from "./PageViewer/PageViewer";
import { usePageFind } from "./PageViewer/usePageFind";
import { TextPreview } from "./viewer/TextPreview";
import { Preview } from "./viewer/Preview";
import { TablePreview } from "./viewer/TablePreview";
import DownloadButton from "./viewer/DownloadButton";
import { DocumentFooter } from "./viewer/DocumentFooter";
import { SearchStepper } from "./PageViewer/SearchStepper";
import {
  SearchHighlightStepper,
  useSearchHighlightStepper,
} from "./viewer/useSearchHighlightStepper";
import { GiantState } from "../types/redux/GiantState";
import { Resource } from "../types/Resource";
import {
  PageDimensions,
  HighlightsState,
  HighlightForSearchNavigation,
} from "./PageViewer/model";
import { setResourceView } from "../actions/urlParams/setViews";
import { getComments } from "../actions/resources/getComments";
import { setSelection } from "../actions/resources/setSelection";
import { keyboardShortcuts } from "../util/keyboardShortcuts";
import { KeyboardShortcut } from "./UtilComponents/KeyboardShortcut";
import history from "../util/history";
import { useWorkspaceNavigation } from "../util/workspaceNavigation";
import { removeLastUnmatchedQuote } from "../util/stringUtils";
import {
  COMBINED_VIEW,
  resolveInitialPagedView,
} from "./PageViewer/resolveInitialPagedView";

function isCombinedOrUnset(view: string | undefined): boolean {
  return !view || view === COMBINED_VIEW;
}

function renderNoPreview() {
  return (
    <div className="viewer__no-text-preview">
      <p>
        Cannot display this document. It could still be processing or it could
        be too large.
      </p>
      <DownloadButton />
    </div>
  );
}

const PageViewerContent: FC<{
  uri: string;
  totalPages: number;
  firstPageDimensions?: PageDimensions;
  view: string | undefined;
  findQuery: string;
  findHighlightsState: HighlightsState;
  focusedFindHighlight: HighlightForSearchNavigation | null;
  rotation: number;
  scale: number;
}> = ({
  uri,
  totalPages,
  firstPageDimensions,
  view,
  findQuery,
  findHighlightsState,
  focusedFindHighlight,
  rotation,
  scale,
}) => {
  const dispatch = useDispatch();
  const resource = useSelector<GiantState, Resource | null>(
    (state) => state.resource,
  );
  const auth = useSelector((state: GiantState) => state.auth);
  const preferences = useSelector((state: GiantState) => state.app.preferences);

  if (isCombinedOrUnset(view)) {
    return (
      <PageViewer
        uri={uri}
        totalPages={totalPages}
        firstPageDimensions={firstPageDimensions}
        findQuery={findQuery}
        findHighlightsState={findHighlightsState}
        focusedFindHighlight={focusedFindHighlight}
        rotation={rotation}
        scale={scale}
      />
    );
  }

  if (!resource || !auth.token || !view) {
    return null;
  }

  if (view === "table") {
    if (!resource.text) {
      return renderNoPreview();
    }
    return <TablePreview text={resource.text.contents} />;
  } else if (view === "preview") {
    return <Preview resource={resource} />;
  } else {
    const highlightableText =
      view === "text" ? resource.text : get(resource, view);
    if (!highlightableText) {
      return renderNoPreview();
    }
    return (
      <TextPreview
        uri={resource.uri}
        currentUser={auth.token.user}
        text={highlightableText.contents}
        searchHighlights={highlightableText.highlights}
        view={view}
        comments={resource.comments}
        selection={resource.selection}
        preferences={preferences}
        getComments={(u: string) => dispatch(getComments(u))}
        setSelection={(s?: Selection) => dispatch(setSelection(s))}
      />
    );
  }
};

type PageCountResponse = {
  pageCount: number;
  dimensions: PageDimensions | null;
  // Whether the search query (if one was sent) matches in the page index —
  // i.e. whether the Combined view can show it. null when no query was sent;
  // absent from backends that predate the parameter.
  searchMatchesInPages?: boolean | null;
};

const SearchStepperOverlay: FC<{
  highlightStepper: SearchHighlightStepper;
}> = ({ highlightStepper }) => (
  <>
    <KeyboardShortcut
      shortcut={keyboardShortcuts.previousHighlight}
      func={highlightStepper.previous}
    />
    <KeyboardShortcut
      shortcut={keyboardShortcuts.nextHighlight}
      func={highlightStepper.next}
    />
    <div className="search-stepper-overlay">
      <SearchStepper
        query={highlightStepper.query}
        current={highlightStepper.currentHighlight}
        total={highlightStepper.totalHighlights}
        onNext={highlightStepper.next}
        onPrevious={highlightStepper.previous}
      />
    </div>
  </>
);

export const PageViewerOrFallback: FC<{}> = () => {
  const { uri } = useParams<{ uri: string }>();
  const searchParams = new URLSearchParams(window.location.search);
  const navId = searchParams.get("navId");
  const navIndexParam = searchParams.get("navIndex");
  const navIndex = navIndexParam !== null ? parseInt(navIndexParam, 10) : null;
  const workspaceNav = useWorkspaceNavigation(
    uri,
    navId,
    Number.isFinite(navIndex) ? navIndex : null,
    history.push,
  );
  const highlightStepper = useSearchHighlightStepper();
  const pageFind = usePageFind(uri);

  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);

  const rotateClockwise = useCallback(
    () => setRotation((r) => (r + 90) % 360),
    [],
  );
  const rotateAnticlockwise = useCallback(
    () => setRotation((r) => (r - 90 + 360) % 360),
    [],
  );
  const zoomIn = useCallback(() => setScale((s) => s + 0.25), []);
  const zoomOut = useCallback(
    () => setScale((s) => Math.max(0.25, s - 0.25)),
    [],
  );

  const pageViewControls = {
    rotateClockwise,
    rotateAnticlockwise,
    zoomIn,
    zoomOut,
  };

  // Scroll to the focused search highlight in text views of paged documents
  useEffect(() => {
    if (
      highlightStepper.totalHighlights > 0 &&
      highlightStepper.currentHighlight !== undefined
    ) {
      const highlights = document.querySelectorAll("result-highlight");
      const prev = document.querySelector(".result-highlight--focused");
      if (prev) {
        prev.classList.remove("result-highlight--focused");
      }
      const el = highlights[highlightStepper.currentHighlight];
      if (el) {
        el.classList.add("result-highlight--focused");
        el.scrollIntoView({ inline: "center", block: "center" });
      }
    }
  }, [highlightStepper.currentHighlight, highlightStepper.totalHighlights]);

  const [response, setResponse] = useState<
    (PageCountResponse & { uri: string }) | null
  >(null);
  const view = useSelector<GiantState, string | undefined>(
    (state) => state.urlParams.view,
  );
  const resource = useSelector<GiantState, Resource | null>(
    (state) => state.resource,
  );
  const dispatch = useDispatch();

  const searchQuery = searchParams.get("q") ?? undefined;

  useEffect(() => {
    let cancelled = false;

    // Sending the search query along with the pageCount request lets the
    // backend also tell us whether the query matches in the page index — i.e.
    // whether the Combined view could show it. Elasticsearch can't answer that
    // during search itself because it has no notion of the Combined view
    // (issues #733 / #760).
    const params = new URLSearchParams();
    if (searchQuery) {
      // The backend will respect quotes and do an exact search, but if quotes
      // are unbalanced elasticsearch will error
      params.set("q", removeLastUnmatchedQuote(searchQuery));
    }
    const queryString = params.toString();
    const suffix = queryString ? `?${queryString}` : "";

    authFetch(`/api/pages2/${uri}/pageCount${suffix}`)
      .then((res) => res.json())
      .then((obj: PageCountResponse) => {
        if (cancelled) {
          return;
        }

        // Decide the initial view once per document load, right as its data
        // arrives, so a user manually switching tabs afterwards is never
        // overridden (see resolveInitialPagedView). The current view is read
        // from the URL, which the middleware keeps in sync with the store.
        const currentView =
          new URLSearchParams(window.location.search).get("view") ?? undefined;
        const target = resolveInitialPagedView({
          pageCount: obj.pageCount,
          currentView,
          hasSearchQuery: Boolean(searchQuery),
          searchMatchesInPages: obj.searchMatchesInPages,
        });

        // Dispatch before setResponse so the viewer never renders a frame in
        // the view we are about to leave.
        if (target && target !== currentView) {
          dispatch(setResourceView(target));
        }
        setResponse({ ...obj, uri });
      })
      .catch(() => {
        if (!cancelled) {
          setResponse({ pageCount: 0, dimensions: null, uri });
        }
      });

    // Discard responses from a superseded request so an out-of-order arrival
    // (e.g. when stepping quickly between results) can't replace the current
    // document's data — or dispatch a view change after this document has been
    // left.
    return () => {
      cancelled = true;
    };
  }, [uri, searchQuery, dispatch]);

  // This component is not remounted when the :uri route param changes, so until
  // the new document's count arrives `response` still holds the previous one's.
  // Tagging it with its uri lets us treat a stale count as "not yet known"
  // rather than wrongly imposing the Combined view on the next document.
  const pageData = response && response.uri === uri ? response : null;
  const totalPages = pageData ? pageData.pageCount : null;

  if (totalPages === null) {
    return null;
  } else if (totalPages === 0) {
    return (
      <div className="document__viewer-fallback">
        <SearchStepperOverlay highlightStepper={highlightStepper} />
        <Viewer
          key={uri}
          match={{ params: { uri } }}
          workspaceNav={workspaceNav}
        />
      </div>
    );
  } else {
    const showTextContent = !isCombinedOrUnset(view);
    const pageViewerContent = (
      <PageViewerContent
        key={uri}
        uri={uri}
        totalPages={totalPages}
        firstPageDimensions={pageData?.dimensions ?? undefined}
        view={view}
        findQuery={pageFind.findQuery}
        findHighlightsState={pageFind.highlightsState}
        focusedFindHighlight={pageFind.focusedHighlight}
        rotation={rotation}
        scale={scale}
      />
    );
    return (
      <div className="document__page-viewer-wrapper">
        {showTextContent && (
          <SearchStepperOverlay highlightStepper={highlightStepper} />
        )}
        <div className="document__page-viewer-content">
          {showTextContent ? (
            <div className="document document--text-content">
              {pageViewerContent}
            </div>
          ) : (
            pageViewerContent
          )}
        </div>
        {resource && (
          <DocumentFooter
            uri={uri}
            workspaceNav={workspaceNav}
            totalPages={totalPages}
            pageFind={isCombinedOrUnset(view) ? pageFind : undefined}
            pageViewControls={
              isCombinedOrUnset(view) ? pageViewControls : undefined
            }
          />
        )}
      </div>
    );
  }
};
