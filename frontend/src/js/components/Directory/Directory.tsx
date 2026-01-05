import React, { Component } from "react";
import { Resource } from "../../types/Resource";

import { calculateResourceTitle } from "../UtilComponents/documentTitle";

import { connect } from "react-redux";
import { bindActionCreators } from "redux";

import {
  getBasicResource,
  getChildResource,
} from "../../actions/resources/getResource";
import LazyTreeBrowser from "../viewer/LazyTreeBrowser";
import PagedBrowser from "../viewer/PagedBrowser";
import { MAX_NUMBER_OF_CHILDREN } from "../../util/resourceUtils";
import { GiantState, DescendantResources } from "../../types/redux/GiantState";
import { GiantDispatch } from "../../types/redux/GiantDispatch";

type Props = {
  resource: Resource | null;
  descendantResources: DescendantResources;
  currentResource: string;
  getBasicResource: typeof getBasicResource;
  getChildResource: typeof getChildResource;
};

export class Directory extends Component<Props> {
  componentDidMount() {
    this.fetchResourceIfRequired();
    document.title = calculateResourceTitle(this.props.resource);
  }

  componentDidUpdate() {
    this.fetchResourceIfRequired();
    document.title = calculateResourceTitle(this.props.resource);
  }

  componentWillUnmount() {
    document.title = "Giant";
  }

  fetchResourceIfRequired() {
    if (
      !this.props.resource ||
      this.props.resource.uri !== this.props.currentResource
    ) {
      this.props.getBasicResource(this.props.currentResource);
    }
  }

  render() {
    if (
      !this.props.resource ||
      this.props.resource.uri !== this.props.currentResource
    ) {
      return false;
    }

    if (this.props.resource.children.length > MAX_NUMBER_OF_CHILDREN) {
      return <PagedBrowser resource={this.props.resource} />;
    }

    return (
      <div className="directory">
        <div className="directory__list">
          <LazyTreeBrowser
            rootResource={this.props.resource}
            descendantResources={this.props.descendantResources}
            getChildResource={this.props.getChildResource}
          />
        </div>
      </div>
    );
  }
}

function mapStateToProps(state: GiantState) {
  return {
    resource: state.resource,
    descendantResources: state.descendantResources,
  };
}

function mapDispatchToProps(dispatch: GiantDispatch) {
  return {
    getBasicResource: bindActionCreators(getBasicResource, dispatch),
    getChildResource: bindActionCreators(getChildResource, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(Directory);
