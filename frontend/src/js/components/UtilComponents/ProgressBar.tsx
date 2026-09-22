import React from "react";
import PropTypes from "prop-types";

type ProgressBarProps = {
  highest: number;
  value: number;
  className?: string;
};

function percentageWidth(total: number, value: number): string {
  return `${(value / total) * 100}%`;
}

export const ProgressBar = (props: ProgressBarProps) => (
  <div className={props.className || "progress-bar"}>
    <div
      className="progress-bar__bar"
      style={{ width: percentageWidth(props.highest, props.value) }}
    ></div>
  </div>
);

ProgressBar.propTypes = {
  highest: PropTypes.number.isRequired,
  value: PropTypes.number.isRequired,
  className: PropTypes.string,
};
