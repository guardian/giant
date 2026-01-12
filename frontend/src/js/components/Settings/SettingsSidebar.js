import React from "react";
import PropTypes from "prop-types";

import SidebarSearchLink from "../UtilComponents/SidebarSearchLink";

import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { invalidateAuthToken } from "../../actions/auth/invalidateAuthToken";
import { getMyPermissions } from "../../actions/users/getMyPermissions";

class SettingsSidebar extends React.Component {
  static propTypes = {
    invalidateAuthToken: PropTypes.func.isRequired,
    getMyPermissions: PropTypes.func.isRequired,
    myPermissions: PropTypes.arrayOf(PropTypes.string).isRequired,
  };

  componentDidMount() {
    this.props.getMyPermissions();
  }

  logout = () => {
    this.props.invalidateAuthToken();
  };

  renderAdminSettingsLinks = () => {
    return (
      <React.Fragment>
        <SidebarSearchLink className="sidebar__item" to="/settings/file-types">
          <div className="sidebar__item__text">File Types</div>
        </SidebarSearchLink>
        <SidebarSearchLink className="sidebar__item" to="/settings/users">
          <div className="sidebar__item__text">Users</div>
        </SidebarSearchLink>
      </React.Fragment>
    );
  };

  renderAdminLogsLinks = () => {
    return (
      <React.Fragment>
        <SidebarSearchLink
          className="sidebar__item"
          to="/settings/all-ingestion-events"
        >
          <div className="sidebar__item__text">All Ingestion Events</div>
        </SidebarSearchLink>
        <SidebarSearchLink className="sidebar__item" to="/settings/failures">
          <div className="sidebar__item__text">Extraction Failures</div>
        </SidebarSearchLink>
        <SidebarSearchLink className="sidebar__item" to="/settings/uploads">
          <div className="sidebar__item__text">Upload Calendar</div>
        </SidebarSearchLink>
      </React.Fragment>
    );
  };

  render() {
    const canManageUsers = this.props.myPermissions.includes(
      "CanPerformAdminOperations",
    );

    return (
      <div className="sidebar">
        <div className="sidebar__group">
          <div className="sidebar__title">About</div>
          <SidebarSearchLink className="sidebar__item" to="/settings/about">
            <div className="sidebar__item__text">About Giant</div>
          </SidebarSearchLink>
          <a
            className="sidebar__item"
            href="https://docs.google.com/document/d/1wBJtFOnQcNNfzF4nSvULUHoQTsKek-tIRO4oEG7UWC4"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="sidebar__item__text">Using Giant</div>
          </a>
          <div className="sidebar__item">
            <button
              className="sidebar__item__text btn-link"
              onClick={this.logout}
            >
              Log Out
            </button>
          </div>
        </div>
        <div className="sidebar__group">
          <div className="sidebar__title">Settings</div>
          <SidebarSearchLink
            className="sidebar__item"
            to="/settings/dataset-permissions"
          >
            <div className="sidebar__item__text">Dataset Permissions</div>
          </SidebarSearchLink>
          <SidebarSearchLink className="sidebar__item" to="/settings/features">
            <div className="sidebar__item__text">Feature Switches</div>
          </SidebarSearchLink>
          {canManageUsers ? this.renderAdminSettingsLinks() : false}
        </div>
        <div className="sidebar__group">
          <div className="sidebar__title">Logs</div>
          <SidebarSearchLink
            className="sidebar__item"
            to="/settings/my-uploads"
          >
            <div className="sidebar__item__text">My Uploads</div>
          </SidebarSearchLink>
          {canManageUsers ? this.renderAdminLogsLinks() : false}
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    myPermissions: state.users.myPermissions,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    invalidateAuthToken: bindActionCreators(invalidateAuthToken, dispatch),
    getMyPermissions: bindActionCreators(getMyPermissions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(SettingsSidebar);
