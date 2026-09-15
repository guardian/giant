import React from "react";
import PropTypes from "prop-types";
import { MdSearch } from "react-icons/md";
import { MdSettings } from "react-icons/md";
import { MdFolderOpen } from "react-icons/md";
import { FaBook } from "react-icons/fa";
import { FaDatabase } from "react-icons/fa";
import { SearchLink, NavSearchLink } from "./UtilComponents/SearchLink";

function calculateActive(paths) {
  return (linkPath, currentPath) => {
    const matchingPath = paths.find(
      (possibleMatch) => currentPath.pathname.indexOf(possibleMatch) !== -1,
    );

    return !!matchingPath;
  };
}

function HeaderSearchLink({ to, children, activePaths, className, title }) {
  return (
    <NavSearchLink
      to={to}
      isActive={calculateActive(activePaths)}
      activeClassName={
        className
          ? `main-header__item main-header__item--link main-header__item--active ${className}`
          : "main-header__item main-header__item--link main-header__item--active"
      }
      className={
        className
          ? `main-header__item main-header__item--link ${className}`
          : "main-header__item main-header__item--link"
      }
      title={title}
    >
      {children}
    </NavSearchLink>
  );
}

HeaderSearchLink.propTypes = {
  to: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  activePaths: PropTypes.arrayOf(PropTypes.string).isRequired,
};

export default class Header extends React.Component {
  static propTypes = {
    user: PropTypes.shape({
      displayName: PropTypes.string.isRequired,
      username: PropTypes.string.isRequired,
    }),
    config: PropTypes.shape({
      label: PropTypes.string,
      readOnly: PropTypes.bool.isRequired,
    }),
    preferences: PropTypes.object,
  };

  state = {
    isOpen: false,
  };

  collectionsPaths = ["/collections", "/ingestions", "/files", "/documents"];

  renderGuideLink() {
    return (
      <HeaderSearchLink
        to="/guide"
        activePaths={["/guide"]}
        title="Giant user guide"
      >
        <FaBook className="main-header__item__icon" />
      </HeaderSearchLink>
    );
  }

  renderSettingsLink() {
    return (
      <HeaderSearchLink
        to="/settings/dataset-permissions"
        activePaths={["/settings"]}
        title="Settings"
      >
        <MdSettings className="main-header__item__icon" />
      </HeaderSearchLink>
    );
  }

  renderHeaderLinks() {
    return (
      <React.Fragment>
        <HeaderSearchLink to="/search" activePaths={["/search"]}>
          <MdSearch className="main-header__item__icon" />
          Search
        </HeaderSearchLink>
        <HeaderSearchLink to="/collections" activePaths={this.collectionsPaths}>
          <FaDatabase className="main-header__item__icon" />
          Datasets
        </HeaderSearchLink>
        <HeaderSearchLink to="/workspaces" activePaths={["/workspaces"]}>
          <MdFolderOpen className="main-header__item__icon" />
          Workspaces
        </HeaderSearchLink>
      </React.Fragment>
    );
  }

  renderLabel() {
    if (this.props.config.readOnly) {
      return (
        <span className="main-header__label">
          Giant is temporarily in read-only mode for maintenance. Actions such
          as uploads are disabled.
        </span>
      );
    } else if (this.props.config.label) {
      return (
        <span className="main-header__label">{this.props.config.label}</span>
      );
    }
  }

  renderUser(loggedIn) {
    if (!loggedIn) {
      return false;
    }

    return (
      <span className="main-header__item">{this.props.user.displayName}</span>
    );
  }

  render() {
    const loggedIn = this.props.user !== undefined;

    return (
      <header className="main-header">
        <nav className="main-header__links">
          <div className="main-header__links-section">
            <SearchLink to="/" className="main-header__title-link">
              <h1 className="main-header__title">
                Giant<span className="highlight">.</span>
              </h1>
            </SearchLink>
            {loggedIn ? this.renderHeaderLinks() : false}
            {this.renderLabel()}
          </div>
          <div className="main-header__links-section">
            {this.renderUser(loggedIn)}
            {loggedIn ? this.renderGuideLink() : false}
            {loggedIn ? this.renderSettingsLink() : false}
          </div>
        </nav>
      </header>
    );
  }
}
