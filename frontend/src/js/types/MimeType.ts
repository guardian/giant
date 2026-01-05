import PropTypes from "prop-types";

export const mimeTypePropType = PropTypes.shape({
  mimeType: PropTypes.string.isRequired,
});

export const mimeTypeCoveragePropType = PropTypes.shape({
  mimeType: mimeTypePropType.isRequired,
  humanReadableMimeType: PropTypes.string,
  total: PropTypes.number.isRequired,
  todo: PropTypes.number.isRequired,
  done: PropTypes.number.isRequired,
  failed: PropTypes.number.isRequired,
});

export interface MimeType {
  mimeType: string;
  priority: number;
}

export interface MimeTypeCoverage {
  mimeType: MimeType;
  humanReadableMimeType?: string;
  total: number;
  todo: number;
  done: number;
  failed: number;
}
