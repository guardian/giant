import React from "react";

import { HighlightableText, Resource } from "../../types/Resource";

import { TablePreview } from "./TablePreview";
import { DocumentFooter } from "./DocumentFooter";
import { Preview } from "./Preview";
import { EmailDetails } from "./EmailDetails";
import { TextPreview } from "./TextPreview";
import { calculateResourceTitle } from "../UtilComponents/documentTitle";

import _ from "lodash";

import { connect } from "react-redux";
import { bindActionCreators } from "redux";

import {
  getChildResource,
  getResource,
  resetResource,
} from "../../actions/resources/getResource";
import {
  setDetailsView,
  setResourceView,
} from "../../actions/urlParams/setViews";
import { setCurrentHighlight } from "../../actions/highlights";
import { setCurrentHighlightInUrl } from "../../actions/urlParams/setCurrentHighlight";
import { getComments } from "../../actions/resources/getComments";
import { setSelection } from "../../actions/resources/setSelection";
import {
  DescendantResources,
  GiantState,
  UrlParamsState,
} from "../../types/redux/GiantState";
import { Auth } from "../../types/Auth";
import { GiantDispatch } from "../../types/redux/GiantDispatch";
import LazyTreeBrowser from "./LazyTreeBrowser";
import { getDefaultView } from "../../util/resourceUtils";
import DownloadButton from "./DownloadButton";
import { WorkspaceNavigation } from "../../util/workspaceNavigation";

type Props = {
  match: { params: { uri: string } };
  workspaceNav?: WorkspaceNavigation;
  auth: Auth;
  preferences: any;
  urlParams: UrlParamsState;
  resource: Resource | null;
  isLoadingResource: boolean;
  descendantResources: DescendantResources;
  currentHighlight?: number;
  totalHighlights?: number;
  getResource: typeof getResource;
  getChildResource: typeof getChildResource;
  resetResource: typeof resetResource;
  getComments: typeof getComments;
  setResourceView: typeof setResourceView;
  setDetailsView: typeof setDetailsView;
  setCurrentHighlight: typeof setCurrentHighlight;
  setCurrentHighlightInUrl: typeof setCurrentHighlightInUrl;
  setSelection: typeof setSelection;
};

type State = {};

// A viewport for the current search result
class Viewer extends React.Component<Props, State> {
  state = {};

  UNSAFE_componentWillReceiveProps(props: Props) {
    if (
      !this.props.isLoadingResource &&
      props.match.params.uri !== this.props.match.params.uri
    ) {
      // See comment below in componentDidMount about not racing these two requests
      this.props.getResource(props.match.params.uri, props.urlParams.q);
    }
  }

  componentDidMount() {
    // This has to happen early, because otherwise state changes will get synced to the URL
    // (and the URL state thus lost) before we have a chance to do it the other way round

    if (this.props.urlParams.highlight && this.props.urlParams.view) {
      const highlightFromUrl = parseInt(this.props.urlParams.highlight);

      if (!isNaN(highlightFromUrl)) {
        // If there's something in the URL, it should override the state.
        this.props.setCurrentHighlight(
          this.props.match.params.uri,
          this.props.urlParams.q,
          this.props.urlParams.view,
          highlightFromUrl,
        );
      }
    } else if (this.props.currentHighlight !== undefined) {
      // Otherwise, add the state to the URL.
      this.props.setCurrentHighlightInUrl(
        this.props.currentHighlight.toString(10),
      );
    }

    // <ViewerSidebar> may have fetched the resource first, so avoid duplicate requests which race each other.
    // Ultimately we'd like the resource fetch to be triggered from a common parent of this and <ViewerSidebar>
    if (!this.props.isLoadingResource && !this.props.resource) {
      this.props.getResource(
        this.props.match.params.uri,
        this.props.urlParams.q,
      );
    }

    document.title = calculateResourceTitle(this.props.resource);
  }

  componentDidUpdate(prevProps: Props) {
    if (
      this.props.currentHighlight !== prevProps.currentHighlight ||
      this.props.totalHighlights !== prevProps.totalHighlights
    ) {
      if (this.props.currentHighlight === undefined) {
        // We must have just changed view to a view with no highlight in the state yet.
        // So start at first search result.
        if (
          this.props.match.params.uri &&
          this.props.urlParams.q &&
          this.props.urlParams.view
        ) {
          this.props.setCurrentHighlight(
            this.props.match.params.uri,
            this.props.urlParams.q,
            this.props.urlParams.view,
            0,
          );
        }
      } else {
        // The highlights might have changed because the user has clicked next/previous,
        // or because they've changed view between text & ocr. Either way, we need
        // to get the scroll position and the URL in sync with the highlights.
        this.scrollToCurrentHighlight();
        this.props.setCurrentHighlightInUrl(
          this.props.currentHighlight.toString(10),
        );
      }
    }

    if (!this.props.urlParams.view && this.props.resource) {
      const maybeDefaultView = getDefaultView(this.props.resource);

      if (maybeDefaultView) {
        this.props.setResourceView(maybeDefaultView);
      }
    }

    document.title = calculateResourceTitle(this.props.resource);
  }

  scrollToCurrentHighlight() {
    if (
      this.props.totalHighlights !== undefined &&
      this.props.totalHighlights > 0 &&
      this.props.currentHighlight !== undefined
    ) {
      const highlights = document.querySelectorAll("result-highlight");

      if (highlights.length > 0) {
        const currentHighlightElement = document.querySelector(
          ".result-highlight--focused",
        );
        if (currentHighlightElement) {
          currentHighlightElement.classList.remove("result-highlight--focused");
        }

        if (highlights[this.props.currentHighlight]) {
          highlights[this.props.currentHighlight].classList.add(
            "result-highlight--focused",
          );
          highlights[this.props.currentHighlight].scrollIntoView({
            inline: "center",
            block: "center",
          });
        } else {
          console.error(
            `Could not find element number ${this.props.currentHighlight} in highlights of length ${highlights.length}`,
          );
        }
      } else {
        console.error(
          "Actual count of highlights does not match expected number of highlights",
        );
      }
    }

    return null;
  }

  componentWillUnmount() {
    document.title = "Giant";
    this.props.resetResource();
  }

  renderTextPreview(
    resource: Resource,
    highlightableText: HighlightableText,
    view: string,
  ) {
    return (
      <TextPreview
        uri={resource.uri}
        currentUser={this.props.auth.token!.user}
        text={highlightableText.contents}
        searchHighlights={highlightableText.highlights}
        view={view}
        comments={resource.comments}
        selection={resource.selection}
        preferences={this.props.preferences}
        getComments={this.props.getComments}
        setSelection={this.props.setSelection}
      />
    );
  }

  renderNoPreview() {
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

  renderFullContents(resource: Resource, view: string) {
    if (view === "table") {
      return <TablePreview text={resource.text.contents} />;
    } else if (view === "preview") {
      return <Preview resource={resource} />;
    } else if (view.startsWith("ocr")) {
      if (resource.ocr) {
        return this.renderTextPreview(
          resource,
          _.get(this.props.resource, view),
          view,
        );
      } else {
        // Only matters if a user has manually changed the view in the URL params or is visiting a link with them in
        return this.renderNoPreview();
      }
    } else if (view.startsWith("vttTranscript")) {
      if (resource.vttTranscript) {
        return this.renderTextPreview(
          resource,
          _.get(this.props.resource, view),
          view,
        );
      } else {
        // Only matters if a user has manually changed the view in the URL params or is visiting a link with them in
        return this.renderNoPreview();
      }
    } else if (view.startsWith("transcript")) {
      if (resource.transcript) {
        return this.renderTextPreview(
          resource,
          _.get(this.props.resource, view),
          view,
        );
      } else {
        // Only matters if a user has manually changed the view in the URL params or is visiting a link with them in
        return this.renderNoPreview();
      }
    } else if (resource.extracted) {
      return this.renderTextPreview(resource, resource.text, "text");
    } else if (resource.children.length) {
      return (
        <LazyTreeBrowser
          rootResource={resource}
          descendantResources={this.props.descendantResources}
          getChildResource={this.props.getChildResource}
        />
      );
    } else {
      return this.renderNoPreview();
    }
  }

  renderFullResource(resource: Resource, view: string) {
    let docClass = "document";

    if (this.props.urlParams.view === "preview") {
      docClass += " document-fixed";
    }

    if (resource.type === "email") {
      docClass += " document--browser";
    }

    if (resource.children.length) {
      docClass += " document--browser document--full-height";
    }

    if (resource.type === "blob") {
      return (
        <div className={docClass}>
          {this.renderFullContents(resource, view)}
        </div>
      );
    } else if (resource.type === "email") {
      return (
        <div className={docClass}>
          <EmailDetails
            email={this.props.resource}
            detailsType={this.props.urlParams.details}
            setDetailsView={this.props.setDetailsView}
            match={this.props.match}
          />
          {this.renderFullContents(resource, view)}
        </div>
      );
    } else {
      return <div>Unknown resource type {resource.uri}</div>;
    }
  }

  renderResource(resource: Resource) {
    const { view } = this.props.urlParams;

    return (
      <div className="viewer__main">
        {this.renderFullResource(resource, view || "text")}
      </div>
    );
  }

  render() {
    if (!this.props.resource) {
      return false;
    }

    return (
      <div className="viewer">
        {this.renderResource(this.props.resource)}
        <div className="viewer__footer">
          <DocumentFooter
            uri={this.props.match.params.uri}
            workspaceNav={
              this.props.workspaceNav ?? {
                hasPrevious: false,
                hasNext: false,
                goToPrevious: undefined,
                goToNext: undefined,
              }
            }
          />
        </div>
      </div>
    );
  }
}

function mapStateToProps(state: GiantState) {
  const view = state.urlParams.view;
  let currentHighlight, totalHighlights;

  if (state.resource && state.urlParams && view) {
    // The current highlight is stored separately in redux so it can be preserved on navigation.
    const highlights =
      state.highlights[`${state.resource.uri}-${state.urlParams.q}`];
    if (highlights && _.get(highlights, view)) {
      currentHighlight = _.get(highlights, view).currentHighlight;
    }
    const viewItem = _.get(state.resource, view);
    if (viewItem) {
      // The total highlights comes from the server representation of a resource.
      totalHighlights = viewItem.highlights ? viewItem.highlights.length : 0;
    }
  }

  return {
    auth: state.auth,
    urlParams: state.urlParams,
    resource: state.resource,
    isLoadingResource: state.isLoadingResource,
    descendantResources: state.descendantResources,
    preferences: state.app.preferences,
    currentHighlight,
    totalHighlights,
  };
}

function mapDispatchToProps(dispatch: GiantDispatch) {
  return {
    setResourceView: bindActionCreators(setResourceView, dispatch),
    setDetailsView: bindActionCreators(setDetailsView, dispatch),
    getResource: bindActionCreators(getResource, dispatch),
    resetResource: bindActionCreators(resetResource, dispatch),
    getChildResource: bindActionCreators(getChildResource, dispatch),
    setCurrentHighlight: bindActionCreators(setCurrentHighlight, dispatch),
    setCurrentHighlightInUrl: bindActionCreators(
      setCurrentHighlightInUrl,
      dispatch,
    ),
    getComments: bindActionCreators(getComments, dispatch),
    setSelection: bindActionCreators(setSelection, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(Viewer);
