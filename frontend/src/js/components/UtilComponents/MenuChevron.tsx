import React, { ReactSVGElement } from "react";
import ChevronIcon from "react-icons/lib/md/expand-more";

type MenuChevronPropTypes = {
  expanded: boolean;
  onClick: (e: React.MouseEvent<ReactSVGElement>) => void;
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
