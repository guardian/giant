import React, { FC } from "react";
import { MdPlayArrow } from "react-icons/md";

type DocNavButtonProps = {
  title: string;
  onClick?: () => void;
  direction: "previous" | "next";
};

export const DocNavButton: FC<DocNavButtonProps> = ({
  title,
  onClick,
  direction,
}) => {
  const isActive = !!onClick;
  const className = isActive
    ? "doc-nav-button doc-nav-button--active"
    : "doc-nav-button doc-nav-button--inactive";
  const rotation = direction === "previous" ? "doc-nav-button--previous" : "";

  return (
    <span
      title={title}
      className={`${className} ${rotation}`}
      onClick={isActive ? onClick : undefined}
      role="button"
      tabIndex={isActive ? 0 : -1}
    >
      <MdPlayArrow />
    </span>
  );
};
