import PropTypes from "prop-types";
import { z } from "zod";

export const LanguageSchema = z.object({
  key: z.string(),
  ocr: z.string(),
  iso6391Code: z.string(),
  analyzer: z.string(),
});
export type Language = z.infer<typeof LanguageSchema>;

export const language = PropTypes.shape({
  key: PropTypes.string.isRequired,
  ocr: PropTypes.string.isRequired,
  analyzer: PropTypes.string.isRequired,
  iso6391Code: PropTypes.string.isRequired,
});

// model.manifest.Ingestion serializes OffsetDateTime as a string and omits
// absent Option fields. Keep the wire values unchanged for existing consumers.
export const ingestionSchema = z.looseObject({
  display: z.string(),
  uri: z.string(),
  startTime: z.iso.datetime({ offset: true }),
  endTime: z.iso.datetime({ offset: true }).nullish(),
  path: z.string().nullish(),
  failureMessage: z.string().nullish(),
  languages: z.array(z.string()),
  fixed: z.boolean(),
  default: z.boolean(),
});
export type Ingestion = z.infer<typeof ingestionSchema>;

export const ingestion = PropTypes.shape({
  display: PropTypes.string.isRequired,
  uri: PropTypes.string.isRequired,

  startTime: PropTypes.string.isRequired,
  endTime: PropTypes.string,

  path: PropTypes.string,
  failureMessage: PropTypes.string,
});

// CollectionWithUsers is returned by the list/detail endpoints; creation
// returns Collection without users.
export const collectionSchema = z.looseObject({
  uri: z.string(),
  display: z.string(),
  createdBy: z.string().nullish(),
  ingestions: z.array(ingestionSchema),
});
export const collectionWithUsersSchema = collectionSchema.extend({
  users: z.array(z.string()),
});
export const collectionsSchema = z.array(collectionWithUsersSchema);
export type Collection = z.infer<typeof collectionWithUsersSchema>;

export const collection = PropTypes.shape({
  uri: PropTypes.string.isRequired,
  display: PropTypes.string.isRequired,
  ingestions: PropTypes.arrayOf(ingestion),
  users: PropTypes.arrayOf(PropTypes.string),
});
