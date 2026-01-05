import PropTypes from "prop-types";

export const WizardSlide = PropTypes.shape({
  title: PropTypes.string.isRequired,
  slide: PropTypes.element.isRequired,
  validate: PropTypes.func,
});
