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
import { setResourceView } from "../actions/urlParams/setViews";
import { getComments } from "../actions/resources/getComments";
import { setSelection } from "../actions/resources/setSelection";
import history from "../util/history";
import { useWorkspaceNavigation } from "../util/workspaceNavigation";

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
  view: string | undefined;
}> = ({ uri, totalPages, view }) => {
  const dispatch = useDispatch();
  const resource = useSelector<GiantState, Resource | null>(
    (state) => state.resource,
  );
  const auth = useSelector((state: GiantState) => state.auth);
  const preferences = useSelector((state: GiantState) => state.app.preferences);

  if (isCombinedOrUnset(view)) {
    return <PageViewer uri={uri} totalPages={totalPages} />;
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

export const PageViewerOrFallback: FC<{}> = () => {
  const { uri } = useParams<{ uri: string }>();

  const workspaceNav = useWorkspaceNavigation(uri, history.push);
  const [totalPages, setTotalPages] = useState<number | null>(null);
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
      .then((obj) => setTotalPages(obj.pageCount))
      .catch(() => setTotalPages(0));
  }, [uri]);

  // Default to "combined" when we have pages and no view is set.
  useEffect(() => {
    if (totalPages && totalPages > 0 && !view) {
      dispatch(setResourceView(COMBINED_VIEW));
    }
  }, [totalPages, view, dispatch]);

  if (totalPages === null) {
    return null;
  } else if (totalPages === 0) {
    return <Viewer match={{ params: { uri } }} workspaceNav={workspaceNav} />;
  } else {
    const showTextContent = !isCombinedOrUnset(view);
    return (
      <div className="document__page-viewer-wrapper">
        <div className="document__page-viewer-content">
          {showTextContent ? (
            <div className="document">
              <PageViewerContent
                uri={uri}
                totalPages={totalPages}
                view={view}
              />
            </div>
          ) : (
            <PageViewerContent uri={uri} totalPages={totalPages} view={view} />
          )}
        </div>
        {resource && (
          <div className="document__status">
            {/* Left spacer: document__status uses space-between to match the legacy StatusBar two-span layout */}
            <span />
            <span>
              <PreviewSwitcher
                view={view}
                resource={resource}
                totalPages={totalPages}
              />
            </span>
          </div>
        )}
      </div>
    );
  }
};
