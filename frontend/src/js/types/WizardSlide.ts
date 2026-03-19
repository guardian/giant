import PropTypes from "prop-types";
import React from "react";

export type WizardSlideType = {
  title: string;
  slide: React.ReactElement;
  validate?: () => boolean;
};

export const WizardSlide = PropTypes.shape({
  title: PropTypes.string.isRequired,
  slide: PropTypes.element.isRequired,
  validate: PropTypes.func,
});
