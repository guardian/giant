import PropTypes from "prop-types";
import { z } from "zod";

// Chip.format in model/frontend/Chip.scala removes template from the response.
export const suggestedFieldSchema = z.discriminatedUnion("type", [
  z.object({ name: z.string(), type: z.literal("text") }),
  z.object({ name: z.string(), type: z.literal("date") }),
  z.object({ name: z.string(), type: z.literal("date_ex") }),
  z.object({
    name: z.string(),
    type: z.literal("dropdown"),
    options: z.array(z.object({ label: z.string(), value: z.string() })),
  }),
]);
export const suggestedFieldsSchema = z.array(suggestedFieldSchema);
export type SuggestedField = z.infer<typeof suggestedFieldSchema>;

export const suggestedFieldsPropType = PropTypes.shape({
  name: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
});
