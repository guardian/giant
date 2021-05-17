import PropTypes from 'prop-types';

export type Query = {
    id: string,
    displayName: string,
    query: string,
    count: number,
}

export const query = PropTypes.shape({
    id: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    query: PropTypes.string.isRequired,
    count: PropTypes.number.isRequired
});
