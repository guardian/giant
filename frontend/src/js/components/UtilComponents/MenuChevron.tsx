import React from "react";
import { MdExpandMore as ChevronIcon } from "react-icons/md";

type MenuChevronPropTypes = {
  expanded: boolean;
  onClick: (e: React.MouseEvent<SVGElement>) => void;
};

export const MenuChevron = (props: MenuChevronPropTypes) => (
  <ChevronIcon
    onClick={props.onClick}
    className={
      props.expanded
        ? "sidebar__chevron sidebar__chevron--open"
        : "sidebar__chevron"
    }
  />
);
