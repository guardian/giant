import PropTypes from "prop-types";

export type TokenType = {
  issuedAt: number;
  refreshedAt: number;
  exp: number;
};

export const token = PropTypes.shape({
  issuedAt: PropTypes.number.isRequired,
  refreshedAt: PropTypes.number.isRequired,
  exp: PropTypes.number.isRequired,
});
