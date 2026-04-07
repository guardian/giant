import React, { FC, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import authFetch from "../util/auth/authFetch";
import { useParams } from "react-router-dom";
import get from "lodash/get";
import Viewer from "./viewer/Viewer";
import { PageViewer } from "./PageViewer/PageViewer";
import { TextPreview } from "./viewer/TextPreview";
import { Preview } from "./viewer/Preview";
import { TablePreview } from "./viewer/TablePreview";
import PreviewSwitcher from "./viewer/PreviewSwitcher";
import DownloadButton from "./viewer/DownloadButton";
import { GiantState } from "../types/redux/GiantState";
import { Resource } from "../types/Resource";
import { PageDimensions } from "./PageViewer/model";
import { setResourceView } from "../actions/urlParams/setViews";
import { getComments } from "../actions/resources/getComments";
import { setSelection } from "../actions/resources/setSelection";
import history from "../util/history";
import { useWorkspaceNavigation } from "../util/workspaceNavigation";
import { DocNavButton } from "./viewer/DocNavButton";
import { keyboardShortcuts } from "../util/keyboardShortcuts";
import { KeyboardShortcut } from "./UtilComponents/KeyboardShortcut";

const COMBINED_VIEW = "combined";

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
}> = ({ uri, totalPages, firstPageDimensions, view }) => {
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
      />
    );
  }

  if (!resource || !auth.token || !view) {
    return null;
  }

  if (view === "table") {
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
};

export const PageViewerOrFallback: FC<{}> = () => {
  const { uri } = useParams<{ uri: string }>();
  const searchParams = new URLSearchParams(window.location.search);
  const navId = searchParams.get("navId");
  const navIndexParam = searchParams.get("navIndex");
  const navIndex = navIndexParam !== null ? parseInt(navIndexParam, 10) : null;
  const workspaceNav = navId
    ? useWorkspaceNavigation(
        uri,
        navId,
        Number.isFinite(navIndex) ? navIndex : null,
        history.push,
      )
    : undefined;

  const [response, setResponse] = useState<PageCountResponse | null>(null);
  const view = useSelector<GiantState, string | undefined>(
    (state) => state.urlParams.view,
  );
  const resource = useSelector<GiantState, Resource | null>(
    (state) => state.resource,
  );
  const dispatch = useDispatch();

  useEffect(() => {
    authFetch(`/api/pages2/${uri}/pageCount`)
      .then((res) => res.json())
      .then((obj: PageCountResponse) => setResponse(obj))
      .catch(() => setResponse({ pageCount: 0, dimensions: null }));
  }, [uri]);

  const totalPages = response?.pageCount ?? null;

  // Default to "combined" when we have pages and no view is set.
  useEffect(() => {
    if (totalPages && totalPages > 0 && !view) {
      dispatch(setResourceView(COMBINED_VIEW));
    }
  }, [totalPages, view, dispatch]);

  if (response === null) {
    return null;
  } else if (response.pageCount === 0) {
    return (
      <Viewer
        key={uri}
        match={{ params: { uri } }}
        workspaceNav={workspaceNav}
      />
    );
  } else {
    const showTextContent = !isCombinedOrUnset(view);
    return (
      <div className="document__page-viewer-wrapper">
        <div className="document__page-viewer-content">
          {showTextContent ? (
            <div className="document">
              <PageViewerContent
                key={uri}
                uri={uri}
                totalPages={response.pageCount}
                firstPageDimensions={response.dimensions ?? undefined}
                view={view}
              />
            </div>
          ) : (
            <PageViewerContent
              key={uri}
              uri={uri}
              totalPages={response.pageCount}
              firstPageDimensions={response.dimensions ?? undefined}
              view={view}
            />
          )}
        </div>
        {resource && (
          <div className="document__status">
            {/* Left spacer: document__status uses space-between to match the legacy StatusBar two-span layout */}
            <span />
            <span className="doc-nav-buttons">
              <PreviewSwitcher
                view={view}
                resource={resource}
                totalPages={response.pageCount}
              />
              {workspaceNav &&
                (workspaceNav.goToPrevious || workspaceNav.goToNext) && (
                  <>
                    {workspaceNav.goToNext && (
                      <KeyboardShortcut
                        shortcut={keyboardShortcuts.nextResult}
                        func={workspaceNav.goToNext}
                      />
                    )}
                    {workspaceNav.goToPrevious && (
                      <KeyboardShortcut
                        shortcut={keyboardShortcuts.previousResult}
                        func={workspaceNav.goToPrevious}
                      />
                    )}
                    <DocNavButton
                      direction="previous"
                      title="Previous in folder"
                      onClick={workspaceNav.goToPrevious}
                    />
                    <DocNavButton
                      direction="next"
                      title="Next in folder"
                      onClick={workspaceNav.goToNext}
                    />
                  </>
                )}
            </span>
          </div>
        )}
      </div>
    );
  }
};
