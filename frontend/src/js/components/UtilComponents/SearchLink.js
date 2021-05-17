import React from 'react';
import PropTypes from 'prop-types';
import {Link, NavLink} from 'react-router-dom';
import buildLink from '../../util/buildLink';

import {connect} from 'react-redux';

// Maintains search and filter params across internal links
function SearchLinkUnconnected({ to, children, className, urlParams, params }) {
    const link = buildLink(to, urlParams, params || {});

    return <Link className={className} to={link}>
        {children}
    </Link>;
}

SearchLinkUnconnected.propTypes = {
    to: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired,
    className: PropTypes.string,
    urlParams: PropTypes.object,
    params: PropTypes.object
};

function NavSearchLinkUnconnected(props) {
    const { to, urlParams, children, onDrop, onDragOver, onDragLeave } = props;
    const { className, activeClassName, isActive } = props;
    const link = buildLink(to, urlParams, {});

    return <NavLink
        to={link}
        activeClassName={activeClassName}
        className={className}
        isActive={isActive}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
    >
        {children}
    </NavLink>;
}

NavSearchLinkUnconnected.propTypes = {
    to: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired,
    isActive: PropTypes.func.isRequired,
    activeClassName: PropTypes.string.isRequired,
    className: PropTypes.string.isRequired,
    onDrop: PropTypes.func,
    onDragStart: PropTypes.func,
    urlParams: PropTypes.object
};

function mapStateToProps(state) {
    return {
        urlParams: state.urlParams
    };
}

function mapDispatchToProps() {
    return {};
}

export const SearchLink = connect(mapStateToProps, mapDispatchToProps)(SearchLinkUnconnected);
export const NavSearchLink = connect(mapStateToProps, mapDispatchToProps)(NavSearchLinkUnconnected);
