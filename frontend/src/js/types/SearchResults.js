import PropTypes from "prop-types";

export const searchResultPropType = PropTypes.shape({
  uri: PropTypes.string.isRequired,
  highlights: PropTypes.arrayOf(
    PropTypes.shape({
      field: PropTypes.string.isRequired,
      display: PropTypes.string.isRequired,
      highlight: PropTypes.string.isRequired,
    }),
  ).isRequired,
  details: PropTypes.object,
});

export const searchAggBucketPropType = PropTypes.shape({
  key: PropTypes.string.isRequired,
  count: PropTypes.number.isRequired,
  buckets: PropTypes.array,
});

export const searchAggPropType = PropTypes.shape({
  key: PropTypes.string.isRequired,
  buckets: PropTypes.arrayOf(searchAggBucketPropType).isRequired,
});

export const searchResultsPropType = PropTypes.shape({
  aggs: PropTypes.arrayOf(searchAggPropType).isRequired,
  hits: PropTypes.number.isRequired,
  took: PropTypes.number.isRequired,
  page: PropTypes.number.isRequired,
  pages: PropTypes.number.isRequired,
  results: PropTypes.arrayOf(searchResultPropType).isRequired,
});
