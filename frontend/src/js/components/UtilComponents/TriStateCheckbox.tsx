import React from "react";

import BlankCheckboxIcon from "react-icons/lib/md/check-box-outline-blank";
import CheckBoxIcon from "react-icons/lib/md/check-box";
import IndeterminateCheckBoxIcon from "react-icons/lib/md/indeterminate-check-box";
import { TriState } from "./triStateCycle";

interface TriStateCheckboxProps {
  state: TriState;
  onClick: (e: React.MouseEvent) => void;
}

export const TriStateCheckbox: React.FC<TriStateCheckboxProps> = (props) => {
  const stateClass =
    props.state === "positive"
      ? "checkbox--checked"
      : props.state === "negative"
        ? "checkbox--negative"
        : "";

  const Icon =
    props.state === "positive"
      ? CheckBoxIcon
      : props.state === "negative"
        ? IndeterminateCheckBoxIcon
        : BlankCheckboxIcon;

  return (
    <div className={`checkbox ${stateClass}`} onClick={(e) => props.onClick(e)}>
      <div className="checkbox__icon">
        <Icon />
      </div>
    </div>
  );
};
