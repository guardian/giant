import PropTypes from "prop-types";

export type PartialUser = { username: string; displayName: string };

export const partialUser = PropTypes.shape({
  username: PropTypes.string.isRequired,
  displayName: PropTypes.string.isRequired,
});

export const permissionsPropType = PropTypes.arrayOf(
  PropTypes.string,
).isRequired;

export const user = PropTypes.shape({
  username: PropTypes.string.isRequired,
  displayName: PropTypes.string.isRequired,
  collections: PropTypes.arrayOf(PropTypes.string).isRequired,
  permissions: permissionsPropType,
});

export type User = {
  username: string;
  displayName: string;
  collections: string[];
  permissions: {
    granted: string[];
  };
};
