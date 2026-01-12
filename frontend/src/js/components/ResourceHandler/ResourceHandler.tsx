import React, { Component } from "react";
import { Resource } from "../../types/Resource";

import { Redirect } from "react-router-dom";

import { connect } from "react-redux";
import { bindActionCreators } from "redux";

import {
  getBasicResource,
  resetResource,
} from "../../actions/resources/getResource";
import { hasSingleBlobChild } from "../../util/resourceUtils";
import { GiantState } from "../../types/redux/GiantState";
import { GiantDispatch } from "../../types/redux/GiantDispatch";

type Props = {
  resource: Resource | null;
  currentResource: string;
  getBasicResource: typeof getBasicResource;
  resetResource: typeof resetResource;
};

export class ResourceHandlerUnconnected extends Component<Props> {
  componentDidMount() {
    if (
      !this.props.resource ||
      this.props.currentResource !== this.props.resource.uri
    ) {
      this.props.getBasicResource(this.props.currentResource);
    }
  }

  render() {
    if (
      !this.props.resource ||
      this.props.currentResource !== this.props.resource.uri
    ) {
      return false;
    }

    const resource = this.props.resource;

    // This unmounts the basic resource loaded here before the redirect so that Viewer only ever sees the full resource.
    // We removed the isBasic check in Viewer during conversion to Typescript because it meant changing the definitions
    // of Resource and BasicResource in ways that would ripple across the codebase.
    //
    // Once we update the definitions to derive from a single interface we can check isBasic again but I think it's worth
    // keeping this for consistency as Viewer also clears the resource on unmount.
    this.props.resetResource();

    if (resource.type === "blob" || resource.type === "email") {
      return <Redirect to={`/viewer/${resource.uri}`} />;
    }

    if (hasSingleBlobChild(resource)) {
      return <Redirect to={`/viewer/${encodeURI(resource.children[0].uri)}`} />;
    }

    if (resource.type === "directory") {
      // We now have a resource type 'directory', distinct from 'file', but we want to keep URIs stable.
      // So we still route to the /files/ route.
      return <Redirect to={`/files/${encodeURI(resource.uri)}`} />;
    }

    return <Redirect to={`/${resource.type}s/${encodeURI(resource.uri)}`} />;
  }
}

function mapStateToProps(state: GiantState) {
  return {
    resource: state.resource,
  };
}

function mapDispatchToProps(dispatch: GiantDispatch) {
  return {
    getBasicResource: bindActionCreators(getBasicResource, dispatch),
    resetResource: bindActionCreators(resetResource, dispatch),
  };
}

export const ResourceHandler = connect(
  mapStateToProps,
  mapDispatchToProps,
)(ResourceHandlerUnconnected);
