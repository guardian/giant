import React from "react";
import PropTypes from "prop-types";
import { Link, NavLink, NavLinkProps } from "react-router-dom";
import buildLink from "../../util/buildLink";

import { connect } from "react-redux";

import { GiantState } from "../../types/redux/GiantState";
import { UrlParameters } from "../../util/UrlParameters";

type InjectedProps = ReturnType<typeof mapStateToProps>;

type SearchLinkProps = {
  to: string;
  children: React.ReactNode;
  className?: string;
  params?: UrlParameters;
} & InjectedProps;

type NavSearchLinkProps = Pick<
  NavLinkProps,
  | "children"
  | "className"
  | "activeClassName"
  | "isActive"
  | "title"
  | "onDrop"
  | "onDragOver"
  | "onDragLeave"
  | "onDragStart"
> & { to: string } & InjectedProps;

// Maintains search and filter params across internal links
function SearchLinkUnconnected({
  to,
  children,
  className,
  urlParams,
  params,
}: SearchLinkProps) {
  const link = buildLink(to, urlParams, params || {});

  return (
    <Link className={className} to={link}>
      {children}
    </Link>
  );
}

SearchLinkUnconnected.propTypes = {
  to: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  urlParams: PropTypes.object,
  params: PropTypes.object,
};

function NavSearchLinkUnconnected(props: NavSearchLinkProps) {
  const { to, urlParams, children, onDrop, onDragOver, onDragLeave } = props;
  const { className, activeClassName, isActive, title } = props;
  const link = buildLink(to, urlParams, {});

  return (
    <NavLink
      to={link}
      activeClassName={activeClassName}
      className={className}
      isActive={isActive}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      title={title}
    >
      {children}
    </NavLink>
  );
}

NavSearchLinkUnconnected.propTypes = {
  to: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  isActive: PropTypes.func.isRequired,
  activeClassName: PropTypes.string.isRequired,
  className: PropTypes.string.isRequired,
  onDrop: PropTypes.func,
  onDragStart: PropTypes.func,
  urlParams: PropTypes.object,
};

function mapStateToProps(state: GiantState) {
  return {
    urlParams: state.urlParams,
  };
}

function mapDispatchToProps() {
  return {};
}

export const SearchLink = connect(
  mapStateToProps,
  mapDispatchToProps,
)(SearchLinkUnconnected);
export const NavSearchLink = connect(
  mapStateToProps,
  mapDispatchToProps,
)(NavSearchLinkUnconnected);
