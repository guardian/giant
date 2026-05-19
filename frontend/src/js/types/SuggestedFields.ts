import PropTypes from "prop-types";

export interface SuggestedField {
  name: string;
  type: string;
}

export const suggestedFieldsPropType = PropTypes.shape({
  name: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
});
