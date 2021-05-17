import PropTypes from 'prop-types';

export const emailMetadataPropType = PropTypes.shape({
    subject: PropTypes.string,
    fromAddress: PropTypes.string,
    fromName: PropTypes.string,
    sentAt: PropTypes.object
});

export const emailPropType = PropTypes.shape({
    uri: PropTypes.string.isRequired,
    display: PropTypes.string,
    hasSource: PropTypes.bool,
    metadata: emailMetadataPropType
});

export const emailNeighbourPropType = PropTypes.shape({
    uri: PropTypes.string.isRequired,
    relation: PropTypes.string.isRequired
});

export const emailRelationPropType = PropTypes.shape({
    email: emailPropType.isRequired,
    neighbours: PropTypes.arrayOf(emailNeighbourPropType).isRequired
});

export const emailThreadPropType = PropTypes.shape({
    missingNodes: PropTypes.arrayOf(PropTypes.string).isRequired,
    thread: PropTypes.arrayOf(emailRelationPropType).isRequired
});
