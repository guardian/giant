import React from "react";
import PropTypes from "prop-types";

import BlankCheckboxIcon from "react-icons/lib/md/check-box-outline-blank";
import CheckIcon from "react-icons/lib/md/check";
import IndeterminateCheckMinus from "react-icons/lib/md/remove";

export const Checkbox = (props) => (
  <div
    className={`checkbox ${props.disabled ? "checkbox--disabled" : ""} ${props.selected ? "checkbox--checked" : ""}`}
    onClick={(e) => (!props.disabled ? props.onClick(e) : false)}
  >
    <div className="checkbox__icon">
      <BlankCheckboxIcon />
      {!props.selected && props.indeterminate ? (
        <IndeterminateCheckMinus className="checkbox__indeterminate" />
      ) : (
        false
      )}
      <CheckIcon
        className={`checkbox__check ${props.highlighted ? "highlight" : ""}`}
      />
    </div>
    <span className="checkbox__text">{props.children}</span>
  </div>
);

Checkbox.propTypes = {
  selected: PropTypes.bool,
  indeterminate: PropTypes.bool,
  disabled: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
  highlighted: PropTypes.bool,
  children: PropTypes.any,
};
