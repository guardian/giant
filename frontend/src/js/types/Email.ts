import PropTypes from "prop-types";
import { z } from "zod";

// Play's Option writers omit absent fields; explicit nulls are not emitted.
const emailMetadataSchema = z.object({
  subject: z.string().optional(),
  fromAddress: z.string().optional(),
  fromName: z.string().optional(),
  sentAt: z
    .object({
      time: z.iso.datetime({ offset: true }),
      knownTimezone: z.boolean(),
    })
    .optional(),
});

const emailSchema = z.object({
  uri: z.string(),
  haveSource: z.boolean(),
  display: z.string().optional(),
  metadata: emailMetadataSchema.optional(),
});

export const emailThreadSchema = z.object({
  missingNodes: z.array(z.string()),
  thread: z.array(
    z.object({
      email: emailSchema,
      neighbours: z.array(
        z.object({
          uri: z.string(),
          relation: z.string(),
        }),
      ),
    }),
  ),
});

export type EmailThread = z.infer<typeof emailThreadSchema>;

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
  haveSource: PropTypes.bool,
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
