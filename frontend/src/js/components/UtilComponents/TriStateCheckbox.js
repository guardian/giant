import React from "react";
import PropTypes from "prop-types";

import BlankCheckboxIcon from "react-icons/lib/md/check-box-outline-blank";
import CheckIcon from "react-icons/lib/md/check";
import CloseIcon from "react-icons/lib/md/close";

/**
 * A tri-state checkbox that cycles: off → positive → negative → off
 *
 * States:
 *   "off"      — empty box
 *   "positive" — green tick  (include)
 *   "negative" — red cross   (exclude)
 */
export const TriStateCheckbox = (props) => {
  const stateClass =
    props.state === "positive"
      ? "checkbox--checked"
      : props.state === "negative"
        ? "checkbox--negative"
        : "";

  return (
    <div
      className={`checkbox ${stateClass}`}
      onClick={(e) => props.onClick(e)}
    >
      <div className="checkbox__icon">
        <BlankCheckboxIcon />
        {props.state === "positive" && (
          <CheckIcon className="checkbox__check" />
        )}
        {props.state === "negative" && (
          <CloseIcon className="checkbox__cross" />
        )}
      </div>
    </div>
  );
};

TriStateCheckbox.propTypes = {
  /** "off" | "positive" | "negative" */
  state: PropTypes.oneOf(["off", "positive", "negative"]).isRequired,
  onClick: PropTypes.func.isRequired,
};
