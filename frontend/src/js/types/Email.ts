import PropTypes from "prop-types";

export type EmailMetadata = {
  subject?: string;
  fromAddress?: string;
  fromName?: string;
  sentAt?: any;
};

export type Email = {
  uri: string;
  display?: string;
  hasSource?: boolean;
  metadata?: EmailMetadata;
};

export type EmailNeighbour = {
  uri: string;
  relation: string;
};

export type EmailRelation = {
  email: Email;
  neighbours: EmailNeighbour[];
};

export type EmailThread = {
  missingNodes: string[];
  thread: EmailRelation[];
};

export const emailMetadataPropType = PropTypes.shape({
  subject: PropTypes.string,
  fromAddress: PropTypes.string,
  fromName: PropTypes.string,
  sentAt: PropTypes.object,
});

export const emailPropType = PropTypes.shape({
  uri: PropTypes.string.isRequired,
  display: PropTypes.string,
  hasSource: PropTypes.bool,
  metadata: emailMetadataPropType,
});

export const emailNeighbourPropType = PropTypes.shape({
  uri: PropTypes.string.isRequired,
  relation: PropTypes.string.isRequired,
});

export const emailRelationPropType = PropTypes.shape({
  email: emailPropType.isRequired,
  neighbours: PropTypes.arrayOf(emailNeighbourPropType).isRequired,
});

export const emailThreadPropType = PropTypes.shape({
  missingNodes: PropTypes.arrayOf(PropTypes.string).isRequired,
  thread: PropTypes.arrayOf(emailRelationPropType).isRequired,
});
