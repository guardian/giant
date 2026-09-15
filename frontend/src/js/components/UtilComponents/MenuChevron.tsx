import React from "react";
import { MdExpandMore } from "react-icons/md";

type MenuChevronPropTypes = {
  expanded: boolean;
  onClick: (e: React.MouseEvent<SVGElement>) => void;
};

export const MenuChevron = (props: MenuChevronPropTypes) => (
  <MdExpandMore
    onClick={props.onClick}
    className={
      props.expanded
        ? "sidebar__chevron sidebar__chevron--open"
        : "sidebar__chevron"
    }
  />
);
