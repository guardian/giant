import PropTypes from 'prop-types';

export const suggestedFieldsPropType = PropTypes.shape({
    name: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired
});
