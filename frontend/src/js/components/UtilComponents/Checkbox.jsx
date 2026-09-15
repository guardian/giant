import React from "react";
import PropTypes from "prop-types";

import { MdCheckBoxOutlineBlank } from "react-icons/md";
import { MdCheck } from "react-icons/md";
import { MdRemove } from "react-icons/md";

export const Checkbox = (props) => (
  <div
    className={`checkbox ${props.disabled ? "checkbox--disabled" : ""} ${props.selected ? "checkbox--checked" : ""}`}
    onClick={(e) => (!props.disabled ? props.onClick(e) : false)}
  >
    <div className="checkbox__icon">
      <MdCheckBoxOutlineBlank />
      {!props.selected && props.indeterminate ? (
        <MdRemove className="checkbox__indeterminate" />
      ) : (
        false
      )}
      <MdCheck
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
