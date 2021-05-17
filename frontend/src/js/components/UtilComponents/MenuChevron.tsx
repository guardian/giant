import React, { ReactSVGElement } from 'react';
import PropTypes from 'prop-types';
import ChevronIcon from 'react-icons/lib/md/expand-more';

type PropTypes = {
    expanded: boolean,
    onClick: (e: React.MouseEvent<ReactSVGElement>) => void
}

export const MenuChevron = (props: PropTypes) =>
    <ChevronIcon
        onClick={props.onClick}
        className={props.expanded ? 'sidebar__chevron sidebar__chevron--open' : 'sidebar__chevron'}
    />;
