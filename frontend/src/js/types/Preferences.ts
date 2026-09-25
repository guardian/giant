import { z } from "zod";

// Preserve unrecognised keys when updating preferences saved by other versions.
export const preferencesSchema = z.looseObject({
  showSearchHighlights: z.boolean().optional(),
  showCommentHighlights: z.boolean().optional(),
  compactSearchResults: z.boolean().optional(),
  searchResultHistogram: z.boolean().optional(),
  featurePageViewer: z.boolean().optional(),
  featureEUI: z.boolean().optional(),
});

export type Preferences = z.infer<typeof preferencesSchema>;

const defaultPreferences: Preferences = {
  showSearchHighlights: true,
  showCommentHighlights: true,
};

export function loadPreferences(): Preferences {
  const saved = localStorage.getItem("preferences");
  let incoming: unknown;
  try {
    incoming = saved === null ? null : JSON.parse(saved);
  } catch {
    // Malformed JSON follows the same recovery path as invalid saved values.
    incoming = null;
  }
  const result = preferencesSchema.safeParse(incoming);
  // Missing or invalid data resets to startup defaults. Existing valid settings
  // retain the legacy migration that adds only showCommentHighlights.
  const preferences = result.success
    ? {
        ...result.data,
        showCommentHighlights: result.data.showCommentHighlights ?? true,
      }
    : { ...defaultPreferences };
  if (!result.success || result.data.showCommentHighlights === undefined) {
    localStorage.setItem("preferences", JSON.stringify(preferences));
  }
  return preferences;
}
