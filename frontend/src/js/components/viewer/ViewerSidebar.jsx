import React from "react";
import PropTypes from "prop-types";
import { resourcePropType } from "../../types/Resource";
import { match } from "../../types/Match";

import { DocumentMetadata } from "./DocumentMetadata";
import { EmailMetadata } from "./EmailMetadata";

import { connect } from "react-redux";
import { bindActionCreators } from "redux";

import NextIcon from "react-icons/lib/md/navigate-next";
import PreviousIcon from "react-icons/lib/md/navigate-before";

import { getResource } from "../../actions/resources/getResource";
import { permissionsPropType } from "../../types/User";
import { getMyPermissions } from "../../actions/users/getMyPermissions";
import { isResourceForUri } from "../../util/resourceUtils";

class ViewerSidebar extends React.Component {
  static propTypes = {
    resource: resourcePropType,
    match: match.isRequired,
    myPermissions: permissionsPropType,
    getResource: PropTypes.func.isRequired,
    preferences: PropTypes.object,
    urlParams: PropTypes.shape({
      q: PropTypes.string,
      view: PropTypes.string,
      page: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    }),
  };

  state = {
    collapsed: false,
  };

  UNSAFE_componentWillReceiveProps(props) {
    // Not guarded by isLoadingResource: if the user moves on while a fetch is
    // still in flight we must fetch the new document regardless, else the
    // in-flight response would be displayed for the wrong route.
    if (props.match.params.uri !== this.props.match.params.uri) {
      this.props.getResource(props.match.params.uri, props.urlParams.q);
    }
  }

  UNSAFE_componentWillMount() {
    // <Viewer> may have fetched the resource first, so avoid duplicate requests which race each other.
    // Ultimately we'd like the resource fetch to be triggered from a common parent of this and <Viewer>
    // The store can also hold a resource left over from a previously viewed
    // document (#799), which must not suppress the fetch — so check the
    // resource is actually the one for this route, not merely present.
    if (
      !this.props.isLoadingResource &&
      !isResourceForUri(this.props.resource, this.props.match.params.uri)
    ) {
      this.props.getResource(
        this.props.match.params.uri,
        this.props.urlParams.q,
      );
    }
    this.props.getMyPermissions();
  }

  render() {
    // Render nothing rather than a leftover resource from a previously
    // viewed document while the right one is being fetched (#799)
    const resource = isResourceForUri(
      this.props.resource,
      this.props.match.params.uri,
    )
      ? this.props.resource
      : null;

    if (resource) {
      return (
        <div
          className={`sidebar ${this.state.collapsed ? "sidebar--collapsed" : ""} viewer__sidebar`}
        >
          <div className="sidebar__actions">
            <button
              className="btn"
              onClick={() =>
                this.setState({ collapsed: !this.state.collapsed })
              }
            >
              {this.state.collapsed ? <NextIcon /> : <PreviousIcon />}
            </button>
          </div>
          {resource.type === "blob" ? (
            <DocumentMetadata
              resource={resource}
              config={this.props.config}
              myPermissions={this.props.myPermissions}
              currentView={this.props.urlParams && this.props.urlParams.view}
              currentUser={this.props.currentUser}
            />
          ) : (
            <EmailMetadata
              resource={resource}
              config={this.props.config}
              isAdmin={this.props.myPermissions.includes(
                "CanPerformAdminOperations",
              )}
              currentView={this.props.urlParams && this.props.urlParams.view}
              currentUser={this.props.currentUser}
            />
          )}
        </div>
      );
    } else {
      return <div className="sidebar" />;
    }
  }
}

function mapStateToProps(state) {
  return {
    urlParams: state.urlParams,
    isLoadingResource: state.isLoadingResource,
    resource: state.resource,
    config: state.app.config,
    myPermissions: state.users.myPermissions,
    currentUser: state.auth.token ? state.auth.token.user : undefined,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    getResource: bindActionCreators(getResource, dispatch),
    getMyPermissions: bindActionCreators(getMyPermissions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(ViewerSidebar);
