import PropTypes from 'prop-types';

export const node = PropTypes.shape({
    hostname: PropTypes.string.isRequired,
    reachable: PropTypes.bool.isRequired
});

export const cluster = PropTypes.shape({
    nodes: PropTypes.arrayOf(node)
});

export const fileEntry = PropTypes.shape({
    path: PropTypes.string.isRequired,
    fileName: PropTypes.string.isRequired,
    isDirectory: PropTypes.bool.isRequired,
    children: PropTypes.arrayOf(fileEntry)
});
