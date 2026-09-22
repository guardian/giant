import React, { useState } from "react";
import PropTypes from "prop-types";

import { NavSearchLink } from "../UtilComponents/SearchLink";

type Props = {
  to: string;
  children: React.ReactNode;
  className?: string;
  onDrop?: React.DragEventHandler<HTMLAnchorElement>;
};

export default function SidebarSearchLink({ to, children, onDrop }: Props) {
  const [hoveredOver, setHoveredOver] = useState(false);

  return (
    <NavSearchLink
      to={to}
      isActive={(_, { pathname }) => pathname === to}
      activeClassName="sidebar__item sidebar__item--active"
      className={`sidebar__item ${hoveredOver ? "sidebar__item--drop-target" : ""}`}
      onDrop={(e) => {
        onDrop?.(e);
        setHoveredOver(false);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setHoveredOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setHoveredOver(false);
      }}
    >
      {children}
    </NavSearchLink>
  );
}

SidebarSearchLink.propTypes = {
  to: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};
