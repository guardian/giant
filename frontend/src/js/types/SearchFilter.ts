import PropTypes from "prop-types";
import { z } from "zod";

// Filter.scala uses Play JSON Option fields for explanation and suboptions.
export const searchFilterOptionSchema = z.object({
  value: z.string(),
  display: z.string(),
  explanation: z.string().nullish(),
  get suboptions() {
    return z.array(searchFilterOptionSchema).nullish();
  },
});

export const searchFilterSchema = z.object({
  key: z.string(),
  display: z.string(),
  hideable: z.boolean(),
  options: z.array(searchFilterOptionSchema),
});

export const searchFiltersSchema = z.array(searchFilterSchema);
export type SearchFilterOption = z.infer<typeof searchFilterOptionSchema>;
export type SearchFilter = z.infer<typeof searchFilterSchema>;

export const searchFilterOption: PropTypes.Requireable<SearchFilterOption> =
  PropTypes.shape({
    value: PropTypes.string.isRequired,
    display: PropTypes.string.isRequired,
    explanation: PropTypes.string,
    suboptions: PropTypes.arrayOf<SearchFilterOption>(
      (...args: Parameters<PropTypes.Validator<SearchFilterOption>>) =>
        searchFilterOption(...args),
    ),
  });

export const searchFilter = PropTypes.shape({
  key: PropTypes.string.isRequired,
  display: PropTypes.string,
  options: PropTypes.arrayOf(searchFilterOption),
});
