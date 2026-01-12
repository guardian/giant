import PropTypes from "prop-types";

export type Language = {
  key: string;
  ocr: string;
  analyzer: string;
};

export const language = PropTypes.shape({
  key: PropTypes.string.isRequired,
  ocr: PropTypes.string.isRequired,
  analyzer: PropTypes.string.isRequired,
});

export type Ingestion = {
  display: string;
  uri: string;
  startTime: Date;
  endTime: null | Date;
  path: string;
  failureMessage: null | string;
  languages: Language[];
  fixed: boolean;
  default: boolean;
};

export const ingestion = PropTypes.shape({
  display: PropTypes.string.isRequired,
  uri: PropTypes.string.isRequired,

  startTime: PropTypes.string.isRequired,
  endTime: PropTypes.string,

  path: PropTypes.string,
  failureMessage: PropTypes.string,
});

export type Collection = {
  uri: string;
  display: string;
  createdBy: null | string;
  ingestions: Ingestion[];
  users: string[];
};

export const collection = PropTypes.shape({
  uri: PropTypes.string.isRequired,
  display: PropTypes.string.isRequired,
  ingestions: PropTypes.arrayOf(ingestion),
  users: PropTypes.arrayOf(PropTypes.string),
});
