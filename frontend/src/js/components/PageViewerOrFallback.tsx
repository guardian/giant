import React, { FC, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import authFetch from "../util/auth/authFetch";
import { useParams } from "react-router-dom";
import _ from "lodash";
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

  if (!resource) {
    return null;
  }

  if (view === "table") {
    return <TablePreview text={resource.text.contents} />;
  } else if (view === "preview") {
    return <Preview resource={resource} />;
  } else if (
    view!.startsWith("ocr") ||
    view!.startsWith("transcript") ||
    view!.startsWith("vttTranscript")
  ) {
    const highlightableText = _.get(resource, view!);
    if (!highlightableText) {
      return renderNoPreview();
    }
    return (
      <TextPreview
        uri={resource.uri}
        currentUser={auth.token!.user}
        text={highlightableText.contents}
        searchHighlights={highlightableText.highlights}
        view={view!}
        comments={resource.comments}
        selection={resource.selection}
        preferences={preferences}
        getComments={(u: string) => dispatch(getComments(u))}
        setSelection={(s?: Selection) => dispatch(setSelection(s))}
      />
    );
  } else if (view === "text") {
    if (!resource.text) {
      return renderNoPreview();
    }
    return (
      <TextPreview
        uri={resource.uri}
        currentUser={auth.token!.user}
        text={resource.text.contents}
        searchHighlights={resource.text.highlights}
        view="text"
        comments={resource.comments}
        selection={resource.selection}
        preferences={preferences}
        getComments={(u: string) => dispatch(getComments(u))}
        setSelection={(s?: Selection) => dispatch(setSelection(s))}
      />
    );
  }

  return renderNoPreview();
};

export const PageViewerOrFallback: FC<{}> = () => {
  const { uri } = useParams<{ uri: string }>();
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
      .then((obj) => setTotalPages(obj.pageCount));
  }, [uri]);

  // Default to "combined" when we have pages.
  // Search URLs may set view=ocr.english etc., but for paged documents
  // the combined view should always be the landing view.
  useEffect(() => {
    if (totalPages && totalPages > 0 && view !== COMBINED_VIEW) {
      dispatch(setResourceView(COMBINED_VIEW));
    }
  }, [totalPages, dispatch]);

  if (totalPages === null) {
    return null;
  } else if (totalPages === 0) {
    return <Viewer match={{ params: { uri } }} />;
  } else {
    const showTextContent = !isCombinedOrUnset(view);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          height: "calc(100vh - 50px)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flexGrow: 1,
            overflow: "auto",
            display: "flex",
            minHeight: 0,
          }}
        >
          {showTextContent ? (
            <div className="document" style={{ flexGrow: 1 }}>
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
          <div className="document__status" style={{ flexShrink: 0 }}>
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
