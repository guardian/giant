import React from "react";

import { connect } from "react-redux";
import { bindActionCreators } from "redux";

import { getCollection } from "../../../actions/collections/getCollection";
import {
  getChildResource,
  getBasicResource,
} from "../../../actions/resources/getResource";
import LazyTreeBrowser from "../../viewer/LazyTreeBrowser";
import { Resource } from "../../../types/Resource";
import { Match } from "../../../types/Match";
import { PartialUser } from "../../../types/User";
import { Collection } from "../../../types/Collection";
import {
  DescendantResources,
  GiantState,
} from "../../../types/redux/GiantState";
import { GiantDispatch } from "../../../types/redux/GiantDispatch";

type Props = {
  match: Match;
  currentUser?: PartialUser;
  collections: Collection[];
  resource: Resource | null;
  descendantResources: DescendantResources;
  getCollection: typeof getCollection;
  getBasicResource: typeof getBasicResource;
  getChildResource: typeof getChildResource;
};

type State = {
  resourceLoading: String | null;
};

class CurrentCollection extends React.Component<Props, State> {
  state = {
    // Avoid trying to reload the collection again once we start to load it.
    //
    // This happens when you click Back from browsing a large ingestion that triggers
    // the page view and go back to the tree view again.
    resourceLoading: null,
  };

  resourceHasChanged() {
    const uriHasChanged =
      this.props.resource &&
      this.props.match.params.uri !== this.props.resource.uri;
    const resourceIsLoading = this.state.resourceLoading
      ? this.state.resourceLoading === this.props.match.params.uri
      : false;

    return uriHasChanged && !resourceIsLoading;
  }

  loadResource() {
    localStorage.setItem("selectedCollectionUri", this.props.match.params.uri);
    this.props.getBasicResource(this.props.match.params.uri);

    this.setState({ resourceLoading: this.props.match.params.uri });
  }

  componentDidMount() {
    if (!this.props.resource || this.resourceHasChanged()) {
      this.loadResource();
    }
    this.props.getCollection(this.props.match.params.uri);
  }

  componentDidUpdate() {
    if (this.resourceHasChanged()) {
      this.loadResource();
    }

    if (
      this.props.resource &&
      this.state.resourceLoading === this.props.resource.uri
    ) {
      this.setState({ resourceLoading: null });
    }
  }

  componentWillUnmount() {
    document.title = "Giant";
  }

  render() {
    if (this.props.resource && this.props.currentUser) {
      const display = this.props.resource.display || "Unknown Dataset Name";
      document.title = `${display} - Giant`;

      return (
        <div className="app__main-content">
          <div className="app__section">
            <LazyTreeBrowser
              rootResource={this.props.resource}
              descendantResources={this.props.descendantResources}
              getChildResource={this.props.getChildResource}
            />
          </div>
        </div>
      );
    }

    return null;
  }
}

function mapStateToProps(state: GiantState) {
  return {
    resource: state.resource,
    descendantResources: state.descendantResources,
    currentUser: state.auth.token?.user,
    collections: state.collections,
  };
}

function mapDispatchToProps(dispatch: GiantDispatch) {
  return {
    getCollection: bindActionCreators(getCollection, dispatch),
    getBasicResource: bindActionCreators(getBasicResource, dispatch),
    getChildResource: bindActionCreators(getChildResource, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(CurrentCollection);
