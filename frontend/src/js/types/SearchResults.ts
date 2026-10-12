import PropTypes from "prop-types";
import { z } from "zod";

// Wire formats: model/frontend/SearchResult.scala, Highlight.scala and Recipient.
const recipientSchema = z.object({
  email: z.string(),
  displayName: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
});

export const searchResultDetailsSchema = z.discriminatedUnion("_type", [
  z.object({
    _type: z.literal("document"),
    mimeTypes: z.array(z.string()),
    displayMimeTypes: z.array(z.string()),
    fileCategory: z.string(),
    fileUris: z.array(z.string()),
    fileSize: z
      .number()
      .nullish()
      .transform((value) => value ?? undefined),
  }),
  z.object({
    _type: z.literal("email"),
    from: recipientSchema,
    recipients: z.array(recipientSchema),
    subject: z.string(),
    attachmentCount: z.number(),
  }),
]);

export const searchResultHighlightSchema = z.object({
  field: z.string(),
  display: z.string(),
  highlight: z.string(),
});

export const searchResultSchema = z.object({
  uri: z.string(),
  highlights: z.array(searchResultHighlightSchema),
  fieldWithMostHighlights: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  flag: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  createdAt: z
    .number()
    .nullish()
    .transform((value) => value ?? undefined),
  details: searchResultDetailsSchema,
  collections: z.array(z.string()),
});

export type SearchResultDetails = z.infer<typeof searchResultDetailsSchema>;
export type SearchResultHighlight = z.infer<typeof searchResultHighlightSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;

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

export const searchAggBucketSchema = z.object({
  key: z.string(),
  count: z.number(),
  get buckets() {
    return z.array(searchAggBucketSchema).nullish();
  },
});

export const searchAggSchema = z.object({
  key: z.string(),
  buckets: z.array(searchAggBucketSchema),
});

export type SearchAggBucket = z.infer<typeof searchAggBucketSchema>;
export type SearchAgg = z.infer<typeof searchAggSchema>;

export const searchAggPropType = PropTypes.shape({
  key: PropTypes.string.isRequired,
  buckets: PropTypes.arrayOf(searchAggBucketPropType).isRequired,
});

export const searchResponseSchema = z.object({
  aggs: z.array(searchAggSchema),
  hits: z.number(),
  took: z.number(),
  page: z.number(),
  pageSize: z.number(),
  results: z.array(searchResultSchema),
});

export type SearchResponse = z.infer<typeof searchResponseSchema>;
// pages is computed by searchReducer, never supplied by the API.
export type SearchResults = SearchResponse & { pages: number };

export const searchResultsPropType = PropTypes.shape({
  aggs: PropTypes.arrayOf(searchAggPropType).isRequired,
  hits: PropTypes.number.isRequired,
  took: PropTypes.number.isRequired,
  page: PropTypes.number.isRequired,
  pageSize: PropTypes.number.isRequired,
  pages: PropTypes.number.isRequired,
  results: PropTypes.arrayOf(searchResultPropType).isRequired,
});
