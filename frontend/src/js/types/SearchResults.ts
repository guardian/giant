import PropTypes from "prop-types";

export type SearchResultDetails =
  | { _type: "document"; mimeTypes: string[]; displayMimeTypes: string[]; fileUris: string[]; fileSize?: number }
  | {
      _type: "email";
      from: { email: string; displayName?: string };
      subject: string;
      sentAt?: string;
      attachmentCount: number;
    };

export type SearchResultHighlight = {
  field: string;
  display: string;
  highlight: string;
  createdAt?: number;
};

export type SearchResult = {
  uri: string;
  highlights: SearchResultHighlight[];
  fieldWithMostHighlights: string | undefined;
  createdAt?: number;
  details: SearchResultDetails;
  collections: string[];
};

export const searchResultPropType = PropTypes.shape({
  uri: PropTypes.string.isRequired,
  highlights: PropTypes.arrayOf(
    PropTypes.shape({
      field: PropTypes.string.isRequired,
      display: PropTypes.string.isRequired,
      highlight: PropTypes.string.isRequired,
    }),
  ).isRequired,
  fieldWithMostHighlights: PropTypes.string,
  details: PropTypes.object,
});

export const searchAggBucketPropType = PropTypes.shape({
  key: PropTypes.string.isRequired,
  count: PropTypes.number.isRequired,
  buckets: PropTypes.array,
});

export type SearchAggBucket = {
  key: string;
  count: number;
  buckets?: SearchAggBucket[];
};

export type SearchAgg = {
  key: string;
  buckets: SearchAggBucket[];
};

export const searchAggPropType = PropTypes.shape({
  key: PropTypes.string.isRequired,
  buckets: PropTypes.arrayOf(searchAggBucketPropType).isRequired,
});

export type SearchResults = {
  aggs: SearchAgg[];
  hits: number;
  took: number;
  page: number;
  pages: number;
  results: SearchResult[];
};

export const searchResultsPropType = PropTypes.shape({
  aggs: PropTypes.arrayOf(searchAggPropType).isRequired,
  hits: PropTypes.number.isRequired,
  took: PropTypes.number.isRequired,
  page: PropTypes.number.isRequired,
  pages: PropTypes.number.isRequired,
  results: PropTypes.arrayOf(searchResultPropType).isRequired,
});
