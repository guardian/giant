import PropTypes from 'prop-types';

export type Match = {
    params: {
        uri: string,
        timestamp: string,
        id: string
    }
}

export const match = PropTypes.shape({
    params: PropTypes.shape({
        uri: PropTypes.string,
        timestamp: PropTypes.string
    }).isRequired
});
