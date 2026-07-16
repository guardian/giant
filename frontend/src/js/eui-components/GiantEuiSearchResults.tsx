import React, { CSSProperties, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { SearchResultDetails } from "../types/SearchResults";
import { getLastPart } from "../util/stringUtils";
import { TextPreview } from "../components/viewer/TextPreview";
import { GiantState } from "../types/redux/GiantState";
import { getResource, resetResource } from "../actions/resources/getResource";
import { connect } from "react-redux";
import { definitelyNotAUnifiedViewer } from "../util/resourceUtils";
import {
  EuiEmptyPrompt,
  EuiListGroup,
  EuiListGroupItem,
  EuiLoadingContent,
} from "@elastic/eui";
import { Workspace } from "../types/Workspaces";
import { headerHeight } from "./displayConstants";

function getDisplayName(details: SearchResultDetails): string {
  if ("from" in details) {
    return details.subject;
  }

  if (details.fileUris.length === 0) {
    return "Unknown";
  }

  return getLastPart(details.fileUris[0], "/");
}

interface PropsFromParent {
  currentWorkspace: Workspace;
}

type Props = ReturnType<typeof mapStateToProps> & PropsFromParent;

function GiantEuiSearchResults({
  currentWorkspace,
  currentResults,
  currentQuery,
  resource,
  user,
  isLoadingResource,
}: Props) {
  const dispatch = useDispatch();
  const [resourceQuery, setResourceQuery] = useState<
    { uri: string; q?: string } | undefined
  >(
    currentResults?.results.length
      ? { uri: currentResults.results[0].uri, q: currentQuery?.q }
      : undefined,
  );

  useEffect(() => {
    if (resourceQuery) {
      console.log("getting resource");
      dispatch(getResource(resourceQuery.uri, resourceQuery.q));
    }
  }, [resourceQuery, dispatch]);

  useEffect(() => {
    if (currentResults?.results.length) {
      setResourceQuery({
        uri: currentResults.results[0].uri,
        q: currentQuery?.q,
      });
    } else {
      dispatch(resetResource());
      setResourceQuery(undefined);
    }
  }, [currentResults, currentQuery, dispatch]);

  const toDisplay = definitelyNotAUnifiedViewer(resource);

  const documentListWidth = "400px";
  const documentListStyles: CSSProperties = {
    position: "fixed",
    width: documentListWidth,
    overflowX: "hidden",
    overflowY: "auto",
    height: `calc(100vh - ${headerHeight})`,
  };
  const viewerStyles: CSSProperties = {
    marginLeft: documentListWidth,
  };

  const loadingStyles: CSSProperties = {
    marginLeft: "10%",
    marginRight: "5%",
    paddingTop: "1%",
  };

  function renderSearchResults() {
    if (isLoadingResource) {
      return (
        <div style={loadingStyles}>
          {" "}
          <EuiLoadingContent lines={10} />
        </div>
      );
    }
    if (resourceQuery && toDisplay && user) {
      return (
        <TextPreview
          uri={resourceQuery.uri}
          currentUser={user}
          view="text"
          comments={[]}
          text={toDisplay.highlightableText.contents}
          searchHighlights={toDisplay.highlightableText.highlights}
          selection={undefined}
          preferences={{
            showSearchHighlights: true,
            showCommentHighlights: false,
          }}
          getComments={() => false}
          setSelection={() => false}
        />
      );
    }
    return (
      <EuiEmptyPrompt
        iconType="empty"
        title={<h2>No results</h2>}
        body={
          currentQuery ? (
            <p>
              Nothing in workspace <strong>{currentWorkspace.name}</strong>{" "}
              matched search query <strong>{currentQuery.q}</strong>
            </p>
          ) : (
            <p>Type in search box and press enter to search</p>
          )
        }
      />
    );
  }

  return (
    <React.Fragment>
      <div style={documentListStyles}>
        <EuiListGroup>
          {currentResults?.hits ? (
            currentResults.results.map(({ uri, details }) => (
              <EuiListGroupItem
                key={uri}
                wrapText
                isActive={uri === resourceQuery?.uri}
                onClick={() => setResourceQuery({ uri, q: currentQuery?.q })}
                label={getDisplayName(details)}
              />
            ))
          ) : (
            <EuiEmptyPrompt iconType="faceSad" body={<h1>No documents</h1>} />
          )}
        </EuiListGroup>
      </div>
      <div style={viewerStyles}>{renderSearchResults()}</div>
    </React.Fragment>
  );
}

function mapStateToProps(state: GiantState) {
  return {
    currentQuery: state.search.currentQuery,
    currentResults: state.search.currentResults,
    resource: state.resource,
    user: state.auth.token?.user,
    isLoadingResource: state.isLoadingResource,
  };
}

export default connect(mapStateToProps, {})(GiantEuiSearchResults);
