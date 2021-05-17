import PropTypes from 'prop-types';

export const token = PropTypes.shape({
    issuedAt: PropTypes.number.isRequired,
    refreshedAt: PropTypes.number.isRequired,
    exp: PropTypes.number.isRequired
});
