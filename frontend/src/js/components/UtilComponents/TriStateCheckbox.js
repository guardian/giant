import React from "react";
import PropTypes from "prop-types";

import BlankCheckboxIcon from "react-icons/lib/md/check-box-outline-blank";
import CheckBoxIcon from "react-icons/lib/md/check-box";
import IndeterminateCheckBoxIcon from "react-icons/lib/md/indeterminate-check-box";

/**
 * A tri-state checkbox that cycles: off → positive → negative → off
 *
 * States:
 *   "off"      — empty box
 *   "positive" — filled checkbox with tick  (include)
 *   "negative" — filled checkbox with minus (exclude)
 */
export const TriStateCheckbox = (props) => {
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

TriStateCheckbox.propTypes = {
  /** "off" | "positive" | "negative" */
  state: PropTypes.oneOf(["off", "positive", "negative"]).isRequired,
  onClick: PropTypes.func.isRequired,
};
